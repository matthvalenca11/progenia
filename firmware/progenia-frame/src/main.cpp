/**
 * ProGenia Frame — ESP32-C6 + BNO085
 *
 * Preferred: STA → iPhone Personal Hotspot (high Hz)
 * Fallback:  SoftAP ProGenia-Frame-XXXX / progenia1
 *
 *   GET  :80/health, :80/quat, :80/status
 *   POST :80/sta   (ssid, pass) → save NVS + reboot into STA
 *   POST :80/zero
 *   UDP  :9091 NDJSON → gateway (hotspot) or SoftAP clients
 *   TCP  :83 raw NDJSON · HTTP :82 chunked
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BNO08x.h>
#include "sh2.h"
#include "sh2_err.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <esp_mac.h>
#include <esp_wifi.h>
#include <math.h>
#include <string.h>

#include "FrameConfig.h"

#if FRAME_BLE_ENABLED
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>
#endif

struct Quat {
  float w;
  float x;
  float y;
  float z;
};

static Adafruit_BNO08x bno08x(-1);
static bool sensorReady = false;
static char deviceName[32] = "ProGenia-Frame-0000";
static float latestGravity[3] = {0.0f, 0.0f, -9.81f};
static float latestLinearAccel[3] = {0.0f, 0.0f, 0.0f};
static float latestGyro[3] = {0.0f, 0.0f, 0.0f};
static bool hasGravitySample = false;
static bool hasLinearAccelSample = false;
static bool hasGyroSample = false;
static uint8_t accelAccuracy = 0;
static uint8_t gyroAccuracy = 0;
static bool imuStationary = false;
static bool calibrationActive = true;
static bool calibrationReady = false;
static bool calibrationSaved = false;
static uint8_t calibrationFaces = 0;
static uint32_t stationarySinceMs = 0;
static uint32_t lastDcdSaveMs = 0;

/** Continuous probe depth along IMU +Z (moldura normal). */
static float motionBias[3] = {0.0f, 0.0f, 0.0f};
static float motionAccelFilt[3] = {0.0f, 0.0f, 0.0f};
static float motionVelocity = 0.0f;
static float motionCommitted = 0.0f;
static float motionLivePosition = 0.0f;
static uint8_t motionAxis = 2;
static uint32_t motionLastMs = 0;
static uint32_t motionQuietSinceMs = 0;
static bool motionGestureActive = false;
static float motionGestureDirection = 0.0f;
static uint32_t lastChipLinearMs = 0;
static bool chipLinearAlive = false;

#if FRAME_WIFI_ENABLED
static WebServer httpServer(FRAME_HTTP_PORT);
static WiFiServer streamServer(FRAME_STREAM_PORT);
static WiFiClient streamClient;
static bool streamActive = false;
static WiFiServer rawServer(FRAME_RAW_STREAM_PORT);
static WiFiClient rawClient;
static bool rawActive = false;
static WiFiUDP udp;
static bool wifiStaMode = false;
static uint8_t latestQuat[16] = {0, 0, 0x80, 0x3f, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
static Quat latestQ = {1, 0, 0, 0};
static uint32_t quatSeq = 0;
static uint32_t httpHits = 0;
static uint32_t streamPushes = 0;
#endif

#if !FRAME_WIFI_ENABLED
static uint32_t quatSeq = 0;
#endif

static Quat qZero = {1.0f, 0.0f, 0.0f, 0.0f};
static bool hasZero = false;
static bool captureZeroNext = false;
static uint32_t lastSampleMs = 0;
static uint32_t sampleCount = 0;
static uint32_t lastHzMs = 0;

enum FrameRunMode : uint8_t { FRAME_MODE_PROVISION = 0, FRAME_MODE_STREAM = 1 };
static FrameRunMode frameMode = FRAME_MODE_PROVISION;
static uint32_t lastStaRetryMs = 0;
static uint32_t staAttemptStartedMs = 0;
static bool staAttemptActive = false;
static String pendingStaSsid;
static String pendingStaPass;

#if FRAME_BLE_ENABLED
static BLEServer *bleServer = nullptr;
static BLECharacteristic *bleOrientation = nullptr;
static volatile bool bleConnected = false;
static volatile uint32_t bleConnectedAtMs = 0;
static volatile bool bleNotifyEnabled = false;
static volatile uint32_t bleNotifyReadyAtMs = 0;
static uint16_t bleConnHandle = 0xFFFF;
static volatile bool bleRestartRequested = false;
static uint32_t bleNotifyCount = 0;
static uint32_t bleNotifyErrorCount = 0;
static uint32_t lastBleNotifyOkMs = 0;
static bool wifiSuspendedForBle = false;
/** Last params reported by onConnParamsUpdate — printed every status line. */
static volatile float bleCurIntervalMs = 0.0f;
static volatile uint16_t bleCurLatency = 0;
static volatile uint16_t bleCurTimeoutMs = 0;
#endif

static void saveStaCredentials(const String &ssid, const String &pass) {
  Preferences p;
  p.begin("frame", false);
  p.putString("sta_ssid", ssid);
  p.putString("sta_pass", pass.isEmpty() ? FRAME_STA_PASS : pass);
  p.end();
#if FRAME_SERIAL_DEBUG
  Serial.printf("{\"event\":\"sta_saved\",\"ssid\":\"%s\"}\n", ssid.c_str());
#endif
}

static Quat quatNormalize(Quat q) {
  const float n = sqrtf(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (n < 1e-8f) return {1.0f, 0.0f, 0.0f, 0.0f};
  const float inv = 1.0f / n;
  return {q.w * inv, q.x * inv, q.y * inv, q.z * inv};
}

static Quat quatMultiply(const Quat &a, const Quat &b) {
  return quatNormalize({
      a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  });
}

static Quat quatConjugate(const Quat &q) { return {q.w, -q.x, -q.y, -q.z}; }

static bool quatFinite(const Quat &q) {
  return isfinite(q.w) && isfinite(q.x) && isfinite(q.y) && isfinite(q.z);
}

static void clearMotionCumulative();

static void saveZero() {
  Preferences p;
  p.begin("frame", false);
  p.putBool("zero_valid", hasZero);
  if (hasZero) {
    p.putFloat("zero_w", qZero.w);
    p.putFloat("zero_x", qZero.x);
    p.putFloat("zero_y", qZero.y);
    p.putFloat("zero_z", qZero.z);
  }
  p.end();
}

static void loadZero() {
  Preferences p;
  p.begin("frame", true);
  hasZero = p.getBool("zero_valid", false);
  if (hasZero) {
    qZero = quatNormalize({
        p.getFloat("zero_w", 1.0f),
        p.getFloat("zero_x", 0.0f),
        p.getFloat("zero_y", 0.0f),
        p.getFloat("zero_z", 0.0f),
    });
  }
  p.end();
}

static void clearZero() {
  qZero = {1.0f, 0.0f, 0.0f, 0.0f};
  hasZero = false;
  captureZeroNext = false;
  saveZero();
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"zero_cleared\"}");
#endif
}

static void setZeroFromFrame(const Quat &qFrame) {
  qZero = quatNormalize(qFrame);
  hasZero = true;
  captureZeroNext = false;
  saveZero();
#if FRAME_SERIAL_DEBUG
  Serial.printf("{\"event\":\"zero\",\"w\":%.4f,\"x\":%.4f,\"y\":%.4f,\"z\":%.4f}\n",
                qZero.w, qZero.x, qZero.y, qZero.z);
#endif
}

static Quat applyCalibration(const Quat &qImu) {
  const Quat qMount = {
      FRAME_MOUNT_QUAT.w, FRAME_MOUNT_QUAT.x, FRAME_MOUNT_QUAT.y, FRAME_MOUNT_QUAT.z};
  Quat qFrame = quatMultiply(qImu, qMount);
  if (captureZeroNext) setZeroFromFrame(qFrame);
  if (hasZero) qFrame = quatMultiply(quatConjugate(qZero), qFrame);
  return qFrame;
}

static uint8_t faceCount(uint8_t mask) {
  uint8_t count = 0;
  while (mask != 0) {
    count += mask & 1U;
    mask >>= 1U;
  }
  return count;
}

static void updateCalibrationState() {
  if (!hasGyroSample || !hasGravitySample) return;
  const uint32_t now = millis();
  const float gyroMag = sqrtf(
      latestGyro[0] * latestGyro[0] +
      latestGyro[1] * latestGyro[1] +
      latestGyro[2] * latestGyro[2]);
  if (gyroMag < 0.055f) {
    if (stationarySinceMs == 0) stationarySinceMs = now;
    imuStationary = now - stationarySinceMs >= 900;
  } else {
    stationarySinceMs = 0;
    imuStationary = false;
  }

  if (calibrationActive && imuStationary) {
    const float norm = sqrtf(
        latestGravity[0] * latestGravity[0] +
        latestGravity[1] * latestGravity[1] +
        latestGravity[2] * latestGravity[2]);
    if (norm > 7.5f && norm < 11.5f) {
      int axis = 0;
      if (fabsf(latestGravity[1]) > fabsf(latestGravity[axis])) axis = 1;
      if (fabsf(latestGravity[2]) > fabsf(latestGravity[axis])) axis = 2;
      if (fabsf(latestGravity[axis]) / norm > 0.82f) {
        calibrationFaces |= 1U << (axis * 2 + (latestGravity[axis] >= 0 ? 1 : 0));
      }
    }
  }

  const uint8_t faces = faceCount(calibrationFaces);
  const bool excellentWithThreeFaces =
      accelAccuracy == 3 && gyroAccuracy == 3 && faces >= 3;
  calibrationReady =
      accelAccuracy >= 2 && gyroAccuracy >= 2 &&
      (faces >= 4 || excellentWithThreeFaces);
  if (calibrationReady && calibrationActive && !calibrationSaved &&
      now - lastDcdSaveMs > 5000) {
    const int rc = sh2_saveDcdNow();
    if (rc == SH2_OK) {
      calibrationSaved = true;
      calibrationActive = false;
      lastDcdSaveMs = now;
      sh2_setCalConfig(SH2_CAL_ACCEL);
#if FRAME_SERIAL_DEBUG
      Serial.printf(
          "{\"event\":\"cal_saved\",\"accel\":%u,\"gyro\":%u,\"faces\":%u}\n",
          accelAccuracy, gyroAccuracy, faces);
#endif
    }
  }
}

static void startImuCalibration() {
  clearZero();
  calibrationActive = true;
  calibrationReady = false;
  calibrationSaved = false;
  calibrationFaces = 0;
  stationarySinceMs = 0;
  clearMotionCumulative();
  sh2_setCalConfig(SH2_CAL_ACCEL | SH2_CAL_GYRO);
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"cal_start\"}");
#endif
}

