# Análise de Bugs nos Labs Virtuais - Baseado em virtual_labs.json

## 🔴 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. Lab Terapêutico com Config de Diagnóstico

**Lab:** "Ultrassom Terapeutico - Continuidade" (ID: a990ba21-d779-48ad-a93b-7ed59ce91876)
- ✅ `lab_type`: `ultrasound_therapy` (CORRETO)
- ✅ Nome/título sugere terapêutico (CORRETO)
- ⚠️ **PROBLEMA POTENCIAL**: Verificar se o componente está renderizando corretamente

**Lab:** "Ultrassom Terapeutico - Duty Cycle" (ID: 26d1081d-f7f3-44a7-aa1f-5c34031a8fe8)
- ✅ `lab_type`: `ultrasound_therapy` (CORRETO)
- ✅ Nome/título sugere terapêutico (CORRETO)
- ⚠️ **PROBLEMA POTENCIAL**: Verificar se o componente está renderizando corretamente

### 2. Labs de Diagnóstico

**Lab:** "Ultrassom diagnóstico - Frequência" (ID: 1aae83df-6c56-48af-a1a9-d819c4d4df5b)
- ✅ `lab_type`: `ultrasound` (CORRETO)
- ✅ Nome sugere diagnóstico (CORRETO)
- ✅ Config tem estrutura de diagnóstico (layers, acousticLayers, inclusions, gain, depth, frequency)

**Lab:** "Ultrassom diagnóstico- Ganho" (ID: de18b06d-17df-41d5-88a3-1ad41b298d4d)
- ✅ `lab_type`: `ultrasound` (CORRETO)
- ✅ Nome sugere diagnóstico (CORRETO)
- ✅ Config tem estrutura de diagnóstico

## 🔍 POSSÍVEIS CAUSAS DO BUG

### Hipótese 1: Config_data sendo passado incorretamente
O `UltrasoundTherapyLabPage` espera um `UltrasoundTherapyConfig`, mas pode estar recebendo o config_data bruto do banco que pode ter estrutura diferente.

**Verificar:** O config_data dos labs terapêuticos tem a estrutura correta:
- ✅ Tem `frequency`, `intensity`, `era`, `mode`, `dutyCycle`, `duration`
- ✅ Tem `scenario`, `coupling`, `movement`
- ✅ Tem `enabledControls` e `ranges`

### Hipótese 2: Componente errado sendo renderizado
Pode haver alguma lógica que detecta o tipo errado baseado no config_data em vez do lab_type.

**Verificar:** O switch no `VirtualLabRenderer.tsx` usa `lab.lab_type`, não o config_data.

### Hipótese 3: Store não inicializando corretamente
O `useUltrasoundTherapyStore` pode não estar recebendo o config corretamente ou pode estar usando valores padrão.

**Verificar:** O `UltrasoundTherapyLabV2` chama `setLabConfig(config)` no useEffect, mas se o config não tiver a estrutura esperada, pode usar defaults.

## 🛠️ CORREÇÕES NECESSÁRIAS

### 1. Adicionar validação e fallback no UltrasoundTherapyLabPage

```typescript
// Em UltrasoundTherapyLabPage.tsx
export default function UltrasoundTherapyLabPage({ 
  config = defaultUltrasoundTherapyConfig, 
  previewMode = false 
}: UltrasoundTherapyLabPageProps) {
  // Validar e normalizar config
  const normalizedConfig: UltrasoundTherapyConfig = useMemo(() => {
    if (!config || typeof config !== 'object') {
      return defaultUltrasoundTherapyConfig;
    }
    
    // Se o config tem estrutura de diagnóstico, usar default
    if (config.gain !== undefined || config.depth !== undefined || 
        config.layers !== undefined || config.acousticLayers !== undefined) {
      console.warn('Config parece ser de diagnóstico, usando default para terapêutico');
      return defaultUltrasoundTherapyConfig;
    }
    
    // Mesclar com default para garantir campos obrigatórios
    return {
      ...defaultUltrasoundTherapyConfig,
      ...config,
      enabledControls: {
        ...defaultUltrasoundTherapyConfig.enabledControls,
        ...(config.enabledControls || {}),
      },
      ranges: {
        ...defaultUltrasoundTherapyConfig.ranges,
        ...(config.ranges || {}),
      },
    };
  }, [config]);
  
  return (
    <UltrasoundTherapyLabV2 
      config={normalizedConfig} 
      labName="Laboratório Virtual de Ultrassom Terapêutico"
      showBackButton={!previewMode}
    />
  );
}
```

### 2. Adicionar log de debug no VirtualLabRenderer

