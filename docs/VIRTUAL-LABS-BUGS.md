# Bugs e Problemas Encontrados nos Labs Virtuais

## 🔴 CRÍTICO: Casos Duplicados no VirtualLabRenderer.tsx

**Arquivo:** `src/components/VirtualLabRenderer.tsx`

**Problema:** Casos duplicados no switch que causam comportamento incorreto:

```typescript
case "mri_viewer":
case "mri":
  return <MRIViewer config={config} />;  // Linha 81-83

// ... outros casos ...

case "mri":           // Linha 104 - DUPLICADO! Nunca será executado
case "mri_viewer":    // Linha 105 - DUPLICADO!
  return <MRILabPage config={config} />;
```

**Impacto:** Labs do tipo `mri` sempre renderizam `MRIViewer` em vez de `MRILabPage`, mesmo quando deveriam usar `MRILabPage`.

## ⚠️ Inconsistências de Tipos

### Tipos Legados vs Novos

O código suporta múltiplos nomes para o mesmo tipo:

- **Ultrassom Diagnóstico:**
  - `ultrassom_simulador` (legado)
  - `ultrasound` (atual) ✅

- **Ultrassom Terapêutico:**
  - `ultrassom_terapeutico` (legado)
  - `ultrasound_therapy` (atual) ✅

- **MRI:**
  - `mri_viewer` (legado)
  - `mri` (atual) ✅

- **Eletroterapia:**
  - `eletroterapia_sim` (legado)
  - `electrotherapy` (atual) ✅

- **Térmico:**
  - `termico_sim` (legado)
  - `thermal` (atual) ✅

**Recomendação:** Padronizar para os tipos novos e remover suporte aos legados após migração.

## ✅ Verificação dos Dados (virtual_labs.json)

**Status:** Os dados estão corretos:

- ✅ Labs terapêuticos usam `lab_type: "ultrasound_therapy"`
- ✅ Labs de diagnóstico usam `lab_type: "ultrasound"`
- ✅ Títulos e nomes estão consistentes com o tipo

## 📋 Checklist de Correções Necessárias

- [x] Identificar casos duplicados no VirtualLabRenderer
- [ ] Corrigir casos duplicados (remover duplicatas, manter apenas um)
- [ ] Verificar se há labs no banco com tipos legados
- [ ] Criar migration para padronizar tipos legados → novos
- [ ] Atualizar VirtualLabRenderer para remover suporte a tipos legados (após migration)
- [ ] Testar renderização de cada tipo de lab