static void cancelImuCalibration() {
  calibrationActive = false;
  calibrationReady = false;
  calibrationFaces = 0;
  sh2_setCalConfig(SH2_CAL_ACCEL);
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"cal_cancel\"}");
#endif
}

static void saveImuCalibrationNow() {
  updateCalibrationState();
  if (!calibrationReady && !(accelAccuracy >= 2 && gyroAccuracy >= 2)) {
#if FRAME_SERIAL_DEBUG
    Serial.printf(
        "{\"event\":\"cal_save_skip\",\"accel\":%u,\"gyro\":%u,\"faces\":%u}\n",
        accelAccuracy, gyroAccuracy, faceCount(calibrationFaces));
#endif
    return;
  }
  const int rc = sh2_saveDcdNow();
  if (rc == SH2_OK) {
    calibrationSaved = true;
    calibrationReady = true;
    calibrationActive = false;
    lastDcdSaveMs = millis();
    sh2_setCalConfig(SH2_CAL_ACCEL);
#if FRAME_SERIAL_DEBUG
    Serial.printf(
        "{\"event\":\"cal_saved\",\"forced\":true,\"accel\":%u,\"gyro\":%u,\"faces\":%u}\n",
        accelAccuracy, gyroAccuracy, faceCount(calibrationFaces));
#endif
  }
}

static void packQuat(const Quat &q, uint8_t out[16]) {
  float vals[4] = {q.w, q.x, q.y, q.z};
  memcpy(out, vals, 16);
}

static void publishMotionLive() {
  motionLivePosition = motionCommitted;
  if (motionLivePosition > FRAME_MOTION_MAX_DISPLACEMENT_M) {
    motionLivePosition = FRAME_MOTION_MAX_DISPLACEMENT_M;
    motionCommitted = motionLivePosition;
    motionVelocity = 0.0f;
  } else if (motionLivePosition < -FRAME_MOTION_MAX_DISPLACEMENT_M) {
    motionLivePosition = -FRAME_MOTION_MAX_DISPLACEMENT_M;
    motionCommitted = motionLivePosition;
    motionVelocity = 0.0f;
  }
}

static void resetMotionDepth() {
  for (int i = 0; i < 3; i++) {
    motionBias[i] = 0.0f;
    motionAccelFilt[i] = 0.0f;
  }
  motionVelocity = 0.0f;
  motionCommitted = 0.0f;
  motionLivePosition = 0.0f;
  motionAxis = 2;
  motionLastMs = 0;
  motionQuietSinceMs = 0;
  motionGestureActive = false;
  motionGestureDirection = 0.0f;
  // Keep chipLinearAlive — report enable state does not change on ZERO.
}

static void clearMotionCumulative() { resetMotionDepth(); }

static float gyroMagnitude() {
  return sqrtf(
      latestGyro[0] * latestGyro[0] +
      latestGyro[1] * latestGyro[1] +
      latestGyro[2] * latestGyro[2]);
}

/**
 * Continuous push/pull along sensor +Z.
 * Braking accel kills velocity instead of reversing depth (the old discrete
 * integrator felt delayed and sometimes "inverted" at the end of a push).
 */
