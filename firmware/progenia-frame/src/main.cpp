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
static volatile bool bleRestartRequested = false;
static uint32_t bleNotifyCount = 0;
static bool wifiSuspendedForBle = false;
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

static void setZeroFromFrame(const Quat &qFrame) {
  qZero = quatNormalize(qFrame);
  hasZero = true;
  captureZeroNext = false;
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

static void packQuat(const Quat &q, uint8_t out[16]) {
  float vals[4] = {q.w, q.x, q.y, q.z};
  memcpy(out, vals, 16);
}

static void handleZeroCommand() {
  captureZeroNext = true;
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
#if FRAME_SERIAL_DEBUG
  Serial.println("{\"event\":\"sensor_ready\",\"report\":\"GAME_ROTATION+GRAVITY\"}");
#endif
  return true;
}

#if FRAME_BLE_ENABLED
class FrameBleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    bleConnectedAtMs = millis();
    bleConnected = true;
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"ble_connect\"}");
#endif
  }
  void onConnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    server->requestConnParams(
        desc->conn_handle,
        12,  // 15 ms
        24,  // 30 ms
        0,
        400  // 4 s supervision timeout
    );
  }
  void onConnParamsUpdate(
      uint16_t, uint16_t interval, uint16_t latency,
      uint16_t timeout, uint8_t status) override {
#if FRAME_SERIAL_DEBUG
    Serial.printf(
        "{\"event\":\"ble_params\",\"interval_ms\":%.2f,\"latency\":%u,\"timeout_ms\":%u,\"status\":%u}\n",
        interval * 1.25f, latency, timeout * 10, status);
#endif
  }
  void onDisconnect(BLEServer *) override {
    bleConnected = false;
    bleConnectedAtMs = 0;
#if FRAME_SERIAL_DEBUG
    Serial.println("{\"event\":\"ble_disconnect\"}");
#endif
    BLEDevice::startAdvertising();
  }
};

class FrameBleCmdCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const String value = characteristic->getValue();
    if (value.indexOf("ZERO") >= 0) handleZeroCommand();
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

  BLECharacteristic *provision = service->createCharacteristic(
      FRAME_PROVISION_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  provision->setCallbacks(new FrameBleProvisionCallbacks());

  BLECharacteristic *cmd = service->createCharacteristic(
      FRAME_COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  cmd->setCallbacks(new FrameBleCmdCallbacks());

  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(FRAME_SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

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
 * BLE IMU v2 — exactly 20 bytes (works with default ATT MTU 23):
 * [0]=0xB2, [1]=version 2, [2..3]=seq, [4..5]=millis low16,
 * [6..13]=w,x,y,z int16 / 32767, [14..19]=gravity xyz int16 / 2048.
 */
static void pushBleSample(const Quat &q) {
  if (!bleConnected || bleOrientation == nullptr) return;
  // Let the first connection-event/CCCD exchange settle before filling the
  // Bluedroid notification queue. Without this, a cold first connection can
  // deliver 2–3 packets and then remain congested.
  if (millis() - bleConnectedAtMs < 750) return;

  uint8_t packet[FRAME_BLE_PACKET_BYTES] = {};
  packet[0] = 0xB2;
  packet[1] = 0x02;
  putU16LE(packet + 2, static_cast<uint16_t>(quatSeq));
  putU16LE(packet + 4, static_cast<uint16_t>(millis()));

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
  bleNotifyCount++;
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
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"ax\":%.4f,\"ay\":%.4f,\"az\":%.4f,"
                 "\"wx\":%.4f,\"wy\":%.4f,\"wz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, latestGravity[0], latestGravity[1], latestGravity[2],
                 latestLinearAccel[0], latestLinearAccel[1], latestLinearAccel[2],
                 latestGyro[0], latestGyro[1], latestGyro[2]);
  } else if (hasGravitySample && hasLinearAccelSample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"ax\":%.4f,\"ay\":%.4f,\"az\":%.4f}\n",
                 q.w, q.x, q.y, q.z, latestGravity[0], latestGravity[1], latestGravity[2],
                 latestLinearAccel[0], latestLinearAccel[1], latestLinearAccel[2]);
  } else if (hasGravitySample && hasGyroSample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,"
                 "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
                 "\"wx\":%.4f,\"wy\":%.4f,\"wz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, latestGravity[0], latestGravity[1], latestGravity[2],
                 latestGyro[0], latestGyro[1], latestGyro[2]);
  } else if (hasGravitySample) {
    n = snprintf(line, cap,
                 "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f,\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f}\n",
                 q.w, q.x, q.y, q.z, latestGravity[0], latestGravity[1], latestGravity[2]);
  } else {
    n = snprintf(line, cap, "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f}\n", q.w, q.x, q.y, q.z);
  }
  if (n > 0 && (size_t)n < cap) return n;
  return snprintf(line, cap, "{\"w\":%.5f,\"x\":%.5f,\"y\":%.5f,\"z\":%.5f}\n", q.w, q.x, q.y, q.z);
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
  sensorReady = setupSensor();
#if FRAME_WIFI_ENABLED
  setupWifi();
#endif
  lastHzMs = millis();
#if FRAME_SERIAL_DEBUG
  Serial.printf("{\"event\":\"boot\",\"mode\":\"%s\"}\n",
                frameMode == FRAME_MODE_STREAM ? "stream" : "provision");
#endif
}

void loop() {
#if FRAME_BLE_ENABLED
  if (bleRestartRequested) {
    delay(100);
    ESP.restart();
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
    return;
  }
  if (event.sensorId == SH2_LINEAR_ACCELERATION) {
    latestLinearAccel[0] = event.un.linearAcceleration.x;
    latestLinearAccel[1] = event.un.linearAcceleration.y;
    latestLinearAccel[2] = event.un.linearAcceleration.z;
    hasLinearAccelSample = true;
    return;
  }
  if (event.sensorId == SH2_GYROSCOPE_CALIBRATED) {
    latestGyro[0] = event.un.gyroscope.x;
    latestGyro[1] = event.un.gyroscope.y;
    latestGyro[2] = event.un.gyroscope.z;
    hasGyroSample = true;
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
    Serial.printf(
        "{\"w\":%.4f,\"x\":%.4f,\"y\":%.4f,\"z\":%.4f,\"hz\":%lu,\"ble_hz\":%lu,\"stream_hz\":%lu,\"http_hits\":%lu,\"stream\":%s}\n",
        qOut.w, qOut.x, qOut.y, qOut.z, (unsigned long)sampleCount, (unsigned long)bleNotifyCount,
        (unsigned long)streamPushes, (unsigned long)httpHits, streamActive ? "true" : "false");
#endif
    sampleCount = 0;
    streamPushes = 0;
    bleNotifyCount = 0;
    httpHits = 0;
    lastHzMs = now;
  }
}
