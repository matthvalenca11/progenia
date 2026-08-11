# ProGenia Frame — BLE GATT Protocol

Protocol between the ESP32-C6 physical frame (BNO085) and the ProGenia Capacitor app.

## Device identity

| Field | Value |
|-------|-------|
| Advertising name | `ProGenia-Frame-XXXX` where `XXXX` is the last 2 bytes of the BLE MAC in hex |
| Role | Peripheral (GATT server) |
| Preferred connection interval | 15–30 ms (iOS chooses the effective value) |
| Notify rate | 50 Hz / 20 ms |

## UUIDs (128-bit, little-endian wire order as BLE standard)

| Role | UUID |
|------|------|
| Service | `6fbe1d30-9a2c-4f1e-9c3a-7b2e1a0d4f01` |
| Orientation (notify + read) | `6fbe1d31-9a2c-4f1e-9c3a-7b2e1a0d4f01` |
| Command (write) | `6fbe1d32-9a2c-4f1e-9c3a-7b2e1a0d4f01` |
| Wi-Fi provision (write) | `6fbe1d34-9a2c-4f1e-9c3a-7b2e1a0d4f01` |

## Orientation characteristic

- Properties: `NOTIFY`, `READ`
- Payload: **20 bytes**, fixed-size little-endian BLE IMU v2
- It fits the default ATT MTU 23 (`20 = MTU - 3`), so streaming does not depend on MTU negotiation
- Source sensor report: `SH2_GAME_ROTATION_VECTOR` (relative orientation, no magnetometer)
- Gravity source: `SH2_GRAVITY`
- Quaternion is unit-normalized on the firmware before notify
- Convention on the wire: sensor / mount-corrected frame quaternion (see calibration doc)
- Invalid / not-ready samples are **not** notified

### Packet layout

| Offset | Size | Field | Encoding |
|---:|---:|---|---|
| 0 | 1 | Magic | `0xB2` |
| 1 | 1 | Version + flags | bits 0–1: `2`; bits 2–3 accel accuracy; bits 4–5 gyro accuracy; bit 6 stationary; bit 7 calibration ready |
| 2 | 2 | Sequence | `uint16` |
| 4 | 2 | Probe depth | signed cumulative `int16 / 10000`, meters along moldura normal (IMU +Z continuous integrate + ZUPT; chip linear accel) |
| 6 | 8 | Quaternion `w,x,y,z` | `int16 / 32767` |
| 14 | 6 | Gravity `gx,gy,gz` | `int16 / 2048`, m/s² |

Packet size is **20 bytes**. Gyro/orientation drives the cut plane pose; the depth field is the single accel axis (push/pull).

Sequence gaps are allowed and must be counted; live rendering always prefers the newest sample.

### Data plane on iOS

CoreBluetooth is implemented inside `ProgeniaArFramePlugin.swift`. It parses notifications
natively and publishes 40-byte binary IMU WS v3 frames through `ws://127.0.0.1:19091`
(quat + gravity + calibration flags + linear gesture position). Samples never
cross the Capacitor bridge individually. `@capacitor-community/bluetooth-le` remains only
for provisioning operations.

### Example decode (Swift)

```swift
let w = Double(Int16(bitPattern: u16le(bytes, 6))) / 32767.0
let gx = Double(Int16(bitPattern: u16le(bytes, 14))) / 2048.0
```

## Command characteristic

- Properties: `WRITE`, `WRITE_NO_RESPONSE`
- Encoding: UTF-8 ASCII, no null terminator required
- Commands:

| Command | Effect |
|---------|--------|
| `ZERO` | Capture and persist the current orientation as zero reference |
| `CLEAR_ZERO` | Remove the persisted zero reference |
| `CAL_START` | Enable dynamic accelerometer/gyroscope calibration and clear pose coverage |
| `CAL_CANCEL` | Stop the calibration session without saving |
| `CAL_SAVE` | Save DCD when accuracy and pose coverage requirements are satisfied |
| `CONN_FAST` | Make one Apple-compliant connection-parameter request (15–30 ms, latency 0, 6 s supervision timeout) |

