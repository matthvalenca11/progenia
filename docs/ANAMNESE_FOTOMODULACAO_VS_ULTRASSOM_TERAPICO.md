# Anamnese Completa — Lab de Fotobiomodulação (PBM)

**Versão:** 2026-06-20  
**Objetivo:** Inventário exaustivo e atualizado do estado do laboratório virtual de **Fotobiomodulação (PBM)** no ProGenia, com **comparação sistemática** ao laboratório de **Ultrassom Terapêutico (US)**, considerado referência de qualidade após múltiplas iterações de implementação.

**Uso previsto:** Este documento será enviado a outra IA (ou equipe de design/engenharia) para propor **novas implementações** que elevem a qualidade do lab de PBM em três eixos principais:

1. **Qualidade dos tecidos simulados** no simulador biomédico 3D  
2. **Qualidade do dispositivo** (simulação do equipamento de fotobiomodulação)  
3. **Efeitos simulados da propagação do feixe de luz** no tecido  

---

## Instruções para a IA analista

Ao ler este documento, considere:

- O ProGenia adota **simulação educacional simplificada** — heurísticas TypeScript, não Monte Carlo, não FEA, não radiative transfer clínico.
- A referência US terapêutico demonstra o **padrão alvo** de maturidade: motor ↔ visual acoplados, múltiplos modos de visualização, pedagogia guiada, métricas de segurança coloridas, admin configurável.
- Identifique **lacunas concretas** onde PBM pode espelhar padrões já provados no US sem copiar acústica literalmente.
- Priorize propostas que **preservem relações paramétricas dominantes** (λ → penetração, potência/tempo → fluência, técnica → dose efetiva, adiposidade → atenuação).
- Respeite restrições de **performance Android WebView** (sombras off, DPR=1, menos instâncias).

**Stack comum:** React + TypeScript + Zustand + React Three Fiber + Three.js + Tailwind/shadcn.

---

## Sumário executivo

| Dimensão | Fotobiomodulação (atual) | Ultrassom Terapêutico (referência) |
|----------|--------------------------|-------------------------------------|
| Arquivos dedicados (UI) | **10** em `src/components/labs/photobio/` | **49** em `src/components/labs/ultrasound-therapy/` |
| Módulos de simulação/lib | 1 engine + store | Engine + 15+ libs (physics, stack, interaction map, textures, physiology, gel, scoring…) |
| Modos de visualização 3D | **1** (anatomia + feixe integrados) | **4+** (Visão Geral, Feixe, Térmico, Fisiologia) via `TherapyModeDock` |
| Mapa de campo GPU | ❌ Não | ✅ Acústico, térmico, interação (`*FieldTexture.ts`) |
| Acoplamento motor ↔ visual | ⚠️ **Desacoplado** (constantes diferentes) | ✅ **Single source of truth** (`ultrasoundTherapyPhysics.ts`) |
| Modo guiado / desafios | ❌ Não | ✅ 5 desafios + coach + scoring |
| Snapshots / comparação A/B | ❌ Não | ✅ `SessionTimeline`, `SimulationComparisonPanel` |
| Status bar persistente | ⚠️ Badges no header apenas | ✅ `SimulationStatusBar` (risco, profundidade, fenômeno dominante) |
| Presets clínicos nomeados | ❌ Não | ✅ Analgesia, aquecimento profundo, região óssea, exemplo inadequado |
| Admin config editor | ⚠️ Parcial (controlModes only) | ✅ Editor completo com ranges, cenários, preview |
| AI Tutor integrado | ❌ Não no shell do lab | ❌ Também ausente no shell US (existe globalmente na plataforma) |
| Dispositivo 3D | Procedural “handpiece premium” inline | `TransducerModel.tsx` + tipos IFU + contato/gel |
| Tecidos 3D | 4 camadas compartilhadas (sem osso) | 4–5 camadas + mixed layer + osso + reflexão |
| Outputs textuais | Bons (Arndt-Schulz, warnings) | Excelentes (dominant effect, physiology line, recomendações) |

**Veredicto:** PBM é um lab **funcional e pedagogicamente útil**, mas está **1–2 gerações atrás** do US terapêutico em arquitetura de simulação, fidelidade visual do feixe, modos de visualização, scaffolding guiado e acoplamento físico-visual.

---

## Parte I — Estado atual do Lab de Fotobiomodulação

### 1. Arquitetura e arquivos

#### 1.1 Entrada e roteamento

| Papel | Caminho |
|-------|---------|
| Página | `src/pages/PhotobioLabPage.tsx` → monta `PhotobioLabV2` |
| Shell principal | `src/components/labs/photobio/PhotobioLabV2.tsx` |
| Viewer 3D | `src/components/labs/photobio/TissueViewer.tsx` |
| Controles | `src/components/labs/photobio/PhotobioControls.tsx` |
| Anatomia | `src/components/labs/photobio/AnatomyControls.tsx` |
| Insights / métricas | `src/components/labs/photobio/PhotobioInsightsPanel.tsx` |
| Admin in-lab | `src/components/labs/photobio/LabConfigMenu.tsx` |
| Store | `src/stores/photobioStore.ts` |
| Motor | `src/simulation/photobioEngine.ts` |
| Integração virtual lab | `src/components/labs/LabExperience.tsx`, `VirtualLabRenderer.tsx` |
| Tipo DB | `supabase/migrations/20260327035500_add_photobiomodulation_lab_type.sql` |
| Smoke dev | `src/pages/dev/TherapeuticLabSmoke.tsx` → `/dev/lab-smoke/photobio` |

