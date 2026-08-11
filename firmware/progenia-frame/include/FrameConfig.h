#pragma once

#include <stdint.h>

static const char *const FRAME_SERVICE_UUID = "6fbe1d30-9a2c-4f1e-9c3a-7b2e1a0d4f01";
static const char *const FRAME_ORIENTATION_UUID = "6fbe1d31-9a2c-4f1e-9c3a-7b2e1a0d4f01";
static const char *const FRAME_COMMAND_UUID = "6fbe1d32-9a2c-4f1e-9c3a-7b2e1a0d4f01";
static const char *const FRAME_PROVISION_UUID = "6fbe1d34-9a2c-4f1e-9c3a-7b2e1a0d4f01";

#ifndef FRAME_WIFI_ENABLED
#define FRAME_WIFI_ENABLED 1
#endif

#ifndef FRAME_BLE_ENABLED
#define FRAME_BLE_ENABLED 1
#endif

#ifndef FRAME_SOFTAP_ENABLED
#define FRAME_SOFTAP_ENABLED 0
#endif

#ifndef FRAME_WIFI_PASSWORD
#define FRAME_WIFI_PASSWORD "progenia1"
#endif

/** Optional compile-time STA (iPhone Personal Hotspot). Empty → NVS or SoftAP. */
#ifndef FRAME_STA_SSID
#define FRAME_STA_SSID ""
#endif
#ifndef FRAME_STA_PASS
#define FRAME_STA_PASS "progenia1"
#endif

#ifndef FRAME_HTTP_PORT
#define FRAME_HTTP_PORT 80
#endif

/** HTTP NDJSON chunked stream (WKWebView; often buffered) */
#ifndef FRAME_STREAM_PORT
#define FRAME_STREAM_PORT 82
#endif

/** Raw TCP NDJSON (native iOS plugin) */
#ifndef FRAME_RAW_STREAM_PORT
#define FRAME_RAW_STREAM_PORT 83
#endif

/** UDP broadcast NDJSON (preferred on iOS SoftAP) */
#ifndef FRAME_UDP_STREAM_PORT
#define FRAME_UDP_STREAM_PORT 9091
#endif

#ifndef FRAME_WIFI_NOTIFY_INTERVAL_MS
#define FRAME_WIFI_NOTIFY_INTERVAL_MS 20 // 50 Hz
#endif

/** NDJSON line buffer — quat + dp + gx/gy/gz + ax/ay/az + wx/wy/wz. */
#ifndef FRAME_JSON_LINE_CAP
#define FRAME_JSON_LINE_CAP 288
#endif

#ifndef FRAME_NOTIFY_INTERVAL_MS
#define FRAME_NOTIFY_INTERVAL_MS 20 // BLE IMU stream: 50 Hz
#endif

/**
 * One-axis gesture controller. Project linear acceleration onto world vertical
 * using gravity, lock direction on the first impulse, and map gesture effort
 * directly to depth rate. This avoids double-integration drift entirely.
 */
#define FRAME_MOTION_GESTURE_RATE_CONTROL 1
#define FRAME_MOTION_WORLD_VERTICAL 1
#define FRAME_MOTION_RATE_M_PER_MPS2_S 0.72f
#define FRAME_MOTION_RATE_MIN_MPS 0.055f
#define FRAME_MOTION_RATE_MAX_MPS 0.38f
#define FRAME_MOTION_RATE_ATTACK 0.82f
#define FRAME_MOTION_RATE_DECAY 3.0f
#define FRAME_MOTION_MAX_GYRO_RAD_S 1.10f
#define FRAME_MOTION_MAX_DISPLACEMENT_M 0.30f
#define FRAME_MOTION_GAIN 1.5f
#define FRAME_MOTION_ACCEL_DEADZONE 0.0035f
#define FRAME_MOTION_START_MPS2 0.008f
#define FRAME_MOTION_QUIET_MPS2 0.014f
#define FRAME_MOTION_QUIET_GYRO_RAD_S 0.08f
#define FRAME_MOTION_ZUPT_MS 120U
#define FRAME_MOTION_BIAS_HOLD_MS 350U
#define FRAME_MOTION_BIAS_BLEND 0.025f
/** Light LPF — heavy filtering was the main source of push lag. */
#define FRAME_MOTION_ACCEL_LPF 0.58f
/** Soft leak while coasting in the same direction. */
#define FRAME_MOTION_VEL_LEAK 0.65f
/** Hard brake when accel opposes velocity (stops reverse/"invert" on decel). */
#define FRAME_MOTION_BRAKE_LEAK 12.0f
/** ZUPT: treat as still below these. */
#define FRAME_MOTION_STOP_MPS2 0.022f
#define FRAME_MOTION_STILL_MPS 0.012f
#define FRAME_MOTION_MAX_SPEED_MPS 0.90f
/** Legacy integrator fallback axis when gesture-rate control is disabled. */
#define FRAME_MOTION_AXIS_FIXED_Z 1
/** Fall back to accel−gravity if chip linear stalls. */
#define FRAME_MOTION_LINEAR_STALE_MS 120U

/** BLE IMU v2 — 20 bytes (works with default ATT MTU 23). */
#ifndef FRAME_BLE_PACKET_BYTES
#define FRAME_BLE_PACKET_BYTES 20
#endif

#ifndef FRAME_SERIAL_DEBUG
#define FRAME_SERIAL_DEBUG 0
#endif

#define FRAME_I2C_SDA D4
#define FRAME_I2C_SCL D5

struct MountQuat {
  float w;
  float x;
  float y;
  float z;
};

static const MountQuat FRAME_MOUNT_QUAT = {1.0f, 0.0f, 0.0f, 0.0f};

/** Apple-compliant BLE parameters: 15–30 ms, latency 0, timeout 6 s. */
static const uint16_t FRAME_CONN_INTERVAL_MIN = 12;  // 12 * 1.25 ms = 15 ms
static const uint16_t FRAME_CONN_INTERVAL_MAX = 24;  // 24 * 1.25 ms = 30 ms
static const uint16_t FRAME_CONN_LATENCY = 0;
static const uint16_t FRAME_CONN_TIMEOUT = 600;      // 600 * 10 ms = 6 s
