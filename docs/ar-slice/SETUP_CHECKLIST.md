# Checklist — colocar o AR Slice a funcionar

## 1. Hardware (bloqueante se o BNO não ligar)

| Fio | XIAO ESP32-C6 | BNO085 |
|-----|---------------|--------|
| 3V3 | 3V3 | VIN / 3V3 |
| GND | GND | GND |
| SDA | **D4** | SDA |
| SCL | **D5** | SCL |

- Confirme que o módulo BNO085 é I²C (não SPI-only).
- AD0 pode escolher endereço `0x4A` ou `0x4B` — o firmware tenta os dois.
- No monitor serial, após o flash, deve aparecer `i2c_scan` com algum endereço e depois `sensor_ready`.
- Se `addrs:[]` e `BNO08x not found`: cabo/solda/alimentação — o BLE ainda anuncia, mas **sem orientação**.

Flash:

```bash
cd firmware/progenia-frame
../.venv/bin/pio run -t upload --upload-port /dev/cu.usbmodemXXXX
```

Nome BLE esperado: `ProGenia-Frame-XXXX` (ex.: `ProGenia-Frame-6F66`).

## 2. App nativo

```bash
npm run cap:sync:ios    # iPhone — Vision + BLE + câmera
# ou
npm run cap:sync:android
npx cap open ios
```

No device: aceite Bluetooth e Câmera.

## 3. Fluxo no lab (`/labs/ar-slice` ou Dashboard → Corte anatômico AR)

1. **Ligar câmera + tracking** — enquadre a moldura preta no retângulo tracejado.
2. **Buscar ESP32** → conectar (web = mock BLE).
3. **Calibrar eixos IMU** (se o corte girar no eixo errado): plana → capturar → incline borda direita → capturar.
4. Moldura paralela à tela → **Zerar orientação**.
5. Ajuste profundidade do corte.

## 4. Validação rápida

| Check | OK quando |
|-------|-----------|
| Serial | `sensor_ready` + quaternions ~50 Hz |
| BLE | App vê `ProGenia-Frame-*` e `streaming` |
| Vision | Overlay “aro XX%” travado |
| Corte | Inclinar a moldura move o plano / cubo de debug |

## Estado conhecido no último flash

- ESP32-C6 no USB: firmware OK, BLE `ProGenia-Frame-6F66` anunciando.
- BNO085: **não respondia no I²C** (`addrs` vazio) — falta corrigir a ligação do sensor.