#### 1.2 Infraestrutura compartilhada (reutilizada)

| Módulo | Caminho | Uso em PBM |
|--------|---------|------------|
| Canvas WebGL | `LabCanvasSurface.tsx`, `LabCanvas.tsx` | Wrapper com defer mount Android |
| Geometria orgânica | `src/lib/clinicalTissueGeometry.ts` | `buildOrganicLayerGeometry`, ondas compartilhadas |
| Texturas procedurais | `src/lib/clinicalTissueTextures.ts` | 768×768 canvas → map + bumpMap |
| Tons de pele | `src/lib/clinicalSkinTones.ts` | Sorteio 1× por sessão (visual only) |
| Performance terapêutica | `src/lib/therapeuticLabsPerformance.ts` | Caps beam nodes, scatter, LEDs, rings, shadows |
| Disclaimer | `EducationalSimulationDisclaimer.tsx` | Rodapé compacto |
| Mobile layout | `LabMobileTabBar.tsx`, `labMobileLayout.ts` | Tabs Controles \| Métricas |

#### 1.3 Fluxo de dados

```
config_data (Supabase / admin)
    → photobioStore.setFromConfig()
    → alteração de parâmetro → runSimulation()
    → photobioEngine.calculateTissueInteraction()
    → interaction snapshot → PhotobioInsightsPanel + TissueViewer
    → drag 3D → accumulateDoseAt() → doseMap[56]
```

**Observação crítica:** Não existe camada intermediária tipo `interactionMap` ou `fieldTexture` compartilhada entre motor numérico e GPU. O 3D usa constantes de atenuação **próprias**, diferentes do engine.

---

### 2. Layout e UX

#### 2.1 Desktop

```
┌─────────────────────────────────────────────────────────────┐
│ Header: voltar, título, badges (fluência, zona Arndt-Schulz,│
│         alerta térmico), reset, LabConfigMenu (?admin=true) │
├─────────────────────────────────────────────────────────────┤
│ TissueViewer (~54dvh) + toggle "Visão translúcida"          │
├─────────────────────────────────────────────────────────────┤
│ EducationalSimulationDisclaimer                             │
├──────────────────────────┬──────────────────────────────────┤
│ PhotobioControls (50%)   │ PhotobioInsightsPanel (50%)      │
└──────────────────────────┴──────────────────────────────────┘
```

#### 2.2 Mobile

- Canvas ~48dvh no topo  
- `LabMobileTabBar`: **Controles** | **Métricas**  
- Sem bottom sheet avançado (US tem `MobileTherapyBottomSheet` com abas Challenge/Quick/Target/Full/Metrics)  
- Sem dock inferior de modos de visualização  

#### 2.3 O que falta vs padrão US

- `SimulationStatusBar` fixa com risco + métricas-chave sempre visíveis  
- `TherapyModeDock` / tabs 3D (Feixe / Penetração / Fluência / Resposta celular)  
- `TherapyDemoShell` para embed em cápsulas/aulas  
- `ParameterQuickCards` com status ok/warn/risk por parâmetro  
- Colapsamento progressivo (basic/advanced accordion)  
- Modo preview admin sincronizado com editor dedicado  

---

### 3. Parâmetros configuráveis

#### 3.1 Inputs de simulação (store)

| Parâmetro | Default | Range / Opções | UI |
|-----------|---------|----------------|-----|
| `wavelength` | 660 nm | 660 \| 808 | Tabs |
| `power` | 100 mW | 10–500 | Slider + input |
| `spotSize` | 0.5 cm² | 0.1–1.0 | Slider + input |
| `exposureTime` | 30 s | 1–300 | Slider + input |
| `mode` | CW | CW \| Pulsed | Tabs |
| `dutyCycle` | 50 % | 10–90 (só Pulsed) | Slider — **funcional** |
| `transducerAngle` | 90° | 0–180 | Slider "Técnica" + drag RMB 3D |
| `contactPressure` | 50 | 0–100 % | Slider "Técnica" + indent 3D |
| `transducerX` | 0 | −2.8 … 2.8 (world) | Drag LMB 3D |
| `isDragging` | false | boolean | Automático no drag |
| `draggingSpeed` | 1 | 0.2–5 | Derivado da velocidade do drag |
| `anatomyPreset` | default | default, elderly, athlete, obese, custom | Botões preset |
| `layerConfig.epidermisMm` | 1 | 0.2–3 | Custom only |
| `layerConfig.dermisMm` | 4 | 0.5–10 | Custom only |
| `layerConfig.adiposeMm` | 15 | 1–60 | Custom only |
| `layerConfig.muscleMm` | 25 | 5–60 | Custom only |

**Presets anatômicos (mm):**

| Preset | Epiderme | Derme | Adiposo | Músculo |
|--------|----------|-------|---------|---------|
| default | 1 | 4 | 15 | 25 |
| elderly | 0.5 | 2 | 10 | 12 |
| athlete | 1 | 4 | 5 | 35 |
| obese | 1 | 4 | 40 | 10 |

