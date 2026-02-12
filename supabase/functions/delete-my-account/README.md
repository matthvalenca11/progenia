# delete-my-account

Permite que o usuário exclua a própria conta (com confirmação de senha no app).

A função valida o token JWT usando a API de Auth do Supabase, que funciona com qualquer algoritmo de assinatura (HS256, ECC, etc.).

## Deploy

```bash
supabase functions deploy delete-my-account
```

Não requer configuração adicional de secrets.
