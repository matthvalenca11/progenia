# Deep Search - Relatório de Bugs e Inconsistências

## Resumo Executivo

Este documento detalha todos os bugs e inconsistências encontrados durante a busca profunda no código e banco de dados do ProGenia.

---

## 🔴 BUGS CRÍTICOS ENCONTRADOS

### 1. **virtualLabService.getBySlug() - Uso incorreto de `.single()`**

**Localização:** `src/services/virtualLabService.ts:93-105`

**Problema:**
```typescript
getBySlug: async (slug: string): Promise<VirtualLab | null> => {
  const { data, error } = await supabase
    .from("virtual_labs")
    .select("*")
    .eq("slug", slug)
    .single(); // ❌ ERRO: Deveria ser .maybeSingle()
```

**Impacto:** Se o slug não existir, `.single()` lança erro em vez de retornar `null`, quebrando o código que espera `null`.

**Correção:** Trocar `.single()` por `.maybeSingle()`.

---

### 2. **Inconsistência de Schema: `modulo_id` vs `module_id`**

**Localização:** Tabela `capsulas` no banco de dados

**Problema:**
- Migração antiga (`20251117163531`) criou `capsulas` com coluna `modulo_id`
- Migrações recentes usam `module_id`
- Código atual tem workaround `.or()` para aceitar ambos

**Impacto:** 
- Dados inconsistentes no banco
- Possível confusão e bugs silenciosos
- Performance degradada (queries com `.or()`)

**Correção:** Criar migração para padronizar todas as `capsulas` para usar apenas `module_id`.

---

### 3. **Inconsistência de Schema: Quiz `aula_id` vs `lesson_id`**

**Localização:** Tabela `quizzes` no banco de dados

**Problema:**
- Migração antiga (`20251115202512`) criou `quizzes` com coluna `aula_id`
- Migração nova (`20251120200957`) criou `quizzes` com coluna `lesson_id`
- Código atual usa apenas `lesson_id`

**Impacto:**
- Possível existência de dados antigos com `aula_id`
- Queries podem não encontrar quizzes antigos

**Correção:** Verificar se há dados com `aula_id` e migrar para `lesson_id`.

---

### 4. **Inconsistência de Roles: `papel` vs `role`**

**Localização:** Tabelas `profiles` e `user_roles`

**Problema:**
- `profiles.papel` usa enum `user_role` ('aluno', 'instrutor', 'admin')
- `user_roles.role` usa enum `app_role` ('admin', 'moderator', 'user')
- Dois sistemas paralelos podem ficar dessincronizados

**Impacto:**
- Usuários podem ter `papel='admin'` mas `role='user'` (ou vice-versa)
- Lógica de autorização pode falhar silenciosamente

**Correção:** Criar script para sincronizar ambos os sistemas.

---

## ⚠️ INCONSISTÊNCIAS DE DADOS

### 5. **Status de Progresso Inválidos**

**Localização:** Tabelas `lesson_progress` e `capsula_progress`

**Problema:**
- Valores de `status` podem estar fora do enum esperado ('nao_iniciado', 'em_progresso', 'concluido')
- Status 'concluido' pode ter `progress_percentage < 100`

**Impacto:**
- UI pode quebrar ao renderizar status inválidos
- Cálculos de progresso podem estar incorretos

**Correção:** Criar script SQL para validar e corrigir status inválidos.

---

### 6. **Foreign Keys Órfãs**

**Localização:** Várias tabelas

**Problema:**
- `lesson_progress.lesson_id` pode referenciar `lessons` que não existem
- `capsula_progress.capsula_id` pode referenciar `capsulas` que não existem
- `quizzes.lesson_id` pode referenciar `lessons` que não existem
- Progressos podem ter `user_id` de usuários deletados

**Impacto:**
- Queries podem falhar silenciosamente
- Dados órfãos ocupam espaço desnecessário

**Correção:** Criar script SQL para identificar e limpar dados órfãos.

---

## 🔍 PROBLEMAS DE CÓDIGO

### 7. **Uso de `.single()` sem tratamento adequado**

**Localização:** Múltiplos serviços

**Problema:**
Vários serviços usam `.single()` quando deveriam usar `.maybeSingle()`:

- `capsulaService.getById()` - linha 71
- `virtualLabService.getById()` - linha 39
- `virtualLabService.getBySlug()` - linha 98 (já mencionado acima)
- E outros...

**Impacto:** Se o registro não existir, lança erro em vez de retornar `null`.

**Correção:** Revisar todos os usos de `.single()` e trocar por `.maybeSingle()` quando apropriado.

---

### 8. **Race Conditions em useEffect**

**Localização:** Componentes React (especialmente labs virtuais)

**Problema:**
Alguns `useEffect` podem ter race conditions:

- `MRILabV2.tsx` - múltiplos `useEffect` com dependências complexas
- `MRILabPreview.tsx` - inicialização pode rodar múltiplas vezes
- `UltrasoundTherapyLabV2.tsx` - validação de config pode rodar após renderização

**Impacto:** Componentes podem renderizar com estado inconsistente.

**Correção:** Revisar e otimizar dependências dos `useEffect`.

---

## 📋 CHECKLIST DE CORREÇÕES

### Prioridade ALTA (Crítico)
- [ ] Corrigir `virtualLabService.getBySlug()` para usar `.maybeSingle()`
- [ ] Executar `deep-search-bugs.sql` no Supabase para identificar inconsistências
- [ ] Migrar `capsulas.modulo_id` para `module_id` (se houver dados com `modulo_id`)
- [ ] Migrar `quizzes.aula_id` para `lesson_id` (se houver dados com `aula_id`)

### Prioridade MÉDIA (Importante)
- [ ] Sincronizar `profiles.papel` com `user_roles.role`
- [ ] Validar e corrigir status inválidos em `lesson_progress` e `capsula_progress`
- [ ] Limpar foreign keys órfãs
- [ ] Revisar todos os usos de `.single()` vs `.maybeSingle()`

### Prioridade BAIXA (Melhorias)
- [ ] Otimizar `useEffect` em componentes de labs virtuais
- [ ] Adicionar validação de tipos mais rigorosa
- [ ] Melhorar tratamento de erros em serviços

---

## 🛠️ SCRIPTS DE CORREÇÃO

### Script SQL: `deep-search-bugs.sql`
Execute este script no Supabase SQL Editor para identificar todas as inconsistências:
```bash
# Localização: supabase/deep-search-bugs.sql
```

Este script verifica:
1. Inconsistências de schema (`modulo_id` vs `module_id`, `aula_id` vs `lesson_id`)
2. Status inválidos
3. Foreign keys órfãs
4. Inconsistências de roles
5. Labs virtuais com tipos/configs incorretos
6. E mais...

---

## 📝 PRÓXIMOS PASSOS

1. **Execute o script SQL** `deep-search-bugs.sql` no Supabase
2. **Revise os resultados** e identifique quais inconsistências existem no seu banco
3. **Aplique as correções** conforme a prioridade
4. **Teste** cada correção antes de prosseguir
5. **Documente** qualquer correção manual aplicada

---

## 🔗 ARQUIVOS RELACIONADOS

- `supabase/deep-search-bugs.sql` - Script de verificação completo
- `supabase/check-labs-bugs.sql` - Script específico para labs virtuais (já existente)
- `supabase/fix-lab-types.sql` - Script para corrigir tipos de labs (já existente)
- `src/services/virtualLabService.ts` - Serviço com bug crítico
- `src/pages/ModuleCapsules.tsx` - Workaround para `modulo_id` vs `module_id`

---

**Data do Relatório:** 2026-02-10
**Versão:** 1.0