#### 3.2 Quantidades derivadas

| Quantidade | Fórmula |
|------------|---------|
| `irradiance` | `power / spotSize` (mW/cm²) |
| `energy` | `(power/1000) × exposureTime × (Pulsed ? dutyCycle/100 : 1)` (J) |
| `fluence` | `energy / spotSize` (J/cm²) |

#### 3.3 Dose map (runtime, não persistido)

| Campo | Valor |
|-------|-------|
| `doseMap` | Array 56 bins, zeros inicial |
| Acumulação | Durante drag 3D via `accumulateDoseAt(x, delta)` |
| Max por bin | ~80 |
| Spread | ±2 bins |
| Reset | Botão "Limpar mapa" no InsightsPanel |
| Visual 3D | 56 planos na superfície (verde → vermelho) |

#### 3.4 Admin — `config_data` / `controlModes`

Definido em `VirtualLabEditorUnified.tsx` → `defaultPhotobioConfig`:

```typescript
{
  wavelength: 660,
  power: 100,
  spotSize: 0.5,
  exposureTime: 30,
  mode: "CW",
  dutyCycle: 50,
  controlModes: { showWavelength, showPower, showSpotSize, showExposureTime, showMode, showAnatomyPresets, showCustomAnatomy }
}
```

**Lacunas admin:**

- Sem UI para editar valores iniciais (power, λ, etc.) — só preview + toggles de visibilidade  
- Sem editor de ranges (US tem `UltrasoundTherapyLabConfigEditor.tsx`)  
- `transducerAngle`, `contactPressure`, `layerConfig` aceitos via `setFromConfig` mas **não expostos no editor admin**  
- Sem cenários nomeados (ombro, joelho…) — só presets corporais  

---

### 4. Motor de simulação (`photobioEngine.ts`)

**Natureza:** Heurística educacional pura. Comentário no código: *"motor físico simplificado … contexto educacional"*.

#### 4.1 Modelos implementados

**A) Perfil de penetração discreto (não Beer-Lambert multicamada)**

| λ | Epiderme+Derme | Hipoderme (adiposo) | Músculo |
|---|----------------|---------------------|---------|
| 660 nm | 70% absorvido | 30% | 0% |
| 808 nm | 20% | 50% | 30% |

→ Retornado como `penetrationProfile[]` — **calculado mas não exibido na UI**.

**B) Atenuação exponencial através do adiposo (parcial Beer-Lambert)**

```
muscleFluenceRatio = exp(−k × adiposeMm)
k = 0.038 (660) | 0.02 (808)
muscleFluence = effectiveFluence × muscleFluenceRatio
```

**C) Fator de dose real (técnica de aplicação)**

```
angleEfficiency = cos(|90° − angle|)
pressureFactor:  <20 → 0.5 | >80 → 1.2 | else 1.0
speedFactor:     isDragging ? 1/max(0.2, draggingSpeed) : 1
realDoseFactor = max(0.05, angle × pressure × speed)
effectiveFluence = fluence × realDoseFactor
```

**D) Zonas Arndt-Schulz ( pela fluência nominal, não effectiveFluence )**

| Fluência (J/cm²) | Zona |
|------------------|------|
| < 2 | Subdose / Efeito Nulo |
| 2–8 | Janela Terapêutica Ativa |
| 10–30 | Efeito Inibitório / Sedação |
| > 50 | Bioinibição / Saturação |
| 8–10, 30–50 | Transição |

**E) Alertas**

| Tipo | Condição |
|------|----------|
| `thermalWarning` | irradiance > 500 mW/cm² |
| `anatomyWarning` | adipose ≥ 20 mm |
| `techniqueWarnings` | scan rápido; parado + effectiveFluence > 30; ângulo fora 70–110°; pressão baixa/alta |

#### 4.2 Outputs do motor (interface `TissueInteractionResult`)

| Campo | Exposto na UI? |
|-------|----------------|
| `arndtSchulzZone`, `statusColor` | ✅ Header + Insights |
| `insight` (texto engine) | ⚠️ Duplicado — UI usa `zoneMessage()` próprio |
| `muscleFluence`, `muscleFluenceRatio` | ✅ InsightsPanel |
| `effectiveFluence`, `realDoseFactor` | ❌ Oculto do estudante |
| `angleEfficiency`, `pressureFactor`, `speedFactor` | ❌ Oculto |
| `penetrationProfile` | ❌ **Nunca renderizado** |
| `techniqueWarnings` | ✅ Com sugestões |
| `thermalWarning`, `anatomyWarning` | ✅ |

#### 4.3 Modelos NÃO implementados

- Beer-Lambert integrado camada a camada com μ(λ, tecido)  
- Cromóforos (citocromo c oxidase, melanina, hemoglobina)  
- Tom de pele / melanina afetando absorção superficial  
- Frequência de pulsação (só duty cycle na energia)  
- Difusão térmica / bioheat  
- Monte Carlo / radiative transfer  
- Mapa 2D de fluência no tecido (grid)  

#### 4.4 Inconsistências motor ↔ visual