Unknown commands are ignored. Firmware replies are not required for MVP.

## Connection / reconnection

1. App scans for service UUID or name prefix `ProGenia-Frame-`
2. Connect and discover services (timeout 10 s)
3. Subscribe to orientation notifications
4. On disconnect: firmware restarts advertising; native iOS reconnects after 500 ms
5. While BLE is connected, firmware suspends Wi-Fi so BLE has exclusive use of the 2.4 GHz radio

### Advertising layout (important for multi-phone)

Legacy ADV is 31 bytes. Firmware puts **flags + complete 128-bit service UUID** in the primary advertising packet and the full `ProGenia-Frame-XXXX` name in the **scan response**. If the long name were packed into the primary ADV with the UUID, the UUID is dropped — phones that already cached the peripheral (one iPhone) keep working, while every other device scanning by service finds nothing.

### Host stacks by device

| Device | Stack | Why |
|--------|--------|-----|
| iPhone (native app) | `ProgeniaArFrame` CoreBluetooth → localhost WS | Highest notify rate (~30 Hz); no per-sample Capacitor bridge |
| iPad (native app) | Capacitor BLE connect + **native WS relay** (`capacitor-ble-relay`) | Native `connect()` hangs on iPad (`connect_timeout` / XPC invalid); Capacitor connect works; relay bypasses per-sample Capacitor bridge |
| Desktop web | Web Bluetooth via Capacitor ble client | Same GATT path as iPad fallback |

### iPad connection / ~1 Hz diagnosis

Observed symptom: UI shows **~1 Hz for ~10 s**, then jumps to **~30 Hz**. Earlier code treated that as a ~1000 ms iPad ATT interval, but that was an **unverified hypothesis**: the UI counter measures samples after Capacitor/WKWebView and RAF, not radio connection events. The raw relay log (`ProgeniaIMU raw_rx_hz`) and firmware `ble_params` log now distinguish the layers.

Failed or unsafe attempts that must not be reintroduced:

| Attempt | Why it wasn't enough |
|---------|---------------------|
| Skip handshake `REBOOT` on iPad | Prevented connect timeouts; kept the slow link alive |
| Accept 1 warm packet during connect | UI entered streaming while still at 1 Hz |
| Repeated 7.5–15 ms parameter requests | Violated Apple accessory rules (minimum 15 ms; valid range 15–30 ms) |
| Requesting params every 150 ms for 15 s | Overlapped LL control procedures and could destabilize iPadOS |
| Reconnecting whenever JS reported <10 Hz | Confused WKWebView batching with a dead BLE link and created reconnect loops |
| Custom native `CBCentralManager` on iPad | Discovered the frame, but `connect()` timed out; Capacitor's single manager is the proven connect path |
| RAF coalescing in JS | Caps ceiling, does not cause 1 Hz floor |

Current design:

1. **Exactly one central on iPad:** Capacitor BLE owns scan, connect, service discovery and CCCD.
2. **Native data relay after connect:** raw CoreBluetooth notify data is relayed to localhost WS, avoiding one Capacitor bridge event per sample.
3. **Apple-compliant firmware params:** one 15–30 ms request after CCCD; no parameter hammering.
4. **No low-rate reconnect:** reconnect only after complete packet silence, and pause the JS watchdog while the native relay owns the data plane.
5. **Full packet parsing:** Capacitor hex fallback preserves all 20/26 bytes instead of truncating to 16.

Rules: **one** `CBCentralManager` per process on iPad; firmware notifies **only after CCCD subscribe**.

## Serial debug (optional)

When `FRAME_SERIAL_DEBUG` is enabled, firmware also prints one JSON line per sample on USB CDC:

```json
{"w":0.99,"x":0.01,"y":0.0,"z":0.0,"hz":50}
```

## Version

- Protocol version: `2.2` (20-byte v2 packet; single-axis probe depth + orientation)
- Firmware project: `firmware/progenia-frame`
