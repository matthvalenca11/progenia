# Configuração do Instagram - ProGenia Blog-IG

## Credenciais do App

- **App Name**: ProGenia Blog-IG
- **App ID**: `1442163880709941`
- **App Secret**: `ba503770dfd99ad6f76af10051a5fb7e`

## Passo a Passo para Obter Access Token e Account ID

### 1. Obter Access Token de Teste (Rápido para desenvolvimento)

1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione o app **ProGenia Blog-IG** no dropdown superior
3. Clique em **Generate Access Token**
4. Selecione as permissões:
   - `instagram_basic`
   - `pages_read_engagement`
   - `pages_show_list`
5. Copie o token gerado (válido por ~1 hora)

### 2. Converter para Token de Longa Duração (60 dias)

Execute no terminal:

```bash
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=1442163880709941&client_secret=ba503770dfd99ad6f76af10051a5fb7e&fb_exchange_token=SEU_TOKEN_CURTO_AQUI"
```

Substitua `SEU_TOKEN_CURTO_AQUI` pelo token obtido no passo 1.

A resposta será algo como:
```json
{
  "access_token": "TOKEN_LONGO_AQUI",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

Copie o `access_token` - esse é o **INSTAGRAM_ACCESS_TOKEN**.

### 3. Obter Instagram Account ID

Com o token de longa duração, execute:

```bash
curl -X GET "https://graph.facebook.com/v18.0/me/accounts?access_token=SEU_TOKEN_LONGO_AQUI"
```

Isso retorna suas páginas do Facebook. Para cada página, execute:

```bash
curl -X GET "https://graph.facebook.com/v18.0/{PAGE_ID}?fields=instagram_business_account&access_token=SEU_TOKEN_LONGO_AQUI"
```

O campo `instagram_business_account.id` é o **INSTAGRAM_ACCOUNT_ID**.

**OU** se você já sabe qual página está conectada ao Instagram:

```bash
# Primeiro, liste suas páginas
curl "https://graph.facebook.com/v18.0/me/accounts?access_token=SEU_TOKEN"

# Depois, para cada PAGE_ID retornado, verifique o Instagram:
curl "https://graph.facebook.com/v18.0/{PAGE_ID}?fields=instagram_business_account&access_token=SEU_TOKEN"
```

### 4. Alternativa: Usar Graph API Explorer

1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione app **ProGenia Blog-IG**
3. Use o token gerado
4. Endpoint: `GET /me/accounts`
5. Para cada página retornada, use: `GET /{page-id}?fields=instagram_business_account`
6. O `id` dentro de `instagram_business_account` é o Account ID

### 5. Configurar no Supabase

Após obter ambos os valores, configure:

```bash
supabase secrets set INSTAGRAM_ACCESS_TOKEN=seu_token_longo_aqui
supabase secrets set INSTAGRAM_ACCOUNT_ID=seu_account_id_aqui
```

### 6. Deploy da Função

```bash
supabase functions deploy get-instagram-posts
```

## Teste Rápido

Após configurar, teste a função:

```bash
curl https://flhhvrhcrxvxnnbrggwt.supabase.co/functions/v1/get-instagram-posts \
  -H "apikey: sua_anon_key"
```

## Token Permanente (Opcional)

Para um token que não expira:

1. Vá em: https://developers.facebook.com/apps/1442163880709941/app-review/
2. Solicite revisão das permissões:
   - `instagram_basic`
   - `pages_read_engagement`
3. Após aprovação, o token de longa duração pode ser renovado automaticamente

## Troubleshooting

- **Erro "Invalid OAuth Access Token"**: Token expirado ou inválido. Gere novo token.
- **Erro "Unsupported get request"**: Instagram Account ID incorreto ou conta não conectada.
- **Nenhum post retornado**: Verifique se a conta tem posts públicos e se o token tem permissões corretas.