> **Atualização 2026-06-20 (v2):** `photobioOptics.ts` expandido com `PhotobioOpticsResult`, `computePhotobioOptics()`, `classifyPhotobioDose()` (usa **effectiveFluenceJcm2**), limiares unificados em `PHOTOBIO_DOSE_THRESHOLDS`, melanina, acoplamento óptico, índices (`deepDeliveryIndex`, `thermalRiskIndex`, etc.) e presets visuais por λ.

| Aspecto | Estado após `photobioOptics.ts` |
|---------|----------------------------------|
| Atenuação do feixe 3D | ✅ `getVisualBeamChannelFactors()` derivado do perfil óptico |
| Profundidade visual do feixe | ✅ `beamVisualDepthMm` (Beer–Lambert multicamada) |
| `muscleFluenceRatio` | ✅ Integração por camadas até entrada do músculo |
| `penetrationProfile` | ✅ Derivado de `layerSummaries`, não tabela fixa |
| Arndt-Schulz vs dose map | ✅ Limiares unificados via `PHOTOBIO_DOSE_THRESHOLDS` |
| Zona bioativa vs effectiveFluence | ✅ Classificação usa `effectiveFluenceJcm2` |

**Próximo passo:** modo guiado, `PhotobioDemoShell`, presets clínicos (field map + overlay GPU **implementados**).

---

### 5. Simulação 3D (`TissueViewer.tsx`)

#### 5.1 Stack tecnológico

- React Three Fiber + `@react-three/drei` (OrbitControls, PerspectiveCamera, Html)  
- Three.js r15x  
- **Sem modelos GLTF/FBX** — tudo procedural  

#### 5.2 Tecidos (4 camadas)

| Camada | Geometria | Material |
|--------|-----------|----------|
| Epiderme | `buildOrganicLayerGeometry` | `clinicalTissueMaterialProps("epidermis")` |
| Derme | idem | dermis |
| Adiposo | idem | adipose |
| Músculo | idem | muscle |

- Escala: `mmToWorld = 0.09`; largura 8.5, profundidade 3.4  
- `applyContactIndent()` — depressão gaussiana epiderme/derme por `contactPressure`  
- Toggle **"Visão translúcida"** — opacity 0.46–0.55, boost ×1.35 nos feixes  
- Labels Html estáticos por camada  
- **Sem osso**, mixed layer, ou highlight por alvo terapêutico  

#### 5.3 Dispositivo (transdutor / handpiece procedural)

Implementado inline em `TissueViewer.tsx` (não componente separado reutilizável):

| Elemento | Descrição |
|----------|-----------|
| Corpo | Capsule + toruses metálicos + ponta vidro |
| LEDs | 19 concêntricos (13 Android) — cor por λ |
| Cores λ | 660 → `#FF4500` (laranja); 808 → `#FF00FF` (magenta) |
| Posição | `transducerX`; inclinação `tiltZ` de `transducerAngle` |
| Offset base | `TRANSDUCER_BASE_OFFSET = 1.01` |

**Comparado ao US:** `TransducerModel.tsx` tem tipos IFU (planar/focado), ERA, face acústica, gel trail, contato, silhouette acústica, mapa 2D espelhado.

#### 5.4 Efeitos visuais do feixe de luz

| Elemento | Qtd desktop | Comportamento |
|----------|-------------|---------------|
| Beam core spheres | 12 (6–8 Android) | Additive, atenuação exp, twinkle pulsado |
| Beam halo spheres | 12 | Spread lateral λ-dependent |
| Anéis concêntricos | 10 (6 Android) | Toros animados descendo, depth fade |
| Scatter orgânico | 8 (660) / 12 (808) | Esferas subsuperficiais |
| Bioactive glow | 1 cilindro | Brilho se zona terapêutica ativa |
| Contact ring | 1 | Vermelho se irradiance > 500 |
| Contact spot | 1 | Escurece com pressão |
| Dose heat strip | **56 planos separados** | Verde→vermelho acumulado |
| Badge térmico | Html overlay | Se irradiance > 500 |

**Performance Android** (`therapeuticLabsPerformance.ts`): sombras off, menos nós, scatter memoizado.

#### 5.5 Interações 3D

| Ação | Efeito |
|------|--------|
| LMB drag | `transducerX`, `isDragging`, `draggingSpeed`, acumula `doseMap` |
| RMB drag | `transducerAngle` |
| Orbit | Zoom 6.5–11.5, sem pan, polar cap ~108° |
| Câmera | [0, 1.25, 8.6], FOV 42 |

#### 5.6 Iluminação

| Luz | Parâmetros |
|-----|------------|
| ambient | 0.38, `#f8f4ef` |
| hemisphere | `#fff8f0` / `#6b5344`, 0.28 |
| directional + shadow | [5,6,4], 0.82 (shadow desktop only) |
| fill | [-4,3,-2], 0.22 |
| point (beam) | cor do comprimento de onda |

**Sem** `SafeStudioEnvironment` dedicado (US tem).

---

### 6. Outputs textuais e painel de insights

Arquivo: `PhotobioInsightsPanel.tsx`

#### 6.1 Textos implementados