static void updateLinearGesture(const float accelImu[3], uint32_t now) {
  if (motionLastMs == 0) {
    motionLastMs = now;
    for (int i = 0; i < 3; i++) motionAccelFilt[i] = 0.0f;
    publishMotionLive();
    return;
  }
  const float dt = fminf(0.04f, (now - motionLastMs) * 0.001f);
  motionLastMs = now;
  if (dt <= 0.0f) {
    publishMotionLive();
    return;
  }

  const float gyroMag = gyroMagnitude();
  float unbiased[3];
  float accelMagSq = 0.0f;
  for (int i = 0; i < 3; i++) {
    unbiased[i] = accelImu[i] - motionBias[i];
    accelMagSq += unbiased[i] * unbiased[i];
  }

  const bool quietCandidate =
      gyroMag < FRAME_MOTION_QUIET_GYRO_RAD_S &&
      sqrtf(accelMagSq) < FRAME_MOTION_QUIET_MPS2;
  if (quietCandidate) {
    if (motionQuietSinceMs == 0) motionQuietSinceMs = now;
  } else {
    motionQuietSinceMs = 0;
  }
  const uint32_t quietMs =
      motionQuietSinceMs == 0 ? 0 : now - motionQuietSinceMs;

  // Never absorb a slow intentional gesture into the accelerometer bias.
  if (quietMs >= FRAME_MOTION_BIAS_HOLD_MS) {
    for (int i = 0; i < 3; i++) {
      motionBias[i] += (accelImu[i] - motionBias[i]) * FRAME_MOTION_BIAS_BLEND;
      unbiased[i] = accelImu[i] - motionBias[i];
    }
  }

  for (int i = 0; i < 3; i++) {
    motionAccelFilt[i] += (unbiased[i] - motionAccelFilt[i]) * FRAME_MOTION_ACCEL_LPF;
  }

#if FRAME_MOTION_AXIS_FIXED_Z
  motionAxis = 2;
#endif
  float a = motionAccelFilt[motionAxis];
#if FRAME_MOTION_WORLD_VERTICAL
  if (hasGravitySample) {
    const float gravityNorm = sqrtf(
        latestGravity[0] * latestGravity[0] +
        latestGravity[1] * latestGravity[1] +
        latestGravity[2] * latestGravity[2]);
    if (gravityNorm > 1.0f) {
      // Gravity points down in sensor coordinates; negate for world-up accel.
      a = -(
          motionAccelFilt[0] * latestGravity[0] +
          motionAccelFilt[1] * latestGravity[1] +
          motionAccelFilt[2] * latestGravity[2]) /
          gravityNorm;
    }
  }
#endif
  if (fabsf(a) < FRAME_MOTION_ACCEL_DEADZONE) a = 0.0f;

  // While twisting the frame, freeze depth — gyro owns orientation.
  if (gyroMag > FRAME_MOTION_MAX_GYRO_RAD_S) {
    motionVelocity = 0.0f;
    motionGestureActive = false;
    motionGestureDirection = 0.0f;
    publishMotionLive();
    return;
  }

  // Idle noise never starts a gesture.
  if (!motionGestureActive) {
    if (fabsf(a) < FRAME_MOTION_START_MPS2) {
      publishMotionLive();
      return;
    }
    motionGestureActive = true;
    motionGestureDirection = a >= 0.0f ? 1.0f : -1.0f;
  }

  // Sustained rest is an explicit zero-velocity update.
  if (quietMs >= FRAME_MOTION_ZUPT_MS) {
    motionVelocity = 0.0f;
    motionGestureActive = false;
    motionGestureDirection = 0.0f;
    for (int i = 0; i < 3; i++) motionAccelFilt[i] = 0.0f;
    publishMotionLive();
    return;
  }

#if FRAME_MOTION_GESTURE_RATE_CONTROL
  // Direction remains locked through the braking half of the gesture, so
  // deceleration cannot reverse the requested slice movement.
  const float effort =
      fmaxf(0.0f, fabsf(a) - FRAME_MOTION_ACCEL_DEADZONE);
  float rate = fabsf(motionVelocity);
  if (effort > 0.0f) {
    const float targetRate = fminf(
        FRAME_MOTION_RATE_MAX_MPS,
        FRAME_MOTION_RATE_MIN_MPS +
            effort * FRAME_MOTION_RATE_M_PER_MPS2_S * FRAME_MOTION_GAIN);
    rate += (targetRate - rate) * FRAME_MOTION_RATE_ATTACK;
  } else {
    // Keep a short, decaying continuation between the launch and braking
    // impulses. Otherwise slow hand translations look like two tiny pulses.
    rate *= expf(-FRAME_MOTION_RATE_DECAY * dt);
  }
  motionVelocity = motionGestureDirection * rate;
  motionCommitted += motionVelocity * dt;
#else
  motionVelocity += a * dt;
  // Opposing accel = end of a push: brake hard, do not reverse through zero.
  if (a * motionVelocity < 0.0f) {
    motionVelocity *= expf(-FRAME_MOTION_BRAKE_LEAK * dt);
    if (fabsf(motionVelocity) < FRAME_MOTION_STILL_MPS) motionVelocity = 0.0f;
  } else {
    motionVelocity *= expf(-FRAME_MOTION_VEL_LEAK * dt);
  }

  if (motionVelocity > FRAME_MOTION_MAX_SPEED_MPS) {
    motionVelocity = FRAME_MOTION_MAX_SPEED_MPS;
  } else if (motionVelocity < -FRAME_MOTION_MAX_SPEED_MPS) {
    motionVelocity = -FRAME_MOTION_MAX_SPEED_MPS;
  }

  motionCommitted += motionVelocity * dt * FRAME_MOTION_GAIN;
#endif
  publishMotionLive();
}

static void handleZeroCommand() {
  // Host owns orientation zero (app localZero). Firmware only clears probe depth
  // and stops applying a relative qZero — otherwise host+firmware double-zero
  // inverts every gyro axis.
  clearZero();
  clearMotionCumulative();
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"cmd\",\"cmd\":\"ZERO\"}");
#endif
}

static void buildDeviceName() {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_WIFI_SOFTAP);
  snprintf(deviceName, sizeof(deviceName), "ProGenia-Frame-%02X%02X", mac[4], mac[5]);
}

