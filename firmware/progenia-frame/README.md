# ProGenia Frame firmware

See [docs/ar-slice/README.md](../../docs/ar-slice/README.md) and [BLE_PROTOCOL.md](../../docs/ar-slice/BLE_PROTOCOL.md).

Wiring (XIAO C6 **ou** C3): BNO085 **SDA → D4**, **SCL → D5**, 3V3, GND.

## Pré-requisito (uma vez)

```bash
python3 -m venv firmware/.venv
firmware/.venv/bin/pip install platformio
```

## Compilar

```bash
# ESP32-C6 (padrão)
firmware/.venv/bin/pio run -d firmware/progenia-frame -e seeed_xiao_esp32c6

# ESP32-C3
firmware/.venv/bin/pio run -d firmware/progenia-frame -e seeed_xiao_esp32c3
```

## Gravar (upload)

1. Conecte o XIAO no Mac via USB.
2. Veja a porta (ex.: `/dev/cu.usbmodem1101`):

```bash
ls /dev/cu.usbmodem*
```

3. Flash:

```bash
# C6
firmware/progenia-frame/upload.sh seeed_xiao_esp32c6

# C3
firmware/progenia-frame/upload.sh seeed_xiao_esp32c3

# ou porta explícita
firmware/progenia-frame/upload.sh seeed_xiao_esp32c3 /dev/cu.usbmodem1101
```

4. Serial (debug, 115200):

```bash
firmware/.venv/bin/pio device monitor -d firmware/progenia-frame -e seeed_xiao_esp32c3 --port /dev/cu.usbmodem1101
```

O **mesmo código** roda nos dois boards; só muda o `-e` (environment).