| Output | Conteúdo |
|--------|----------|
| Status terapêutico | Narrativa por zona Arndt-Schulz (`zoneMessage()`) |
| Alerta térmico | "Irradiância acima de 500 mW/cm²…" |
| Alerta anatômico | Adiposo espesso — ajuste de energia |
| Technique warnings | 5 tipos + `warningSuggestion()` acionável |
| Dose map analysis | Contagem under/optimal/over/untouched (após scanning) |
| Métricas grid | Irradiance, energy, fluence, mode, λ, muscleFluence, transmission % |
| Curva Arndt-Schulz | Recharts LineChart + ReferenceDot na fluência atual |
| Disclaimer | Compacto via componente compartilhado |

#### 6.2 Textos do engine não usados diretamente

- `getZoneInsight()` — texto mais técnico (citocromo c oxidase, ATP, PGE2…) substituído por `zoneMessage()` mais curto na UI  
- `interaction.insight` concatenado com anatomyWarning no engine — ignorado pelo painel  

#### 6.3 Lacunas textuais vs US

- Sem **fenômeno dominante** nomeado (`DominantEffect.tsx`)  
- Sem **linha de status fisiológico** (`physiologyStatusLine()`)  
- Sem **recomendações contextuais** baseadas em combinação de parâmetros (ex.: "aumente tempo porque adiposo espesso")  
- Sem **presets com cartão explicativo** (`PresetExplanationCard`)  
- Sem **coach guiado** (`GuidedTherapyCoach.tsx`)  
- Sem **comparação A/B narrativa** após snapshots  

---

### 7. Relações parâmetro → efeito (preservadas hoje)

| Parâmetro | Efeito na simulação | Efeito visual 3D |
|-----------|---------------------|------------------|
| ↑ λ 660→808 | ↓ absorção superficial, ↑ muscleFluenceRatio | Feixe mais profundo, mais scatter, cor magenta |
| ↑ power | ↑ irradiance, energy, fluence | Feixe mais intenso, risco térmico |
| ↓ spotSize | ↑ irradiance, ↑ fluence | Spot menor (contact spot) |
| ↑ exposureTime | ↑ energy, fluence | Sem mudança temporal animada |
| Pulsed + ↓ dutyCycle | ↓ energy, fluence | Pulsação visual nos anéis/nós |
| ↑ adiposeMm | ↓ muscleFluenceRatio | Camada adiposa mais espessa, `deepLoss` visual |
| ângulo ≠ 90° | ↓ effectiveFluence | Inclinação do feixe (`tiltZ`) |
| pressão baixa/alta | ↓/↑ dose factor | Indent + contact spot |
| scanning rápido | ↓ dose acumulada | Dose map irregular |
| parado + alta dose | warning bioinibição | Dose map concentrado no centro |

---

### 8. Lacunas consolidadas (PBM)

#### Críticas (impactam credibilidade pedagógica)

1. **Desacoplamento motor ↔ visual** — constantes de atenuação diferentes  
2. **Sem mapa de campo 2D/GPU** de fluência/ absorção no tecido  
3. **`penetrationProfile` calculado mas invisível**  
4. **Limiares inconsistentes** Arndt-Schulz vs dose map vs zona bioativa  
5. **Arndt-Schulz usa fluência nominal**, não `effectiveFluence` (técnica ignorada na classificação)  

#### Importantes (impactam completude vs US)

6. Sem modos de visualização 3D (Feixe / Penetração / Mapa de dose / Resposta)  
7. Sem modo guiado, desafios, scoring  
8. Sem snapshots / comparação de sessões  
9. Sem presets clínicos nomeados (reparo tecidual, analgesia, anti-inflamatório)  
10. Sem `SimulationStatusBar`  
11. Sem editor admin completo (ranges, defaults, cenários)  
12. Dispositivo 3D monolítico — sem variantes (cluster, laser pontual, cap, etc.)  
13. Sem camada óssea / estruturas profundas para contraste de penetração  
14. Tom de pele não afeta física (oportunidade pedagógica em λ 660)  

#### Performance / polish

15. Dose strip: 56 meshes → candidato a instancing (roadmap já lista)  
16. Sem SSS, normal maps avançados, animação de fluido interstitial  
17. Sem testes unitários do engine  
18. `PhotobioLabPage` ignora prop `embedded` (smoke test)  

---

## Parte II — Referência: Ultrassom Terapêutico (estado “ouro”)

> Use esta seção como **checklist de padrões** a adaptar para PBM, não como cópia literal de acústica.

### 1. Arquitetura de alto nível

```
UltrasoundTherapyLabPage
  → UltrasoundTherapyLabV2 (3 colunas desktop / mobile sheet)
      → UltrasoundTherapyControlPanel
      → UltrasoundTherapy3DViewer (4 viewer tabs)
      → UltrasoundTherapyInsightsPanel
      → SimulationStatusBar
      → TherapyModeDock
      → [guided] TherapyChallengePanel + GuidedTherapyCoach
```

**Arquivos-chave:** 49 componentes em `src/components/labs/ultrasound-therapy/` + 15+ libs em `src/lib/` + `src/simulation/ultrasoundTherapyEngine.ts`.

**Variantes de embed:** `TherapyDemoShell.tsx` para cápsulas com `ParameterQuickCards` flutuantes.

---

### 2. Pipeline simulação ↔ visual (o que PBM deve espelhar)

