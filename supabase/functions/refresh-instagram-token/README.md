# Refresh Instagram Token

Renova o token de longa duração (~60 dias) e grava em `instagram_connection`.
O blog lê essa tabela: **não é preciso atualizar secrets no CLI a cada renovação**.

## Como fica automático

1. Você gera **um** token longo no Meta e configura `INSTAGRAM_ACCESS_TOKEN` uma vez.
2. A função `refresh-instagram-token` é chamada nos dias 1 e 15 de cada mês.
3. O token novo é salvo no banco. `get-instagram-posts` usa esse valor.

Agendamentos:

- GitHub Action: `.github/workflows/refresh-instagram-token.yml`
- `pg_cron` no Supabase, se a extensão estiver ligada

## Limite do Instagram

A renovação **só funciona enquanto o token ainda é válido**. Se deixar expirar, o Meta exige um token novo manualmente. Por isso o cron roda a cada ~15 dias.

## Tutor de IA

A chave `GROQ_API_KEY` **não expira** nesse ciclo. Não há token mensal para trocar. O tutor cai por CORS, deploy ou chave ausente — não por calendário do Instagram.
