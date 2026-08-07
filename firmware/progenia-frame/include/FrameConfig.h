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

/** NDJSON line buffer — quat + gx/gy/gz + ax/ay/az + wx/wy/wz (~220 bytes). */
#ifndef FRAME_JSON_LINE_CAP
#define FRAME_JSON_LINE_CAP 256
#endif

#ifndef FRAME_NOTIFY_INTERVAL_MS
#define FRAME_NOTIFY_INTERVAL_MS 20 // BLE IMU stream: 50 Hz
#endif

/** Versioned BLE packet is exactly 20 bytes, so it works even with ATT MTU 23. */
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

static const uint16_t FRAME_CONN_INTERVAL_MIN = 12;
static const uint16_t FRAME_CONN_INTERVAL_MAX = 24;
static const uint16_t FRAME_CONN_LATENCY = 0;
static const uint16_t FRAME_CONN_TIMEOUT = 400;