```
ultrasoundTherapyConfig
    → ultrasoundTherapyStore.runSimulation() [debounce 72ms]
    → ultrasoundTherapyEngine.ts
        → acoustic profile + thermal + risk + physiology
    → ultrasoundTherapyInteractionMap.ts (grid 72×56 desktop)
        → buildAcousticFieldTexture()
        → buildThermalFieldTexture()
        → buildInteractionFieldTexture()
    → TissueFieldOverlay.tsx (shader na geometria ondulada)
    → UltrasoundBeam.tsx (geometry from ultrasoundTherapyPhysics.ts)
```

**Princípio:** `ultrasoundTherapyPhysics.ts` é **single source of truth** para geometria do feixe — engine e 3D consomem os mesmos parâmetros.

**Equivalente desejado para PBM:**

```
photobioOptics.ts (NOVO)
    → perfil de absorção μ(λ, layer)
    → amostras de fluência vs profundidade
    → buildFluenceFieldTexture() / buildAbsorptionFieldTexture()
    → PhotobioBeam.tsx + TissueFieldOverlay adaptado
```

---

### 3. Camadas de simulação US (modelo para PBM)

| Camada US | Conteúdo | Analogia PBM sugerida |
|-----------|----------|----------------------|
| A — Campo acústico | Atenuação dB/cm/MHz, beam geometry, coupling | **Campo óptico**: Beer-Lambert, spot size, scattering |
| B — Térmico | Bioheat simplificado, CEM43, surface vs target temp | **Risco térmico** (já parcial) + acúmulo superficial |
| C — Fisiologia | Índices 0–1: hyperemia, edema, nociception… | **Resposta celular**: ATP, ROS, inflamação, analgesia (heurístico) |
| D — Risco / dominante | riskFactors[], dominantPhenomenon | **Zona Arndt-Schulz + fenômeno dominante** ("fotoativação" vs "saturação") |

---

### 4. Modos de visualização 3D (US)

Via `viewerTab` + `TherapyModeDock`:

| Tab | Visual | Legenda |
|-----|--------|---------|
| `interaction` | Visão geral + overlays condicionais | Fenômenos acústicos |
| `beam` | Textura acústica + `AcousticBeamOverlays` | `AcousticColormapLegend` (Pa) |
| `thermal` | Textura térmica + heat blend | `ThermalColormapLegend` (37–43°C) |
| `physiology` | `PhysiologyResponseOverlay` + damage markers | `PhysiologyLegend` |

**Proposta PBM equivalente:**

| Tab PBM | Visual |
|---------|--------|
| Anatomia | Stack atual + highlight de camada alvo |
| Feixe / Propagação | Mapa de intensidade + scatter |
| Fluência / Dose | Heatmap 2D de J/cm² acumulado |
| Resposta biológica | Overlay de "ativação mitocondrial" / zona Arndt-Schulz espacial |

---

### 5. Parâmetros US (completude de referência)

**Anatômicos:** scenario (shoulder/knee/lumbar/forearm/custom), customThicknesses, boneDepth, mixedLayer, transducerPosition  
**Transdutor:** transducerType (planar/focused IFU), frequency, ERA, beamProfile, focusDepth  
**Energia:** mode, dutyCycle, intensity, duration, coupling (good/poor + gel runtime), movement (stationary/scanning)  
**Fisiologia:** tissuePerfusionProfile  
**UX:** therapyTargetGoal, visualizationOptions (8 toggles), clinical presets, 5 guided challenges  

**PBM hoje:** ~15 parâmetros vs ~25+ no US, sem cenários espaciais, sem tipos de dispositivo, sem alvo terapêutico explícito.

---

### 6. Pedagogia e UX US (a replicar)

| Feature | Arquivo(s) | Benefício |
|---------|------------|-----------|
| Modo Free / Guided | `TherapyLabModeToggle.tsx` | Trilha instrucional |
| 5 desafios | `ultrasoundTherapyChallenges.ts`, `TherapyChallengePanel.tsx` | Objetivos mensuráveis |
| Coach contextual | `GuidedTherapyCoach.tsx` | Hints success/warn/info |
| Scoring 0–100 | `ultrasoundTherapyScoring.ts`, `TherapyScoreBadge.tsx` | Gamificação leve |
| Snapshots | `SimulationSnapshotButton.tsx`, `SessionTimeline.tsx` | Experimentação |
| Comparação A/B | `SimulationComparisonPanel.tsx` | "Antes/depois" narrativo |
| Target tissue | `TargetTissueSelector.tsx` | Coerência setup ↔ objetivo |
| Quick cards | `ParameterQuickCards.tsx` | Status por parâmetro |
| Status bar | `SimulationStatusBar.tsx` | Métricas sempre visíveis |
| Presets clínicos | `ultrasoundTherapyPresets.ts` | Ponto de partida + exemplo ruim |
| Safety coloring | `therapyMetricSafety.ts` | ok / warn / risk consistente |
| Demo shell | `TherapyDemoShell.tsx` | Embed LMS |
| Admin editor | `UltrasoundTherapyLabConfigEditor.tsx` | Customização instrutor |

**Roadmap PBM já documentado** (`docs/therapeutic-labs-ux-roadmap.md`):

- [ ] Instancing dose strip  
- [ ] Modo guiado espelhando US (janela terapêutica como desafio)  
- [ ] Presets clínicos nomeados  

