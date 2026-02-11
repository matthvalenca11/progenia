# Configuração de E-mails (Recuperação de Senha e Verificação)

## Secrets do Supabase (Edge Functions)

Para o fluxo de **recuperação de senha** e **verificação de e-mail** funcionar, configure os seguintes secrets no Supabase:

```bash
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set APP_URL=https://progenia.com.br
```

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `RESEND_API_KEY` | Sim | Chave da API Resend para envio de e-mails |
| `APP_URL` | Não (default: https://progenia.com.br) | URL base do app para links de reset/verificação |

## Fluxo de Recuperação de Senha

1. Usuário informa e-mail em `/forgot-password`
2. Edge Function `request-password-reset` busca o usuário em **auth.users** (não em profiles) via `get_user_id_by_email`
3. Token é gravado em `profiles.password_reset_token` e `profiles.password_reset_expires_at`
4. Edge Function `send-reset-email` envia o e-mail via Resend
5. Usuário clica no link e redefine a senha em `/reset-password?token=xxx`
6. Edge Function `reset-password` valida o token e atualiza a senha em auth.users

## Fluxo de Verificação de E-mail

- **Supabase nativo** (`Auth.tsx` com `signUp`): usa o sistema do Supabase (SMTP configurado no Dashboard)
- **Custom** (`authService.signUp`): usa `send-verification-email` com Resend e `email_settings`

## Tabela email_settings

O admin pode configurar assunto, remetente e corpo dos e-mails em `/admin` → Configurações de E-mail. A tabela `email_settings` deve existir e ter pelo menos um registro (criada pela migration `20251120214647`).

## Troubleshooting

- **E-mail não chega**: confirme que `RESEND_API_KEY` está configurada e que o domínio está verificado no Resend
- **"Invalid or expired token"**: token expirou (1h) ou link incorreto; confirme que `APP_URL` está correto para o ambiente
