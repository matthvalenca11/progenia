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
| 1 | 1 | Version | `0x02` |
| 2 | 2 | Sequence | `uint16` |
| 4 | 2 | ESP timestamp | low 16 bits of `millis()` |
| 6 | 8 | Quaternion `w,x,y,z` | `int16 / 32767` |
| 14 | 6 | Gravity `gx,gy,gz` | `int16 / 2048`, m/s² |

Sequence gaps are allowed and must be counted; live rendering always prefers the newest sample.

### Data plane on iOS

CoreBluetooth is implemented inside `ProgeniaArFramePlugin.swift`. It parses notifications
natively and publishes binary IMU v2 frames through `ws://127.0.0.1:19091`. Samples never
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
| `ZERO` | Capture current orientation as zero reference on the device (RAM) |

Unknown commands are ignored. Firmware replies are not required for MVP.

## Connection / reconnection

1. App scans for service UUID or name prefix `ProGenia-Frame-`
2. Connect and discover services (timeout 10 s)
3. Subscribe to orientation notifications
4. On disconnect: firmware restarts advertising; native iOS reconnects after 500 ms
5. While BLE is connected, firmware suspends Wi-Fi so BLE has exclusive use of the 2.4 GHz radio

## Serial debug (optional)

When `FRAME_SERIAL_DEBUG` is enabled, firmware also prints one JSON line per sample on USB CDC:

```json
{"w":0.99,"x":0.01,"y":0.0,"z":0.0,"hz":50}
```

## Version

- Protocol version: `2.0`
- Firmware project: `firmware/progenia-frame`