static bool setupSensor() {
  Wire.begin(FRAME_I2C_SDA, FRAME_I2C_SCL);
  Wire.setClock(100000);
  delay(50);
  const uint8_t addresses[] = {0x4A, 0x4B};
  bool found = false;
  for (uint8_t addr : addresses) {
    if (bno08x.begin_I2C(addr, &Wire)) {
#if FRAME_SERIAL_DEBUG
      Serial.printf("{\"event\":\"sensor_found\",\"addr\":\"0x%02X\"}\n", addr);
#endif
      found = true;
      break;
    }
  }
  if (!found) {
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"sensor_error\",\"msg\":\"BNO08x not found\"}");
#endif
    return false;
  }
  Wire.setClock(400000);
  if (!bno08x.enableReport(SH2_GAME_ROTATION_VECTOR, FRAME_WIFI_NOTIFY_INTERVAL_MS * 1000U)) {
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"sensor_error\",\"msg\":\"enableReport GAME_ROTATION failed\"}");
#endif
    return false;
  }
  if (!bno08x.enableReport(SH2_GRAVITY, FRAME_WIFI_NOTIFY_INTERVAL_MS * 1000U)) {
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"sensor_warn\",\"msg\":\"enableReport GRAVITY failed\"}");
#endif
  }
  // Prefer chip linear only — enabling BOTH accel + linear floods the SH2 FIFO
  // and starves GAME_ROTATION (BLE notify drops toward ~1 Hz).
  bool linearOk = bno08x.enableReport(SH2_LINEAR_ACCELERATION, 20000U);
  if (!linearOk) {
#if FRAME_SERIAL_DEBUG
    Serial.println(
        "{\"event\":\"sensor_warn\",\"msg\":\"enableReport LINEAR_ACCELERATION failed\"}");
#endif
    if (!bno08x.enableReport(SH2_ACCELEROMETER, 20000U)) {
#if FRAME_SERIAL_DEBUG
      Serial.println("{\"event\":\"sensor_warn\",\"msg\":\"enableReport ACCELEROMETER failed\"}");
#endif
    }
  } else if (!bno08x.enableReport(SH2_ACCELEROMETER, 100000U)) {
    // Low-rate raw accel only for calibration accuracy bits (10 Hz).
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"sensor_warn\",\"msg\":\"enableReport ACCELEROMETER failed\"}");
#endif
  }
  if (!bno08x.enableReport(SH2_GYROSCOPE_CALIBRATED, 25000U)) {
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"sensor_warn\",\"msg\":\"enableReport GYROSCOPE failed\"}");
#endif
  }
  sh2_setCalConfig(
      calibrationActive ? (SH2_CAL_ACCEL | SH2_CAL_GYRO) : SH2_CAL_ACCEL);
#if FRAME_SERIAL_DEBUG
  Serial.printf(
      "{\"event\":\"sensor_ready\",\"report\":\"GAME_ROTATION+GRAVITY+%s+GYRO\"}\n",
      linearOk ? "LINEAR+ACCEL10" : "ACCEL");
#endif
  return true;
}

#if FRAME_BLE_ENABLED
static void requestFastBleConnParams(uint16_t connHandle) {
  if (bleServer == nullptr || connHandle == 0xFFFF) return;
  // Apple accessory guidelines: min >= 15 ms (multiple of 15 ms), max at
  // least min + 15 ms, latency 0, supervision timeout >= 6 s. The previous
  // 7.5–15 ms / 4 s request was non-compliant and iPadOS could reject or
  // destabilize the link while iPhone/desktop happened to tolerate it.
  bleServer->requestConnParams(
      connHandle,
      FRAME_CONN_INTERVAL_MIN,
      FRAME_CONN_INTERVAL_MAX,
      FRAME_CONN_LATENCY,
      FRAME_CONN_TIMEOUT);
}

static void requestFastBleConnection(uint16_t connHandle) {
  if (connHandle != 0xFFFF) bleConnHandle = connHandle;
  // One compliant LL connection-parameter procedure at a time. Repeating the
  // request every 150 ms caused overlapping LLCP procedures on iPadOS.
  requestFastBleConnParams(bleConnHandle);
}

static void forceBleDisconnect(const char *reason) {
  if (!bleConnected || bleServer == nullptr || bleConnHandle == 0xFFFF) return;
#if FRAME_SERIAL_DEBUG
  Serial.printf("{\"event\":\"ble_force_disc\",\"reason\":\"%s\"}\n", reason);
#endif
  bleServer->disconnect(bleConnHandle);
}

/** Drop ghost centrals that never subscribed or stopped ACKing notifies. */
static void maintainBleLink() {
  if (!bleConnected) return;
  const uint32_t now = millis();
  if (!bleNotifyEnabled) {
    // Connected but never enabled CCCD — free the slot for the next device.
    if (bleConnectedAtMs != 0 && now - bleConnectedAtMs > 12000U) {
      forceBleDisconnect("cccd_timeout");
    }
    return;
  }
  if (lastBleNotifyOkMs != 0 && now - lastBleNotifyOkMs > 4000U) {
    forceBleDisconnect("notify_stale");
  }
}

static void markBleConnected() {
  bleConnectedAtMs = millis();
  bleConnected = true;
  bleNotifyEnabled = false;
  bleNotifyReadyAtMs = 0;
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"ble_connect\"}");
#endif
}

/** Only push IMU notifies after the central writes CCCD (subscribe). */
class OrientationNotifyCallbacks : public BLECharacteristicCallbacks {
  void onStatus(BLECharacteristic *, Status status, uint32_t) override {
    if (status == Status::SUCCESS_NOTIFY) {
      bleNotifyCount++;
      lastBleNotifyOkMs = millis();
    } else if (status == Status::ERROR_GATT ||
               status == Status::ERROR_NO_CLIENT ||
               status == Status::ERROR_NO_SUBSCRIBER) {
      bleNotifyErrorCount++;
    }
  }

  void onSubscribe(BLECharacteristic *, ble_gap_conn_desc *desc,
                   uint16_t subValue) override {
    const bool notifyOn = (subValue & 0x0001) != 0;
    bleNotifyEnabled = notifyOn;
    if (notifyOn) {
      // Short settle so the first ATT notify is not lost on slow centrals (iPad).
      bleNotifyReadyAtMs = millis() + 40;
      lastBleNotifyOkMs = millis();
      if (desc != nullptr) {
        requestFastBleConnection(desc->conn_handle);
      } else {
        requestFastBleConnection(bleConnHandle);
      }
#if FRAME_SERIAL_DEBUG
      Serial.printf("{\"event\":\"ble_cccd\",\"notify\":true,\"sub\":%u}\n", subValue);
#endif
    } else {
      bleNotifyReadyAtMs = 0;
#if FRAME_SERIAL_DEBUG
      Serial.println("{\"event\":\"ble_cccd\",\"notify\":false}");
#endif
    }
  }
};

/** Primary ADV = flags + 128-bit service UUID; name goes in scan response.
 *  Putting both name (~18 B) and UUID128 in the 31 B ADV packet drops the
 *  UUID — then only phones with a cached peripheral id (your iPhone) reconnect;
 *  fresh devices scanning by service never see the frame. */
static void startFrameAdvertising() {
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  if (adv == nullptr) return;

  BLEAdvertisementData advData;
  // LE General Discoverable | BR/EDR not supported
  advData.setFlags(0x06);
  advData.setCompleteServices(BLEUUID(FRAME_SERVICE_UUID));
  adv->setAdvertisementData(advData);

  BLEAdvertisementData scanData;
  scanData.setName(deviceName);
  adv->setScanResponseData(scanData);
  adv->setScanResponse(true);
  // Fast connectable advertising so a second device (iPad) can discover quickly
  // after the first central disconnects. Units = 0.625 ms.
  adv->setMinInterval(0x20);  // 20 ms
  adv->setMaxInterval(0x40);  // 40 ms
  // Apple-compliant preferred interval hint: 15–30 ms.
  adv->setMinPreferred(FRAME_CONN_INTERVAL_MIN);
  adv->setMaxPreferred(FRAME_CONN_INTERVAL_MAX);
  adv->start();
#if FRAME_SERIAL_DEBUG
  Serial.printf(
      "{\"event\":\"ble_adv\",\"name\":\"%s\",\"service\":\"%s\"}\n",
      deviceName, FRAME_SERVICE_UUID);
#endif
}

class FrameBleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { markBleConnected(); }
  void onConnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    // NimBLE path may call only this overload — always mark connected here.
    markBleConnected();
    if (server == nullptr || desc == nullptr) return;
    // Remember the handle; request params after the central enables CCCD.
    bleConnHandle = desc->conn_handle;
  }
  void onConnParamsUpdate(
      uint16_t, uint16_t interval, uint16_t latency,
      uint16_t timeout, uint8_t status) override {
    bleCurIntervalMs = interval * 1.25f;
    bleCurLatency = latency;
    bleCurTimeoutMs = timeout * 10;
#if FRAME_SERIAL_DEBUG
    Serial.printf(
        "{\"event\":\"ble_params\",\"interval_ms\":%.2f,\"latency\":%u,\"timeout_ms\":%u,\"status\":%u}\n",
        interval * 1.25f, latency, timeout * 10, status);
#endif
  }
  void onDisconnect(BLEServer *) override {
    bleConnected = false;
    bleConnectedAtMs = 0;
    bleNotifyEnabled = false;
    bleNotifyReadyAtMs = 0;
    bleConnHandle = 0xFFFF;
    lastBleNotifyOkMs = 0;
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"ble_disconnect\"}");
#endif
    // Brief gap so the controller releases the old link before advertising.
    delay(120);
    startFrameAdvertising();
  }
};

class FrameBleCmdCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const String value = characteristic->getValue();
    // Longer tokens first — CLEAR_ZERO contains ZERO.
    if (value.indexOf("CLEAR_ZERO") >= 0) {
      clearZero();
    } else if (value.indexOf("ZERO") >= 0) {
      handleZeroCommand();
    }
    if (value.indexOf("CAL_START") >= 0) startImuCalibration();
    if (value.indexOf("CAL_CANCEL") >= 0) cancelImuCalibration();
    if (value.indexOf("CAL_SAVE") >= 0) saveImuCalibrationNow();
    if (value.indexOf("CONN_FAST") >= 0) requestFastBleConnection(bleConnHandle);
    if (value.indexOf("REBOOT") >= 0) bleRestartRequested = true;
  }
};

static String jsonExtractString(const String &json, const char *key) {
  const String needle = String("\"") + key + "\":\"";
  const int start = json.indexOf(needle);
  if (start < 0) return "";
  const int from = start + needle.length();
  const int end = json.indexOf('"', from);
  if (end < 0) return "";
  return json.substring(from, end);
}

class FrameBleProvisionCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const String value = characteristic->getValue();
    if (value.length() < 4) return;
    String ssid = jsonExtractString(value, "ssid");
    if (ssid.isEmpty()) ssid = value;
    String pass = jsonExtractString(value, "pass");
    if (pass.isEmpty()) pass = FRAME_STA_PASS;
    if (ssid.isEmpty()) return;
    saveStaCredentials(ssid, pass);
    delay(200);
    ESP.restart();
  }
};

static void setupBleProvision() {
  BLEDevice::init(deviceName);
  // iOS negotiates MTU automatically. The stream packet remains 20 bytes so
  // it also works before negotiation and on conservative centrals.
  BLEDevice::setMTU(185);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new FrameBleServerCallbacks());

  BLEService *service = bleServer->createService(FRAME_SERVICE_UUID);

  bleOrientation = service->createCharacteristic(
      FRAME_ORIENTATION_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  // NimBLE auto-creates CCCD (0x2902) when PROPERTY_NOTIFY is set.
  bleOrientation->setCallbacks(new OrientationNotifyCallbacks());

  BLECharacteristic *provision = service->createCharacteristic(
      FRAME_PROVISION_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  provision->setCallbacks(new FrameBleProvisionCallbacks());

  BLECharacteristic *cmd = service->createCharacteristic(
      FRAME_COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  cmd->setCallbacks(new FrameBleCmdCallbacks());

  service->start();
  // Keep UUID registered for library bookkeeping; payload is forced in
  // startFrameAdvertising() so the 31-byte ADV always carries the service.
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  if (adv != nullptr) adv->addServiceUUID(FRAME_SERVICE_UUID);
  startFrameAdvertising();

#if FRAME_SERIAL_DEBUG
  Serial.printf(
      "{\"event\":\"ble_ready\",\"name\":\"%s\",\"provision\":true,\"imu_notify\":true,\"packet\":20}\n",
      deviceName);
#endif
}

static int16_t quantizeI16(float value, float scale) {
  const float scaled = value * scale;
  if (scaled > 32767.0f) return 32767;
  if (scaled < -32768.0f) return -32768;
  return static_cast<int16_t>(lroundf(scaled));
}

static void putU16LE(uint8_t *out, uint16_t value) {
  out[0] = static_cast<uint8_t>(value & 0xff);
  out[1] = static_cast<uint8_t>((value >> 8) & 0xff);
}

/**
 * BLE IMU v2 — 20 bytes (ATT MTU 23 safe):
 * [0]=0xB2, [1]=version 2, [2..3]=seq,
 * [4..5]=probe depth meters (int16 / 10000),
 * [6..13]=w,x,y,z int16 / 32767, [14..19]=gravity xyz int16 / 2048.
 */
static void pushBleSample(const Quat &q) {
  if (!bleConnected || bleOrientation == nullptr) return;
  // Never notify before CCCD subscribe — flooding pre-subscribe starves iPad
  // ATT and looks like "connected but no IMU".
  if (!bleNotifyEnabled) return;
  if (bleNotifyReadyAtMs != 0 && millis() < bleNotifyReadyAtMs) return;

  uint8_t packet[FRAME_BLE_PACKET_BYTES] = {};
  packet[0] = 0xB2;
  packet[1] =
      0x02 |
      ((accelAccuracy & 0x03) << 2) |
      ((gyroAccuracy & 0x03) << 4) |
      (imuStationary ? 0x40 : 0) |
      (calibrationReady || calibrationSaved ? 0x80 : 0);
  putU16LE(packet + 2, static_cast<uint16_t>(quatSeq));
  putU16LE(packet + 4, static_cast<uint16_t>(
      lroundf(motionLivePosition * 10000.0f) & 0xffff));

  const int16_t values[7] = {
      quantizeI16(q.w, 32767.0f),
      quantizeI16(q.x, 32767.0f),
      quantizeI16(q.y, 32767.0f),
      quantizeI16(q.z, 32767.0f),
      quantizeI16(latestGravity[0], 2048.0f),
      quantizeI16(latestGravity[1], 2048.0f),
      quantizeI16(latestGravity[2], 2048.0f),
  };
  for (int i = 0; i < 7; i++) {
    putU16LE(packet + 6 + i * 2, static_cast<uint16_t>(values[i]));
  }

  bleOrientation->setValue(packet, sizeof(packet));
  bleOrientation->notify();
}
#endif

#if FRAME_WIFI_ENABLED
static void sendCors() {
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  httpServer.sendHeader("Access-Control-Allow-Headers", "*");
  httpServer.sendHeader("Cache-Control", "no-store");
}

static void acceptStreamClient() {
  if (streamActive && !streamClient.connected()) {
    streamClient.stop();
    streamActive = false;
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"stream_disconnect\"}");
#endif
  }

  WiFiClient incoming = streamServer.accept();
  if (!incoming) return;

  // Drain HTTP request headers (timeout 400 ms)
  const uint32_t t0 = millis();
  bool headersDone = false;
  while (incoming.connected() && (millis() - t0) < 400) {
    while (incoming.available()) {
      String line = incoming.readStringUntil('\n');
      if (line.length() <= 1 || line == "\r") {
        headersDone = true;
        break;
      }
    }
    if (headersDone) break;
    delay(1);
  }

  if (streamActive) {
    streamClient.stop();
    streamActive = false;
  }

  incoming.setNoDelay(true);
  incoming.print(
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: application/x-ndjson\r\n"
      "Transfer-Encoding: chunked\r\n"
      "Access-Control-Allow-Origin: *\r\n"
      "Cache-Control: no-cache, no-transform\r\n"
      "X-Accel-Buffering: no\r\n"
      "Connection: keep-alive\r\n"
      "\r\n");
  streamClient = incoming;
  streamActive = true;
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"stream_connect\"}");
#endif
}

