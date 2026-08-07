# ProGenia AR Slice

Experiência de plano de corte anatômico controlado por uma moldura física com ESP32-C6 + BNO085, com ancoragem visual do aro pela câmera.

## Arquitetura (MVP)

| Camada | Tecnologia |
|--------|------------|
| Firmware | PlatformIO + Arduino-ESP32 3.x (pioarduino), board `seeed_xiao_esp32c6` |
| Sensor | BNO085 `SH2_GAME_ROTATION_VECTOR` (sem magnetômetro) |
| Link | BLE GATT notify 16 bytes float32 LE `[w,x,y,z]` @ ~50 Hz |
| App | React + Vite + Capacitor 7 + React Three Fiber |
| BLE central | `@capacitor-community/bluetooth-le` (+ mock web) |
| Câmera | `@capacitor-community/camera-preview` (nativo) / `getUserMedia` (web) |
| Detecção do aro | **iOS:** Apple Vision (`VNDetectRectanglesRequest`) via plugin `ProgeniaArFrame` · **Web/Android:** detector JS de contorno |

Protocolo BLE: [BLE_PROTOCOL.md](./BLE_PROTOCOL.md)  
Protocolo Wi‑Fi (preferido): [WIFI_PROTOCOL.md](./WIFI_PROTOCOL.md)  
Checklist de bring-up: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)

## Wiring (XIAO ESP32-C6)

| BNO085 | XIAO |
|--------|------|
| VIN / 3V3 | 3V3 |
| GND | GND |
| SDA | **D4** |
| SCL | **D5** |

Não use labels GPIO22/23 da DevKitC — no XIAO C6 o I²C do sketch é `Wire.begin(D4, D5)`.

## Firmware

```bash
# Python 3.10+ required by pioarduino
cd firmware/progenia-frame
# optional local venv:
#   python3.12 -m venv ../.venv && ../.venv/bin/pip install platformio
pio run
pio run -t upload
pio device monitor -b 115200
```

Advertising name: `Progenia-Frame-XXXX` (últimos 2 bytes do MAC).

Comando ASCII `ZERO` na characteristic de comando captura a referência de orientação na RAM do firmware.

## App

Rota: `/labs/ar-slice` (HashRouter no nativo: `#/labs/ar-slice`)

Atalho no Dashboard → Laboratórios Virtuais → **Corte anatômico AR**.

```bash
npm install
npm run dev          # mock BLE automático na web
VITE_BLE_MOCK=true npm run dev
npm test -- src/features/ar-slice
npm run build
npm run cap:sync:ios   # após alterar plugins/permissões
```

### Permissões nativas

- iOS `Info.plist`: Bluetooth + Camera
- Android `AndroidManifest.xml`: `BLUETOOTH_SCAN` (`neverForLocation`), `BLUETOOTH_CONNECT`, `CAMERA`

### Fluxo guiado

1. **Ligar câmera + tracking** — aponta para a moldura preta; o overlay marca o retângulo.
2. **Buscar / conectar** o ESP32 (BLE).
3. Com a moldura estável e paralela à tela, toque em **Zerar orientação**.
4. Mova a moldura — o modelo fica ancorado no aro (visão); o plano de corte segue o IMU (BLE).
5. Ajuste a **profundidade do corte** (slider 1D).

### Fusão visão + BLE

| Fonte | Papel |
|-------|--------|
| Vision / JS | Posição, escala e orientação aproximada do modelo no aro |
| BNO085 (BLE) | Orientação do plano de corte (alta taxa), após `ZERO` |

Não multiplicamos as duas rotações no plano de corte (evita double-count de tilt).

### Vision vs ARKit completo

O plugin iOS usa **Apple Vision em JPEG** de `CameraPreview.captureSample`. Não abre um `ARSession` em paralelo (conflito de câmera com CameraPreview). Tracking 6DOF de mundo (ARKit/ARCore) exigiria substituir o preview por sessão AR nativa.

### Cadeia de coordenadas (BLE)

```
R_frame    = R_imu · R_mount
R_relative = R_zero⁻¹ · R_frame
→ Three.js Y-up (quaternion direto após calibração)
```

- Normal do plano = eixo frontal (+Z) da moldura após calibração.
- Offset do plano = slider `depthOffset`.
- Presets `R_mount` na UI até a orientação física do IMU na PCB ser medida.

## Limitações do MVP

- Ancoragem do aro é **retângulo 2D → pose aproximada** (não hit-test de plano ARKit).
- Android ainda usa o detector JS (sem plugin Vision nativo).
- Cabeça é **procedural**; GLB opcional em `public/models/ar-slice/`.
- Acelerômetro não integra posição (drift).
- Não use `SH2_ROTATION_VECTOR` (magnetômetro instável em ambientes internos).

## Critérios de aceite

- [ ] App conecta BLE em &lt; 10 s
- [ ] Overlay trava no aro com confiança estável
- [ ] Modelo alinha-se ao retângulo detectado
- [ ] Plano de corte move/rotaciona com a moldura (IMU)
- [ ] Interior anatômico visível no corte
- [ ] Calibração “Zerar” funciona em 1 toque

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| Sensor not found | Confira D4/D5, 3V3, endereço I²C; reinicie a placa |
| Scan vazio | Bluetooth ligado; permissões concedidas; firmware advertising |
| Cubo não mexe (web) | Esperado usar mock — clique Buscar/Conectar no mock |
| Aro não trava | Mais contraste (moldura preta / fundo claro); luz uniforme; aproxime o aro |
| Vision indisponível | Fallback JS automático; confira `ProgeniaArFramePlugin.swift` no target iOS |
| Câmera nativa sem overlay | Confira classe `ar-slice-camera-bg` e transparência só na rota |
| Python &lt; 3.10 no PlatformIO | Use venv com Python 3.12+ (`firmware/.venv`) |
