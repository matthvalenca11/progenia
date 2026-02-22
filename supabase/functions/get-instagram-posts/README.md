# Instagram Posts Function

Esta função busca posts do Instagram da conta `@plataforma_progenia` usando a Instagram Graph API.

## Configuração no Facebook for Developers

### 1. Criar App no Facebook Developers

1. Acesse [Facebook Developers](https://developers.facebook.com/)
2. Vá em **Meus Apps** → **Criar App**
3. Escolha tipo **Business** ou **Other**
4. Preencha nome do app (ex: "ProGenia Instagram")

### 2. Conectar Conta Instagram

**Importante:** A conta Instagram precisa ser:
- **Instagram Business** ou **Instagram Creator** (não conta pessoal)
- Conectada a uma **Facebook Page**

**Passos:**
1. No app criado, vá em **Instagram** → **Basic Display** ou **Instagram Graph API**
2. Se usar **Graph API** (recomendado):
   - Vá em **Tools** → **Graph API Explorer**
   - Conecte sua conta Instagram Business/Creator
   - Obtenha o **Instagram Account ID** (não é o username)

### 3. Obter Access Token

#### Opção A: Token de Longa Duração (Recomendado)

1. No **Graph API Explorer**:
   - Selecione seu app
   - Selecione a página do Facebook conectada ao Instagram
   - Permissões necessárias: `instagram_basic`, `pages_read_engagement`
   - Clique em **Generate Access Token**
   - Copie o token de curta duração (expira em ~1 hora)

2. Converter para token de longa duração:
   ```bash
   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
   ```
   - Substitua `{APP_ID}`, `{APP_SECRET}` e `{SHORT_LIVED_TOKEN}`
   - O token retornado dura ~60 dias

3. Para token que não expira (requer revisão do Facebook):
   - Vá em **App Review** → **Permissions and Features**
   - Solicite permissões permanentes

#### Opção B: Token de Teste (Desenvolvimento)

- Use o token gerado no Graph API Explorer (expira rápido, só para testes)

### 4. Obter Instagram Account ID

1. No **Graph API Explorer**:
   - Endpoint: `GET /me/accounts`
   - Isso retorna suas páginas do Facebook
   - Para cada página, faça: `GET /{page-id}?fields=instagram_business_account`
   - O `id` retornado é o **Instagram Account ID**

Ou use este endpoint direto:
```
GET /{page-id}?fields=instagram_business_account
```

### 5. Configurar Variáveis de Ambiente no Supabase

No Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**:

```bash
INSTAGRAM_ACCESS_TOKEN=seu_token_aqui
INSTAGRAM_ACCOUNT_ID=seu_account_id_aqui
```

Ou via CLI:
```bash
supabase secrets set INSTAGRAM_ACCESS_TOKEN=seu_token_aqui
supabase secrets set INSTAGRAM_ACCOUNT_ID=seu_account_id_aqui
```

### 6. Deploy da Função

```bash
supabase functions deploy get-instagram-posts
```

## Testando

Após configurar, a função estará disponível em:
- Local: `http://localhost:54321/functions/v1/get-instagram-posts`
- Produção: `https://{project-ref}.supabase.co/functions/v1/get-instagram-posts`

## Troubleshooting

- **Erro 401**: Token inválido ou expirado. Gere novo token.
- **Erro 400**: Instagram Account ID incorreto ou conta não é Business/Creator.
- **Nenhum post**: Verifique se a conta tem posts públicos e se o token tem permissões corretas.

## Referências

- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Getting Started with Instagram Graph API](https://developers.facebook.com/docs/instagram-api/getting-started)
