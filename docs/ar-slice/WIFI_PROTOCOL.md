# ProGenia Frame — Wi‑Fi Protocol

## Por que não SoftAP no iPhone?

O iPhone como cliente de SoftAP entra em power-save e o stream cai para **~1–2 Hz**, mesmo com o ESP gerando ~45 Hz (confirmado no Serial).

## Modo preferido — STA no Personal Hotspot

1. Junte o iPhone ao SoftAP `ProGenia-Frame-XXXX` / `progenia1` **só para provisionar**
2. App → informe o **nome do Personal Hotspot** + senha → **Gravar hotspot na moldura**
3. ESP reinicia e tenta STA
4. Ligue o **Personal Hotspot** no iPhone; saia do SoftAP
5. App → **Conectar Wi‑Fi** (descobre `progenia-frame.local` ou `172.20.10.x`)

UDP `:9091` vai para o **gateway** (o iPhone). Taxa alvo ~50 Hz. Modo UI: `native-udp`.

## SoftAP (fallback / provision)

| Campo | Valor |
|-------|--------|
| SSID | `ProGenia-Frame-XXXX` |
| Senha | `progenia1` |
| IP | `192.168.4.1` |

## Endpoints HTTP (:80)

| Método | Path | Nota |
|--------|------|------|
| GET | `/health` | `ok` |
| GET | `/status` | `mode`, `ip`, `gw` |
| GET | `/quat` | JSON (lento no SoftAP) |
| POST | `/sta` | `ssid` + `pass` (form) → NVS + reboot STA |
| POST | `/sta/clear` | apaga STA → SoftAP |
| POST | `/zero` | ZERO |

## Stream

| Porta | Tipo |
|-------|------|
| UDP 9091 | NDJSON (preferido nativo) |
| TCP 83 | NDJSON raw |
| HTTP 82 | chunked (legado WebView) |