static bool writeChunk(WiFiClient &c, const char *data, int n) {
  char hdr[16];
  const int hn = snprintf(hdr, sizeof(hdr), "%x\r\n", n);
  return c.write(reinterpret_cast<const uint8_t *>(hdr), hn) == (size_t)hn &&
         c.write(reinterpret_cast<const uint8_t *>(data), n) == (size_t)n &&
         c.write(reinterpret_cast<const uint8_t *>("\r\n"), 2) == 2;
}

static int formatQuatLine(const Quat &q, char *line, size_t cap) {
  int n = 0;
  if (hasGravitySample && hasLinearAccelSample && hasGyroSample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"ax\":%.4f,\"ay\":%.4f,\"az\":%.4f,"
                 "\"wx\":%.4f,\"wy\":%.4f,\"wz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, motionLivePosition,
                 latestGravity[0], latestGravity[1], latestGravity[2],
                 latestLinearAccel[0], latestLinearAccel[1], latestLinearAccel[2],
                 latestGyro[0], latestGyro[1], latestGyro[2]);
  } else if (hasGravitySample && hasLinearAccelSample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"ax\":%.4f,\"ay\":%.4f,\"az\":%.4f}\n",
                 q.w, q.x, q.y, q.z, motionLivePosition,
                 latestGravity[0], latestGravity[1], latestGravity[2],
                 latestLinearAccel[0], latestLinearAccel[1], latestLinearAccel[2]);
  } else if (hasGravitySample && hasGyroSample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"wx\":%.4f,\"wy\":%.4f,\"wz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, motionLivePosition,
                 latestGravity[0], latestGravity[1], latestGravity[2],
                 latestGyro[0], latestGyro[1], latestGyro[2]);
  } else if (hasGravitySample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, motionLivePosition,
                 latestGravity[0], latestGravity[1], latestGravity[2]);
  } else {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f}\n",
                 q.w, q.x, q.y, q.z, motionLivePosition);
  }
  if (n > 0 && (size_t)n < cap) return n;
  return snprintf(line, cap,
                  "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"dp\":%.4f}\n",
                  q.w, q.x, q.y, q.z, motionLivePosition);
}

static void acceptRawClient() {
  if (rawActive && !rawClient.connected()) {
    rawClient.stop();
    rawActive = false;
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"raw_disconnect\"}");
#endif
  }

  WiFiClient incoming = rawServer.accept();
  if (!incoming) return;

  if (rawActive) {
    rawClient.stop();
    rawActive = false;
  }
  incoming.setNoDelay(true);
  rawClient = incoming;
  rawActive = true;
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"raw_connect\"}");
#endif
}

static void pushRawSample(const Quat &q) {
  if (!rawActive) return;
  if (!rawClient.connected()) {
    rawClient.stop();
    rawActive = false;
    return;
  }
  char line[FRAME_JSON_LINE_CAP];
  const int n = formatQuatLine(q, line, sizeof(line));
  if (n <= 0 || rawClient.write(reinterpret_cast<const uint8_t *>(line), n) != (size_t)n) {
    rawClient.stop();
    rawActive = false;
    return;
  }
  rawClient.flush();
  streamPushes++;
}

static void pushUdpTo(IPAddress ip, const uint8_t *data, int n) {
  if (!udp.beginPacket(ip, FRAME_UDP_STREAM_PORT)) return;
  udp.write(data, n);
  udp.endPacket();
}

static void pushUdpSample(const Quat &q) {
  char line[FRAME_JSON_LINE_CAP];
  const int n = formatQuatLine(q, line, sizeof(line));
  if (n <= 0) return;
  const auto *bytes = reinterpret_cast<const uint8_t *>(line);
  if (wifiStaMode && WiFi.status() == WL_CONNECTED) {
    // iPhone Personal Hotspot: phone is the gateway — high rate works here
    const IPAddress gw = WiFi.gatewayIP();
    if (gw != IPAddress(0, 0, 0, 0)) {
      pushUdpTo(gw, bytes, n);
      streamPushes++;
      return;
    }
  }
  // SoftAP fallback (iOS SoftAP client often ~1–2 Hz due to Wi‑Fi PS)
  pushUdpTo(IPAddress(192, 168, 4, 2), bytes, n);
  pushUdpTo(IPAddress(192, 168, 4, 255), bytes, n);
  streamPushes++;
}

static void pushStreamSample(const Quat &q) {
  if (!streamActive) return;
  if (!streamClient.connected()) {
    streamClient.stop();
    streamActive = false;
    return;
  }
  char line[FRAME_JSON_LINE_CAP];
  const int n = formatQuatLine(q, line, sizeof(line));
  if (n <= 0 || !writeChunk(streamClient, line, n)) {
    streamClient.stop();
    streamActive = false;
    return;
  }
  streamClient.flush();
  streamPushes++;
}

static IPAddress wifiIp() {
  return wifiStaMode ? WiFi.localIP() : WiFi.softAPIP();
}

static bool startSta(const char *ssid, const char *pass) {
  if (!ssid || !ssid[0]) return false;
#if FRAME_BLE_ENABLED
  if (bleConnected) return false;
#endif
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.begin(ssid, pass);
  staAttemptStartedMs = millis();
  staAttemptActive = true;
#if FRAME_SERIAL_DEBUG
  Serial.printf("{\"event\":\"wifi_sta\",\"connecting\":true,\"ssid\":\"%s\"}\n", ssid);
#endif
  return false;
}

