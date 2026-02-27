# Refresh Instagram Token Function

Esta função renova automaticamente o token do Instagram antes de expirar.

## Como Funciona

- **Tokens de longa duração** expiram em **60 dias**
- Podem ser **renovados** se renovados **pelo menos 24 horas antes** do vencimento
- Tokens renovados são válidos por **mais 60 dias** a partir da data de renovação
- **Não existe token permanente**, mas renovando periodicamente você mantém o token válido indefinidamente

## Uso Manual

Para renovar o token manualmente:

```bash
curl https://flhhvrhcrxvxnnbrggwt.supabase.co/functions/v1/refresh-instagram-token \
  -H "apikey: sua_anon_key"
```

A resposta incluirá o novo token. **Atualize o secret no Supabase:**

```bash
supabase secrets set INSTAGRAM_ACCESS_TOKEN="novo_token_aqui"
```

## Automação (Recomendado)

### Opção 1: Cron Job no Supabase (Edge Functions Cron)

Adicione no `supabase/config.toml`:

```toml
[functions.refresh-instagram-token]
verify_jwt = false

[cron.refresh-instagram-token]
schedule = "0 0 * * *"  # Diariamente à meia-noite
sql = "SELECT net.http_post('https://flhhvrhcrxvxnnbrggwt.supabase.co/functions/v1/refresh-instagram-token', '{}', '{"apikey": "sua_anon_key"}')"
```

**Nota:** O Supabase não suporta cron jobs nativamente ainda. Use uma das opções abaixo.

### Opção 2: GitHub Actions (Gratuito)

Crie `.github/workflows/refresh-instagram-token.yml`:

```yaml
name: Refresh Instagram Token

on:
  schedule:
    - cron: '0 0 * * *'  # Diariamente à meia-noite UTC
  workflow_dispatch:  # Permite execução manual

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Token
        run: |
          RESPONSE=$(curl -s "https://flhhvrhcrxvxnnbrggwt.supabase.co/functions/v1/refresh-instagram-token" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}")
          
          NEW_TOKEN=$(echo $RESPONSE | jq -r '.access_token')
          
          # Atualizar via Supabase CLI (requer SUPABASE_ACCESS_TOKEN)
          echo "NEW_TOKEN=$NEW_TOKEN" >> $GITHUB_ENV
          
      - name: Update Secret
        run: |
          supabase secrets set INSTAGRAM_ACCESS_TOKEN="$NEW_TOKEN" \
            --project-ref flhhvrhcrxvxnnbrggwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Opção 3: Serviço Externo (EasyCron, cron-job.org, etc.)

Configure um job que chame a função a cada **30-45 dias** (antes dos 60 dias expirarem).

## Quando Renovar

- **Ideal:** Renovar a cada **30-45 dias** (antes dos 60 dias)
- **Mínimo:** Renovar **pelo menos 24 horas antes** de expirar
- **Frequência:** Uma vez por mês é suficiente

## Verificar Expiração do Token

Para verificar quando o token atual expira:

```bash
curl "https://graph.instagram.com/me?fields=id&access_token=SEU_TOKEN_AQUI"
```

Se retornar erro de token inválido/expirado, você precisa gerar um novo token manualmente.

## Troubleshooting

- **Erro "Token expired"**: Token já expirou. Gere um novo token manualmente no Graph API Explorer.
- **Erro "Token must be at least 24 hours old"**: Token muito novo. Aguarde 24 horas antes de renovar.
- **Token não renova automaticamente**: A função apenas retorna o novo token. Você precisa atualizar o secret manualmente ou automatizar via GitHub Actions/cron.