---

### 7. Qualidade visual US (checklist)

- [x] Tier desktop vs Android (`ultrasoundVisualQuality.ts`)  
- [x] Texturas 768×768 procedurais compartilhadas  
- [x] Geometria orgânica ondulada encaixada  
- [x] Tom de pele clínico sorteado  
- [x] Transdutor modelado com contato, gel, trail  
- [x] Colormaps calibrados + legendas  
- [x] Shader overlay anti z-fighting (`TissueFieldOverlay`)  
- [x] GPU texture lifecycle seguro  
- [x] Studio lighting (`SafeStudioEnvironment`)  
- [x] Fenômenos opcionais: cavitation, bone reflection, safety zone  

**PBM tem:** texturas + geometria compartilhadas, feixe procedural animado, indent de contato.  
**PBM não tem:** field textures, colormap legends, transdutor componentizado, gel/coupling, studio env, fenômenos toggleáveis.

---

## Parte III — Matriz comparativa detalhada

| Critério | PBM | US Terapêutico | Gap / Ação sugerida |
|----------|-----|----------------|---------------------|
| **Arquivos UI dedicados** | 10 | 49 | Extrair TissueViewer em subcomponentes |
| **Libs de simulação** | 1 engine | 15+ | Criar `photobioOptics.ts`, `photobioInteractionMap.ts`, `fluenceFieldTexture.ts` |
| **Interaction map 2D** | ❌ | ✅ 72×56 | Grid fluência + absorção por célula |
| **Motor ↔ visual acoplado** | ❌ | ✅ | Unificar constantes k, profundidade, spot |
| **Viewer tabs** | 1 | 4 | Dock: Anatomia / Feixe / Fluência / Bio |
| **Status bar** | Header badges | Barra dedicada | `PhotobioSimulationStatusBar` |
| **Modo guiado** | ❌ | ✅ 5 challenges | Desafios: janela terapêutica, λ compare, scanning, adiposo |
| **Scoring** | ❌ | ✅ | Critérios: fluência 2–8, técnica, segurança térmica |
| **Snapshots** | ❌ | ✅ | Comparar 660 vs 808, CW vs Pulsed |
| **Presets clínicos** | ❌ | ✅ 4 presets | Reparo, analgesia, anti-inflamatório, overdose |
| **Admin editor** | controlModes | Full editor | `PhotobioLabConfigEditor.tsx` |
| **Tipos de dispositivo** | 1 handpiece | planar + focused IFU | Cluster LED, laser, cap |
| **Camadas teciduais** | 4 | 4 + osso + mixed | Opcional osso para contraste IR |
| **Coupling / gel** | Pressão apenas | Gel espacial + effectiveCoupling | Contato óptico / gel condutor |
| **Penetração UI** | ❌ | depth samples + map | Gráfico I(z) + perfil por camada |
| **Dominant effect text** | Zona Arndt-Schulz | `DominantEffect.tsx` | "Fotoativação mitocondrial" etc. |
| **Thermal model** | Threshold 500 mW/cm² | Bioheat + CEM43 | Acúmulo superficial simplificado |
| **Physiology overlay** | Cilindro bioactive | Full overlay + markers | Índices ATP/ROS/inflamação |
| **Dose map** | 1D strip 56 bins | 2D thermal/acoustic maps | Evoluir para mapa 2D fluência |
| **Performance dose viz** | 56 meshes | Instanced overlay | Instancing (roadmap) |
| **Demo embed shell** | ❌ | `TherapyDemoShell` | `PhotobioDemoShell` |
| **Mobile bottom sheet** | Tab bar simples | 5-tab sheet | Challenge + quick cards |
| **Unit tests** | ❌ | ❌ | Testar engine + optics |
| **Documentação** | ANAMNESE §4 parcialmente stale | audit + interaction-mode docs | Manter este doc atualizado |

---

## Parte IV — Propostas prioritárias para a IA implementadora

> Seção explícita para orientar a próxima IA. Ordenado por impacto pedagógico × esforço relativo.

### Prioridade 1 — Acoplamento físico-visual (fundacional)

1. Criar `src/lib/photobioOptics.ts` com:
   - μ_eff(λ, tissueType) por camada  
   - Amostragem de fluência F(z) = F₀ · exp(−∫μ dz)  
   - Spot gaussiano lateral  
2. Criar `src/lib/photobioInteractionMap.ts` — grid 2D (reuse pattern de `ultrasoundTherapyInteractionMap.ts`)  
3. Criar `src/lib/fluenceFieldTexture.ts` + `PhotobioFieldOverlay.tsx`  
4. Refatorar `TissueViewer` beam nodes para ler samples do optics module  
5. Alinhar limiares: Arndt-Schulz, dose map, bioactive glow — **uma tabela única**  
6. Classificar zona por `effectiveFluence`, não só fluência nominal  

### Prioridade 2 — Visualização multicamada (inspirado US tabs)

7. `PhotobioModeDock` + store `viewerTab`  
8. Tab Feixe: colormap + legenda (mW/cm² ou W/m²)  
9. Tab Fluência: mapa acumulado J/cm² (session + parâmetros)  
10. Tab Penetração: gráfico F(z) + barras `penetrationProfile`  
11. Tab Bio: overlay resposta celular heurística  