```typescript
const renderLab = () => {
  const config = lab.config_data || {};
  const labType = lab.lab_type as string;
  
  console.log('🔍 Rendering lab:', {
    id: lab.id,
    title: lab.title,
    lab_type: labType,
    hasConfig: !!config && Object.keys(config).length > 0,
    configKeys: config ? Object.keys(config).slice(0, 10) : [],
  });
  
  // ... resto do código
}
```

### 3. Verificar se há labs no banco com lab_type errado

Executar SQL:
```sql
-- Verificar labs terapêuticos
SELECT id, title, name, lab_type, 
       CASE 
         WHEN config_data->>'gain' IS NOT NULL THEN 'TEM GAIN (diagnóstico!)'
         WHEN config_data->>'era' IS NOT NULL THEN 'TEM ERA (terapêutico)'
         ELSE 'SEM INDICADORES'
       END as config_type
FROM virtual_labs
WHERE lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico')
ORDER BY created_at;

-- Verificar labs diagnóstico
SELECT id, title, name, lab_type,
       CASE 
         WHEN config_data->>'gain' IS NOT NULL THEN 'TEM GAIN (diagnóstico)'
         WHEN config_data->>'era' IS NOT NULL THEN 'TEM ERA (terapêutico!)'
         ELSE 'SEM INDICADORES'
       END as config_type
FROM virtual_labs
WHERE lab_type = 'ultrasound'
ORDER BY created_at;
```

## ✅ CORREÇÕES APLICADAS

### 1. VirtualLabRenderer.tsx
- ✅ Removidos casos duplicados no switch (mri aparecia duas vezes)
- ✅ Reorganizado switch por categoria
- ✅ Adicionado log de debug para identificar problemas

### 2. UltrasoundTherapyLabPage.tsx
- ✅ Adicionada validação de config para detectar estrutura de diagnóstico
- ✅ Adicionado fallback para defaultUltrasoundTherapyConfig se config inválido
- ✅ Adicionado log de erro quando detecta config de diagnóstico
- ✅ Mesclagem segura com defaults para garantir campos obrigatórios

### 3. UltrasoundTherapyLabV2.tsx
- ✅ Adicionada validação no useEffect para detectar config de diagnóstico
- ✅ Adicionado log de debug para rastrear config recebido

## 📝 CHECKLIST DE VERIFICAÇÃO

- [x] Adicionar validação e logs de debug
- [x] Corrigir casos duplicados no VirtualLabRenderer
- [ ] **TESTAR**: Abrir um lab terapêutico e verificar logs do console
- [ ] **VERIFICAR**: Se aparece erro no console sobre config de diagnóstico
- [ ] **VERIFICAR**: Se o componente correto está sendo renderizado (UltrasoundTherapyLabV2)
- [ ] **VERIFICAR**: Se há algum componente de diagnóstico sendo renderizado dentro do terapêutico
- [ ] Testar cada lab terapêutico individualmente
- [ ] Verificar se há algum import errado ou componente sendo usado incorretamente

## 🔍 PRÓXIMOS PASSOS PARA DEBUG

1. **Abrir o lab terapêutico no navegador**
2. **Abrir o Console do DevTools (F12)**
3. **Verificar os logs:**
   - `🔍 LabViewer:` - mostra qual lab_type foi detectado e qual componente será renderizado
   - `🔍 VirtualLabRenderer:` - mostra qual lab_type foi detectado (se usado via labId)
   - `🔧 UltrasoundTherapyLabV2:` - mostra o config recebido
   - `✅ UltrasoundTherapyLabPage:` - mostra se config foi validado
   - `❌` - se aparecer, significa que detectou config de diagnóstico

4. **Verificar no banco de dados:**
   - Executar o SQL em `supabase/check-labs-bugs.sql` para verificar inconsistências
   - Verificar se há labs com `lab_type` errado: `SELECT id, title, lab_type FROM virtual_labs WHERE title ILIKE '%terapeutico%';`

5. **Se aparecer erro de config de diagnóstico:**
   - Verificar o lab no banco: `SELECT id, title, lab_type, config_data FROM virtual_labs WHERE slug = 'ultrassom-terapeutico-antebraco';`
   - Verificar se o config_data tem estrutura de diagnóstico (gain, depth, layers)

6. **Se o componente correto está sendo renderizado mas aparece imagem errada:**
   - Verificar se há algum componente filho renderizando diagnóstico
   - Verificar se o UltrasoundTherapy3DViewer está renderizando corretamente
   - Verificar se há algum problema de cache do navegador (limpar cache e recarregar)

## 🎯 CORREÇÃO CRÍTICA APLICADA

- ✅ Normalização do `lab_type` no LabViewer (trim e String) para evitar problemas de espaços/case
- ✅ Logs detalhados em todos os pontos críticos
- ✅ Validação rigorosa de config em UltrasoundTherapyLabPage