static bool startSoftAp() {
#if FRAME_BLE_ENABLED
  if (bleConnected) return false;
#endif
  wifiStaMode = false;
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  const bool ok = WiFi.softAP(deviceName, FRAME_WIFI_PASSWORD, 6, 0, 4);
  delay(200);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  esp_wifi_set_ps(WIFI_PS_NONE);
  wifi_config_t cfg{};
  if (esp_wifi_get_config(WIFI_IF_AP, &cfg) == ESP_OK) {
    cfg.ap.beacon_interval = 100;
    cfg.ap.dtim_period = 1;
    esp_wifi_set_config(WIFI_IF_AP, &cfg);
  }
#if FRAME_SERIAL_DEBUG
  Serial.printf(
      "{\"event\":\"wifi_ap\",\"ok\":%s,\"ssid\":\"%s\",\"ip\":\"%s\",\"pass\":\"%s\"}\n",
      ok ? "true" : "false", deviceName, WiFi.softAPIP().toString().c_str(), FRAME_WIFI_PASSWORD);
#endif
  return ok;
}

  static void setupWifi() {
  Preferences prefs;
  prefs.begin("frame", true);
  pendingStaSsid = prefs.getString("sta_ssid", FRAME_STA_SSID);
  pendingStaPass = prefs.getString("sta_pass", FRAME_STA_PASS);
  prefs.end();

  // BLE before Wi‑Fi — better coexistence on ESP32-C3 when STA + advertise together.
#if FRAME_BLE_ENABLED
  setupBleProvision();
  // BLE is the primary transport. Starting STA/SoftAP before a central
  // connects makes the first ESP32-C3 BLE session stall when Wi-Fi is torn
  // down. Keep the shared 2.4 GHz radio exclusively in BLE mode.
  frameMode = FRAME_MODE_STREAM;
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"radio\",\"mode\":\"ble_exclusive\"}");
#endif
  return;
#endif

  if (pendingStaSsid.length() == 0) {
    frameMode = FRAME_MODE_PROVISION;
#if FRAME_SOFTAP_ENABLED
    startSoftAp();
#endif
  } else {
    frameMode = FRAME_MODE_STREAM;
    // Connection progresses in loop(); blocking here starves BLE notifications.
    startSta(pendingStaSsid.c_str(), pendingStaPass.c_str());
  }

  if (frameMode == FRAME_MODE_PROVISION && !FRAME_SOFTAP_ENABLED) {
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"wifi\",\"mode\":\"ble_provision_only\"}");
#endif
    return;
  }

  httpServer.on("/", []() {
    char body[320];
    snprintf(body, sizeof(body),
             "{\"ok\":true,\"name\":\"%s\",\"mode\":\"%s\",\"ip\":\"%s\",\"udp\":%u,\"raw\":%u,\"seq\":%lu}",
             deviceName, wifiStaMode ? "sta" : "softap", wifiIp().toString().c_str(), FRAME_UDP_STREAM_PORT,
             FRAME_RAW_STREAM_PORT, (unsigned long)quatSeq);
    sendCors();
    httpServer.send(200, "application/json", body);
  });
  httpServer.on("/health", []() {
    sendCors();
    httpServer.send(200, "text/plain", "ok");
  });
  httpServer.on("/status", []() {
    char body[280];
    snprintf(body, sizeof(body),
             "{\"mode\":\"%s\",\"ip\":\"%s\",\"gw\":\"%s\",\"ssid\":\"%s\",\"udp\":%u,\"seq\":%lu}",
             wifiStaMode ? "sta" : "softap", wifiIp().toString().c_str(),
             wifiStaMode ? WiFi.gatewayIP().toString().c_str() : "192.168.4.1", deviceName,
             FRAME_UDP_STREAM_PORT, (unsigned long)quatSeq);
    sendCors();
    httpServer.send(200, "application/json", body);
  });
  httpServer.on("/quat", HTTP_OPTIONS, []() {
    sendCors();
    httpServer.send(204);
  });
  httpServer.on("/quat", HTTP_GET, []() {
    httpHits++;
    char body[160];
    snprintf(body, sizeof(body),
             "{\"w\":%.6f,\"x\":%.6f,\"y\":%.6f,\"z\":%.6f,\"seq\":%lu}",
             latestQ.w, latestQ.x, latestQ.y, latestQ.z, (unsigned long)quatSeq);
    sendCors();
    httpServer.send(200, "application/json", body);
  });
  auto zeroHandler = []() {
    handleZeroCommand();
    sendCors();
    httpServer.send(200, "application/json", "{\"ok\":true,\"cmd\":\"ZERO\"}");
  };
  httpServer.on("/zero", HTTP_OPTIONS, []() {
    sendCors();
    httpServer.send(204);
  });
  httpServer.on("/zero", HTTP_GET, zeroHandler);
  httpServer.on("/zero", HTTP_POST, zeroHandler);

  // Provision iPhone hotspot credentials → reboot into STA
  httpServer.on("/sta", HTTP_OPTIONS, []() {
    sendCors();
    httpServer.send(204);
  });
  httpServer.on("/sta", HTTP_POST, []() {
    String ssid = httpServer.arg("ssid");
    String pass = httpServer.arg("pass");
    if (ssid.isEmpty()) {
      sendCors();
      httpServer.send(400, "application/json", "{\"ok\":false,\"err\":\"ssid\"}");
      return;
    }
    if (pass.isEmpty()) pass = FRAME_STA_PASS;
    saveStaCredentials(ssid, pass);
    sendCors();
    httpServer.send(200, "application/json", "{\"ok\":true,\"rebooting\":true,\"mode\":\"sta\"}");
    delay(400);
    ESP.restart();
  });
  httpServer.on("/sta/clear", HTTP_POST, []() {
    Preferences p;
    p.begin("frame", false);
    p.remove("sta_ssid");
    p.remove("sta_pass");
    p.end();
    sendCors();
    httpServer.send(200, "application/json", "{\"ok\":true,\"rebooting\":true,\"mode\":\"softap\"}");
    delay(400);
    ESP.restart();
  });

  httpServer.begin();
  streamServer.begin();
  rawServer.begin();
  udp.begin(FRAME_UDP_STREAM_PORT);
}

static void maybeRetrySta() {
#if FRAME_BLE_ENABLED
  return;
#endif
  if (frameMode != FRAME_MODE_STREAM) return;
#if FRAME_BLE_ENABLED
  if (bleConnected) {
    staAttemptActive = false;
    return;
  }
#endif
  const uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiStaMode) {
      wifiStaMode = true;
      staAttemptActive = false;
      if (MDNS.begin("progenia-frame")) {
        MDNS.addService("http", "tcp", FRAME_HTTP_PORT);
      }
#if FRAME_SERIAL_DEBUG
      Serial.printf("{\"event\":\"wifi_sta\",\"ok\":true,\"ssid\":\"%s\",\"ip\":\"%s\",\"gw\":\"%s\"}\n",
                    pendingStaSsid.c_str(), WiFi.localIP().toString().c_str(),
                    WiFi.gatewayIP().toString().c_str());
#endif
    }
    return;
  }
  if (staAttemptActive) {
    if (now - staAttemptStartedMs < 10000) return;
    WiFi.disconnect(true, false);
    staAttemptActive = false;
    wifiStaMode = false;
    lastStaRetryMs = now;
#if FRAME_SERIAL_DEBUG
    Serial.printf("{\"event\":\"wifi_sta\",\"ok\":false,\"ssid\":\"%s\"}\n", pendingStaSsid.c_str());
#endif
    return;
  }
  if (now - lastStaRetryMs < 3000) return;
  lastStaRetryMs = now;
  if (pendingStaSsid.length() == 0) return;
  startSta(pendingStaSsid.c_str(), pendingStaPass.c_str());
}
#endif