### Prioridade 3 — Dispositivo e tecidos

12. Extrair `PhotobioDeviceModel.tsx` — variantes: cluster 660/808, laser pontual  
13. Melhorar handpiece: botão power, display mW, cabo, standby LED  
14. Opcional: camada óssea esquelética para demonstrar limite IR  
15. Melanina: slider ou preset Fitzpatrick afetando μ superficial (660)  
16. `SafeStudioEnvironment` + highlight de camada alvo  

### Prioridade 4 — Pedagogia (copiar playbook US)

17. `photobioChallenges.ts` — mínimo 4 desafios:
    - Atingir janela 2–8 J/cm² em músculo  
    - Comparar 660 vs 808 em paciente obeso  
    - Corrigir técnica (ângulo + scanning)  
    - Evitar bioinibição por overdose  
18. `GuidedPhotobioCoach.tsx` + scoring  
19. Presets: reparo tecidual, analgesia aguda, anti-inflamatório, exemplo inadequado  
20. `PhotobioDemoShell` para embed  

### Prioridade 5 — Admin e polish

21. `PhotobioLabConfigEditor.tsx` — ranges, defaults, controlModes  
22. Instancing dose strip  
23. Testes unitários `photobioEngine` + `photobioOptics`  
24. Integrar AI Tutor contextual no shell (opcional — plataforma já tem evidência PubMed)  

---

## Parte V — Referências de código (índice rápido)

### Fotobiomodulação

```
src/components/labs/photobio/
  PhotobioLabV2.tsx
  TissueViewer.tsx          ← 3D monolítico (~925 linhas)
  PhotobioControls.tsx
  PhotobioInsightsPanel.tsx
  AnatomyControls.tsx
  LabConfigMenu.tsx
src/pages/PhotobioLabPage.tsx
src/stores/photobioStore.ts
src/simulation/photobioEngine.ts
```

### Ultrassom Terapêutico (referência)

```
src/components/labs/ultrasound-therapy/     ← 49 arquivos
src/simulation/ultrasoundTherapyEngine.ts
src/stores/ultrasoundTherapyStore.ts
src/types/ultrasoundTherapyConfig.ts
src/lib/ultrasoundTherapyPhysics.ts         ← SSOT beam
src/lib/ultrasoundTherapyInteractionMap.ts
src/lib/acousticFieldTexture.ts
src/lib/thermalFieldTexture.ts
src/lib/interactionFieldTexture.ts
src/config/ultrasoundTherapyChallenges.ts
src/config/ultrasoundTherapyPresets.ts
src/components/admin/UltrasoundTherapyLabConfigEditor.tsx
```

### Compartilhado

```
src/lib/clinicalTissueGeometry.ts
src/lib/clinicalTissueTextures.ts
src/lib/clinicalSkinTones.ts
src/lib/therapeuticLabsPerformance.ts
src/lib/labPerformance.ts
docs/therapeutic-labs-ux-roadmap.md
docs/ANAMNESE_SIMULACOES_3D_TERAPEUTICAS.md  ← §4 parcialmente desatualizado
```

---

## Parte VI — Notas de desatualização do doc legado

O arquivo `docs/ANAMNESE_SIMULACOES_3D_TERAPEUTICAS.md` (§4 Fotobiomodulação) contém informações **obsoletas**:

| Item legado | Estado real (2026-06-20) |
|-------------|--------------------------|
| dutyCycle "fixo 50%, store força" | ✅ Funcional 10–90% em Pulsed |
| transducerAngle/contactPressure "só 3D" | ✅ Sliders em PhotobioControls "Técnica de aplicação" |
| technique "sem slider no painel" | ✅ Corrigido |

Este documento (`ANAMNESE_FOTOMODULACAO_VS_ULTRASSOM_TERAPICO.md`) substitui §4 para fins de planejamento de evolução do PBM.

---

## Apêndice A — Equações de referência (paper ProGenia)

**PBM (Beer-Lambert educacional):**

```
F(z, λ) = F₀(λ) · exp(−μ_eff(λ) · z)
```

**US (atenuação):**

```
A(z, f) ∝ exp(−μ · f · z)
```

---

## Apêndice B — Prompt sugerido para a próxima IA

```
Leia o documento ANAMNESE_FOTOMODULACAO_VS_ULTRASSOM_TERAPICO.md do repositório ProGenia.

Com base nele, proponha um plano de implementação em fases (4–6 sprints) para elevar o lab de 
Fotobiomodulação ao padrão de qualidade do lab de Ultrassom Terapêutico, priorizando:

1. Acoplamento photobioOptics ↔ visual 3D (interaction map + field texture)
2. Modos de visualização (Feixe, Fluência, Penetração, Resposta biológica)
3. Dispositivo 3D componentizado com variantes
4. Modo guiado com 4+ desafios e scoring
5. Admin editor completo

Para cada item, indique: arquivos a criar/modificar, interfaces TypeScript, relações físicas 
a preservar, e riscos de performance Android. Não proponha simulação clínica de alta fidelidade 
— mantenha heurística educacional.
```

---

*Documento gerado para handoff entre agentes/equipes. Repositório: `/Users/matheusvalenca/progenia`.*