void setup() {
  Serial.begin(115200);
  delay(300);
  buildDeviceName();
  loadZero();
  sensorReady = setupSensor();
#if FRAME_WIFI_ENABLED
  setupWifi();
#endif
  lastHzMs = millis();
#if FRAME_SERIAL_DEBUG
  Serial.printf(
      "{\"event\":\"boot\",\"mode\":\"%s\",\"zero\":%s,\"cal_active\":%s}\n",
      frameMode == FRAME_MODE_STREAM ? "stream" : "provision",
      hasZero ? "true" : "false",
      calibrationActive ? "true" : "false");
#endif
}

void loop() {
#if FRAME_BLE_ENABLED
  maintainBleLink();
  if (bleRestartRequested) {
    delay(100);
    ESP.restart();
  }
  // Watchdog: if no central holds the link, keep advertising discoverable.
  // Ghost links / failed startAdvertising after disconnect leave the frame
  // invisible to every phone except one that already cached the peripheral.
  {
    static uint32_t lastAdvWatchdogMs = 0;
    const uint32_t nowMs = millis();
    if (!bleConnected && (nowMs - lastAdvWatchdogMs) > 2500U) {
      lastAdvWatchdogMs = nowMs;
      startFrameAdvertising();
    }
  }
#endif
#if FRAME_WIFI_ENABLED
  // BLE streaming gets exclusive use of the 2.4 GHz radio. This avoids the
  // coexistence jitter that caused prior BLE experiments to stall near 18 Hz.
#if FRAME_BLE_ENABLED
  if (bleConnected && !wifiSuspendedForBle) {
    wifiSuspendedForBle = true;
  } else if (!bleConnected && wifiSuspendedForBle) {
    wifiSuspendedForBle = false;
    lastStaRetryMs = 0;
  }
#endif
  maybeRetrySta();
  if (!FRAME_BLE_ENABLED && (frameMode == FRAME_MODE_STREAM || FRAME_SOFTAP_ENABLED)) {
    httpServer.handleClient();
    acceptStreamClient();
    acceptRawClient();
  }
#endif

  if (!sensorReady) {
    delay(500);
    sensorReady = setupSensor();
    return;
  }

  sh2_SensorValue_t event;
  if (!bno08x.getSensorEvent(&event)) {
    delay(0);
    return;
  }
  if (event.sensorId == SH2_GRAVITY) {
    latestGravity[0] = event.un.gravity.x;
    latestGravity[1] = event.un.gravity.y;
    latestGravity[2] = event.un.gravity.z;
    hasGravitySample = true;
    updateCalibrationState();
    return;
  }
  if (event.sensorId == SH2_ACCELEROMETER) {
    accelAccuracy = event.status & 0x03;
    // Fallback linear = raw − gravity when chip LINEAR is missing/stale.
    float fallback[3];
    if (hasGravitySample) {
      fallback[0] = event.un.accelerometer.x - latestGravity[0];
      fallback[1] = event.un.accelerometer.y - latestGravity[1];
      fallback[2] = event.un.accelerometer.z - latestGravity[2];
    } else {
      fallback[0] = event.un.accelerometer.x;
      fallback[1] = event.un.accelerometer.y;
      fallback[2] = event.un.accelerometer.z;
    }
    const uint32_t now = millis();
    const bool chipStale =
        !chipLinearAlive || (now - lastChipLinearMs) > FRAME_MOTION_LINEAR_STALE_MS;
    if (chipStale) {
      latestLinearAccel[0] = fallback[0];
      latestLinearAccel[1] = fallback[1];
      latestLinearAccel[2] = fallback[2];
      hasLinearAccelSample = true;
      updateLinearGesture(latestLinearAccel, now);
    }
    updateCalibrationState();
    return;
  }
  if (event.sensorId == SH2_LINEAR_ACCELERATION) {
    latestLinearAccel[0] = event.un.linearAcceleration.x;
    latestLinearAccel[1] = event.un.linearAcceleration.y;
    latestLinearAccel[2] = event.un.linearAcceleration.z;
    hasLinearAccelSample = true;
    chipLinearAlive = true;
    lastChipLinearMs = millis();
    updateLinearGesture(latestLinearAccel, lastChipLinearMs);
    return;
  }
  if (event.sensorId == SH2_GYROSCOPE_CALIBRATED) {
    latestGyro[0] = event.un.gyroscope.x;
    latestGyro[1] = event.un.gyroscope.y;
    latestGyro[2] = event.un.gyroscope.z;
    hasGyroSample = true;
    gyroAccuracy = event.status & 0x03;
    updateCalibrationState();
    return;
  }
  if (event.sensorId != SH2_GAME_ROTATION_VECTOR) return;

  Quat qImu = {
      event.un.gameRotationVector.real,
      event.un.gameRotationVector.i,
      event.un.gameRotationVector.j,
      event.un.gameRotationVector.k,
  };
  if (!quatFinite(qImu)) return;

  Quat qOut = applyCalibration(quatNormalize(qImu));
  const uint32_t now = millis();
  const uint32_t sampleGap =
      (frameMode == FRAME_MODE_STREAM) ? FRAME_WIFI_NOTIFY_INTERVAL_MS : FRAME_NOTIFY_INTERVAL_MS;
  if (now - lastSampleMs < sampleGap) return;
  lastSampleMs = now;

  packQuat(qOut, latestQuat);
  latestQ = qOut;
  quatSeq++;

#if FRAME_BLE_ENABLED
  pushBleSample(qOut);
#endif

#if FRAME_WIFI_ENABLED
  if (frameMode == FRAME_MODE_STREAM && WiFi.status() == WL_CONNECTED) {
    pushUdpSample(qOut);
    pushStreamSample(qOut);
    pushRawSample(qOut);
  }
#endif

  sampleCount++;
  if (now - lastHzMs >= 1000) {
#if FRAME_SERIAL_DEBUG
    // Never block the IMU loop when USB has no reader (classic ~1 Hz BLE symptom).
    if (Serial.availableForWrite() >= 128) {
      Serial.printf(
          "{\"w\":%.4f,\"x\":%.4f,\"y\":%.4f,\"z\":%.4f,\"hz\":%lu,\"ble_hz\":%lu,\"ble_err\":%lu,"
          "\"ci_ms\":%.1f,\"lat\":%u,\"sto_ms\":%u,"
          "\"stream_hz\":%lu,\"http_hits\":%lu,\"stream\":%s}\n",
          qOut.w, qOut.x, qOut.y, qOut.z, (unsigned long)sampleCount, (unsigned long)bleNotifyCount,
          (unsigned long)bleNotifyErrorCount,
          bleCurIntervalMs, bleCurLatency, bleCurTimeoutMs,
          (unsigned long)streamPushes,
          (unsigned long)httpHits, streamActive ? "true" : "false");
    }
#endif
    sampleCount = 0;
    streamPushes = 0;
    bleNotifyCount = 0;
    bleNotifyErrorCount = 0;
    httpHits = 0;
    lastHzMs = now;
  }
}
