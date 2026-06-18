# Anamnese Completa — Simulações 3D Terapêuticas (ProGenia)

**Versão:** 2026-06-04  
**Objetivo deste documento:** Fornecer à outra IA (ou equipe de design) um inventário exaustivo do estado atual das simulações terapêuticas em 3D — design visual, recursos gráficos, parâmetros configuráveis, efeitos, motores de simulação, restrições técnicas e lacunas — para que possa analisar e propor melhorias em **realismo**, **ludicidade**, **pedagogia visual** e **impacto educacional**.

**Escopo principal:** três labs terapêuticos com visualização 3D (React Three Fiber / Three.js):
1. **Ultrassom Terapêutico** (`ultrasound_therapy` / `ultrassom_terapeutico`)
2. **Fotobiomodulação** (`photobiomodulation` / `fbm`)
3. **Eletroterapia / TENS** (`tens`)

**Escopo secundário (mencionado por contexto):** ultrassom diagnóstico unificado (`UltrasoundUnifiedLab`), wrappers compartilhados, editores admin.

---

## Instruções para a IA analista

Ao ler este documento, considere:

- O que já existe **funcionalmente** vs o que é **puramente ilustrativo/educacional** (não é FEA, CFD ou acústica numérica real).
- Onde **simulação numérica** e **visual 3D** estão **desacoplados** (parâmetros que afetam só um dos lados).
- Restrições de **performance em Android WebView** (sombras, antialiasing, DPR reduzidos).
- Oportunidades para tornar a experiência **mais lúdica** (feedback, gamificação, microinterações, narrativa) sem sacrificar credibilidade clínica.
- Oportunidades para **realismo visual** (materiais PBR, anatomia, iluminação, animações, coerência física aparente).
- Oportunidades **pedagógicas** (overlays, comparação antes/depois, trilhas guiadas, alertas visuais, métricas ligadas ao 3D).

---

## 1. Stack tecnológico e arquitetura geral

| Camada | Tecnologia | Observação |
|--------|------------|------------|
| UI | React + TypeScript + Tailwind + shadcn/ui | Painéis, sliders, abas |
| Estado | Zustand (stores por lab) | Config + simulação + UI |
| 3D | `@react-three/fiber` + `@react-three/drei` + Three.js r15x | Canvas WebGL |
| Canvas wrapper | `LabCanvas` → `LabCanvasSurface` | Defer mount em WebView nativo |
| Performance | `src/lib/labPerformance.ts` | Tier desktop vs Android |
| Texturas | Canvas 2D procedural → `CanvasTexture` | 768×768, map + bumpMap |
| Geometria tecidual | `BoxGeometry` subdividido + deformação de vértices | Interfaces onduladas |
| Shaders custom | Apenas gel (`gelSurface.ts`) | `discard` por altura |
| Simulação | Heurísticas TypeScript puras | Não há worker de física 3D |

### Fluxo de dados típico

```
config_data (Supabase / admin)
    → store.initializeLab(config)
    → normalização / clamp nos ranges
    → simulate*() on parameter change
    → simulationResult → painel de insights + efeitos 3D condicionais
    → componentes 3D leem config + simulationResult + parâmetros visuais locais
```

### Sistema de coordenadas 3D (labs terapêuticos)

| Eixo | Convenção |
|------|-----------|
| **Y** | Superfície da pele em **Y ≈ 0**; profundidade aumenta para **Y negativo** |
| **X / Z** | Largura / profundidade do bloco de tecido (~20 × 8 unidades mundo) |
| **Posição transdutor (US terapêutico)** | `transducerPosition.x/y` ∈ [-1, 1] → mundo X = x×8, Z = y×3 |

---

## 2. Infraestrutura visual compartilhada

### 2.1 Tons de pele — `src/lib/clinicalSkinTones.ts`

| Campo por tom | Uso |
|---------------|-----|
| `id`, `label` | Identificação |
| `color`, `attenuationColor` | Referência ultrassom |
| `epidermis`, `dermis` | Cores base das texturas |
| `canvasRgb`, `poreRgb` | Ruído procedural de poros |

**5 tons:** morena clara → morena → mulata clara → mulata → morena escura.

**Comportamento:** `pickRandomClinicalSkinTone()` sorteia **uma vez por sessão** ao montar o viewer (estável até recarregar).

---

### 2.2 Texturas procedurais — `src/lib/clinicalTissueTextures.ts`

| Parâmetro | Valor |
|-----------|-------|
| Resolução | 768×768 px |
| PRNG | Seeded por `skinTone.id + kind + lesionIndex` |
| Saída | `{ map: CanvasTexture, bumpMap: CanvasTexture }` |
| Repeat UV | muscle 3.2, bone 4.2, fat/adipose 1.8, skin 2.4 |

#### Detalhe por tipo de tecido (color map + bump)

| Tipo | Elementos visuais pintados |
|------|---------------------------|
| **skin / epidermis** | Manchas quentes/frias, poros finos, folículos (anel escuro), micro-rugas, melanina; lesão: eritema se `lesionIndex > 0.25` |
| **dermis** | Fibras de colágeno onduladas, rede capilar (pontos + ramificações) |
| **fat / adipose** | Grade 9×9 de lóbulos adiposos (elipses), septos conjuntivos |
| **muscle** | 28 fascículos horizontais, perimísio claro, fibras verticais, marmoreio; lesão: áreas de dano se `lesionIndex > 0.45` |
| **bone** | Osteons (círculos Havers), lacunas, porosidade, trabéculas |

#### Materiais (`CLINICAL_TISSUE_SURFACE` + `clinicalTissueMaterialProps()`)

| Tissue | roughness | metalness | bumpScale |
|--------|-----------|-----------|-----------|
| skin | 0.78 | 0.015 | 0.014 |
| fat | 0.86 | 0 | 0.011 |
| muscle | 0.82 | 0.025 | 0.009 |
| bone | 0.74 | 0.04 | 0.007 |

Material: `meshStandardMaterial` opaco (sem `transmission`).

---

### 2.3 Geometria orgânica — `src/lib/clinicalTissueGeometry.ts`

| Constante / função | Valor / papel |
|--------------------|---------------|
| `TISSUE_WAVE_INTENSITY` | 1.38 — escala global das ondulações |
| `ORGANIC_LAYER_SEGMENTS` | [44, 10, 24] |
| `buildOrganicLayerGeometry()` | Deforma BoxGeometry nas interfaces superior/inferior + bulge lateral |
| `tissueInterfaceWave()` | Ondulação compartilhada entre camadas adjacentes (mesmo seed = encaixe) |
| `SKIN_SURFACE_MICRO_AMP` | 0.0042 — micro-rugas na superfície cutânea (skin/epidermis) |
| `createTissueStackSeed()` | Seed aleatório por sessão para padrão de ondas |

#### Multiplicadores de onda por camada (`ORGANIC_LAYER_WAVE`)

| kind | top | bottom |
|------|-----|--------|
| skin | 0.05 | 0.22 |
| epidermis | 0.06 | 0.20 |
| dermis | 0.18 | 0.18 |
| fat / adipose | 0.19 | 0.18–0.19 |
| muscle | 0.15 | 0.13 |
| bone | 0.11 | 0.08 |

**Superfície superior da pele:** amplitude top reduzida (`topAmplitudeScale: 0.018–0.022`) para manter plano de contato com transdutor.

---

### 2.4 Canvas e performance — `LabCanvas`, `LabCanvasSurface`, `labPerformance.ts`

| Setting | Desktop / iOS | Android nativo |
|---------|---------------|----------------|
| `dpr` | [1, 2] | **1** |
| `gl.antialias` | true | **false** |
| `shadows` | true | **false** |
| `frameloop` | `"always"` | `"always"` (evita frame congelado) |
| `performance` adaptativo | min 0.5, max 1.5 | desabilitado |
| `powerPreference` | high-performance | idem |

**LabCanvasSurface:** aguarda container ≥ 2×2 px antes de montar WebGL (WebView Android).

**OrbitControls:** damping desligado no Android; velocidades reduzidas.

---

## 3. Lab — Ultrassom Terapêutico

### 3.1 Arquivos principais

| Papel | Caminho |
|-------|---------|
| Página | `src/pages/UltrasoundTherapyLabPage.tsx` |
| Shell UI | `src/components/labs/ultrasound-therapy/UltrasoundTherapyLabV2.tsx` |
| Viewer 3D | `UltrasoundTherapy3DViewer.tsx` |
| Store | `src/stores/ultrasoundTherapyStore.ts` |
| Tipos / defaults | `src/types/ultrasoundTherapyConfig.ts` |
| Motor | `src/simulation/ultrasoundTherapyEngine.ts` |
| Stack anatômico | `src/lib/ultrasoundTherapyStack.ts` |
| Feixe acústico 3D | `src/lib/ultrasoundTherapyBeam.ts` + `UltrasoundBeam.tsx` |
| Transdutores | `src/config/therapeuticTransducerDefinitions.ts` |
| Presets clínicos | `src/config/ultrasoundTherapyPresets.ts` |
| Admin | `src/components/admin/UltrasoundTherapyLabConfigEditor.tsx` |

---

### 3.2 Abas do viewer 3D (`viewerTab`)

| Aba | ID | Conteúdo visível |
|-----|-----|------------------|
| Anatomia | `anatomy` | Tecidos + labels + transdutor + gel + drag na pele |
| Feixe | `beam` | + envelope acústico, anéis, cavitação, reflexão óssea |
| Térmico | `thermal` | + heatmap de temperatura, timeline (painel 2D) |

---

### 3.3 Componentes 3D — inventário visual

#### `TissueLayers.tsx`
- Bloco 20×8 cm, camadas skin → fat → muscle → bone
- Cenários preset ou custom (`buildStackLayers`)
- `renderOrder`: bone 0, muscle 1, fat 2, skin 3
- `castShadow` + `receiveShadow`
- Labels 3D (`@react-three/drei` Text) na aba anatomia

**Espessuras preset (cm):**

| Cenário | Pele | Gordura | Músculo | Osso |
|---------|------|---------|---------|------|
| shoulder | 0.2 | 0.5 | 2.0 | 1.0 |
| knee | 0.2 | 0.3 | 1.5 | 1.0 |
| lumbar | 0.2 | 1.0 | 3.0 | — |
| forearm | 0.2 | 0.2 | 1.0 | — |
| custom | sliders | sliders | sliders | boneDepth |

#### `MixedLayer.tsx` (cenário custom + enabled)
- Plano horizontal em `mixedLayer.depth` cm
- Divisão lateral músculo (esq) / osso (dir) por `division` 0–100%
- Espessura fixa 0.5 cm

#### `TransducerModel.tsx` (~1027 linhas)
Três estilos corporais via `transducerType`:

| Tipo | `headBodyStyle` | Aparência |
|------|-----------------|-----------|
| `circular_planar` | `pistol_circular` | Cabeçote cilíndrico, lathe collar/pescoço, pega swan-neck, cabo |
| `focused_ifu` | `ifu_lens` | Lente convexa cromada, face mais alta |
| `rectangular_planar` | `rectangular_block` | RoundedBox, parafusos, placa |

**Constantes visuais:**
- `MODEL_SCALE = 1.95`
- `CONTACT_CLEARANCE = 0.012`
- `SKIN_SURFACE_Y = 0`
- `ERA_VISUAL_CAP_CM2 = 3.0` — face 3D limitada visualmente (física usa ERA real)

**Face de contato:**
- Gasket borracha, bezel cromado, janela cerâmica (`meshPhysicalMaterial`)
- **Acoplamento bom:** domo de gel lathe (`THERAPY_GEL_GOOD`)
- **Acoplamento ruim:** manchas de gel irregulares + shader

**Feedback animado:**
- Emissive cerâmica pulsa com mode/duty/intensity
- LED verde na pega (sync duty se pulsado)
- Halo azul no contato (respiração CW; on/off pulsado)
- Anel âmbar em modo pulsado

**Materiais (`therapyVisualConstants.ts`):**
- Plástico: `#ffffff`, clearcoat alto
- Chrome: metalness 0.92, clearcoat 0.95
- Borracha: `#475569`
- Gel bom: `#1ba3e8`, opacity ~0.64
- Gel ruim: opacity ~0.52, blobs irregulares

#### `CouplingGelTrail.tsx`
- Gel pré-aplicado na superfície (height field 96×40 segmentos)
- **Bom:** 24–30 carimbos espalhados; deforma levemente na varredura
- **Ruim:** 8–12 blobs altos e irregulares
- `renderOrder = 30`
- Shader descarta fragmentos com altura < 0.0015

#### `UltrasoundBeam.tsx`
- Envelope lathe externo (-6 dB): azul (bom) / âmbar (ruim)
- Núcleo interno pulsante
- 7 anéis de corte coloridos por intensidade relativa vs profundidade
- Anel near-field (só planar)
- Anel profundidade efetiva (cyan, da simulação)
- Anel foco (magenta, perfil focused)
- Labels 3D: near-field, profundidade efetiva, zona focal

**Fórmulas 3D (`ultrasoundTherapyBeam.ts`):** near-field N ≈ D²/4λ, divergência far-field, waist IFU via `waistRatio`.

#### `TemperatureHeatmap.tsx` (aba thermal)
- Esfera hotspot superficial (cor 37–50°C)
- Esfera max hotspot ∝ √(ERA/π); ×1.5 se scanning
- Halo difuso de área tratada
- Volume gradiente pulsante
- Zona alvo separada se `maxTempDepth > 0.5`

**Escala de cor:** azul 37°C → verde 40 → amarelo 43 → laranja 46 → vermelho 50°C

#### `BoneReflection.tsx`
- Cone amarelo para cima na profundidade óssea
- Esfera vermelha periosteal se `periostealRisk > 0.3`

#### `CavitationEffect.tsx`
- Até 64 bolhas instanciadas (esferas 6 segmentos)
- Contagem ∝ intensity²; animação sync mode/duty

#### `TransducerSkinDragSurface.tsx`
- Plano invisível 17.5×7.5 em Y=0.008
- Só aba anatomy; desabilita OrbitControls ao arrastar

#### Componentes 2D / UI no mesmo módulo

| Componente | Função |
|------------|--------|
| `TransducerMap2D.tsx` | Mapa 2D arrastável + presets posição |
| `ThermalTimeline.tsx` | Gráfico canvas temp vs tempo |
| `DominantEffect.tsx` | Card heurístico efeito dominante |
| `UltrasoundTherapyControlPanel.tsx` | Controles aluno |
| `UltrasoundTherapyInsightsPanel.tsx` | Métricas + risco + recomendações |

---

### 3.4 Iluminação e ambiente (`UltrasoundTherapy3DViewer.tsx`)

| Elemento | Configuração |
|----------|--------------|
| Câmera | [0, 2.5, 10], FOV 55° |
| Environment | preset `"studio"`, intensity 0.5 (0.35 Android) |
| Hemisphere | intensity 0.28 |
| Directional key | shadows 2048², intensity 0.95 |
| Fill | 3 directionals + 2 points |
| Fog | `#0f172a`, near 15, far 35 |
| Grid | 24×24 em Y = -4 |

**Animação varredura:** `movement === "scanning"` → X oscila `sin(t)×0.35` a cada 100 ms.

---

### 3.5 Parâmetros configuráveis — schema completo

#### `UltrasoundTherapyConfig` — defaults (`defaultUltrasoundTherapyConfig`)

| Parâmetro | Tipo | Default | Range típico |
|-----------|------|---------|--------------|
| `scenario` | enum | `shoulder` | shoulder, knee, lumbar, forearm, custom |
| `customThicknesses.skin` | cm | 0.2 | 0.1–0.5 |
| `customThicknesses.fat` | cm | 0.5 | 0.1–2.0 |
| `customThicknesses.muscle` | cm | 2.0 | 0.5–5.0 |
| `customThicknesses.boneDepth` | cm | derivado | 1.0–6.0 |
| `mixedLayer.enabled` | bool | false | — |
| `mixedLayer.depth` | cm | 2.0 | 0.5–5.0 |
| `mixedLayer.division` | % | 50 | 0–100 |
| `transducerPosition.x/y` | norm | 0, 0 | -1..1 |
| `transducerType` | enum | `circular_planar` | circular_planar, focused_ifu, rectangular_planar |
| `frequency` | MHz | 1.1 | 1–3 (admin configurável) |
| `era` | cm² | 5.0 | 2.5–6.5 |
| `beamProfile` | enum | `planar` | planar, focused (locked se IFU) |
| `focusDepth` | cm | 2.5 | 1.0–5.0 |
| `mode` | enum | `continuous` | continuous, pulsed |
| `dutyCycle` | % | 50 | 10–100 |
| `intensity` | W/cm² | 1.0 | 0.1–5.0 |
| `duration` | min | 8 | 1–30 |
| `coupling` | enum | `good` | good, poor |
| `movement` | enum | `scanning` | stationary, scanning |
| `tissuePerfusionProfile` | enum | `normal` | normal, baixa_circulacao, alta_circulacao |

#### Flags `enabledControls` (cada um pode ocultar UI do aluno)

scenario, customThicknesses, mixedLayer, tissuePerfusionProfile, frequency, era, transducerType, beamProfile, focusDepth, mode, dutyCycle, intensity, duration, coupling, movement

#### Presets clínicos (`ultrasoundTherapyPresets.ts`)

| ID | Propósito pedagógico |
|----|---------------------|
| `analgesia-superficial` | 3 MHz, ERA 3, pulsado, superficial |
| `aquecimento-profundo` | IFU, foco 3 cm, contínuo, lombar |
| `regiao-proximo-osso` | Joelho, pulsed, scanning |
| `exemplo-inadequado` | Parâmetros perigosos (coupling poor, stationary, alta intensidade) |

---

### 3.6 Definições de transdutor (`therapeuticTransducerDefinitions.ts`)

Por tipo:

| Campo | Descrição |
|-------|-----------|
| `faceShape` | circle / rounded_rect |
| `defaultBeamProfile`, `lockBeamProfile` | IFU trava focused |
| `defaultFocusDepth` | cm |
| `eraRange.min/max` | limites ERA |
| `visual.faceVisualScale`, `headBezelRatio`, `ceramicProfile`, `aspectRatio`, `headBodyStyle`, `headTint` | aparência 3D |
| `beam.lateralScale`, `waistRatio`, `nearFieldScale` | geometria do feixe |

**Decisão de design:** ERA física (simulação) vs ERA visual (cap 3 cm²) — cabeçotes não “ estouram” no slider alto.

---

### 3.7 Motor de simulação (`ultrasoundTherapyEngine.ts`)

#### Entradas passadas ao motor

frequency, intensity, era, mode, dutyCycle, duration, coupling, movement, scenario, customThicknesses, mixedLayer, transducerPosition, tissuePerfusionProfile

**NÃO passam ao motor (só visual 3D):** `beamProfile`, `focusDepth`, `transducerType`

#### Propriedades teciduais (stack)

| Camada | atenuação dB/cm/MHz | calor rel. | perfusão rel. |
|--------|---------------------|------------|---------------|
| skin | 0.5 | 0.8 | 1.0 |
| fat | 0.3 | 0.6 | 0.3 |
| muscle | 0.7 | 1.0 | 1.5 |
| bone | 2.0 | 0.5 | 0.2 |

#### Heurísticas principais

| Modelo | Valor / comportamento |
|--------|----------------------|
| Eficiência acoplamento | good 0.95, poor 0.70 |
| Fator térmico movimento | scanning 0.4, stationary 1.0 |
| Superfície poor coupling | ×1.4 aquecimento |
| Profundidade poor coupling | ×0.85 |
| Profundidade efetiva | I = 50% superfície |
| Penetração | I = 10% superfície |
| Temperatura | clamp 37–50°C output |
| CEM43 | f(T), R=0.5 se T>43 else 0.25 |
| Reflexão óssea | 0.3–0.5 se I_osso > 10% |
| Risco periosteal | hotspot ≤0.5 cm do osso |
| Área tratada scanning | πr² × 2.5 |
| Perfusion multiplier | normal 1.0, baixa 0.55, alta 1.45 |

#### Saídas (`UltrasoundTherapyResult`)

powerW, energyJ, doseJcm2, effectiveDepth, penetrationDepth, surfaceTemp, targetTemp, maxTemp, maxTempDepth, thermalDose, cumulativeDose, risk (low/medium/high), riskFactors[], beamWidth, treatedArea, boneReflection, periostealRisk

#### Efeito dominante (heurística UI — `DominantEffect.tsx`)

Prioridade: periosteal → calor superficial → calor profundo → cavitação → distribuído → dose térmica → equilibrado

---

### 3.8 Configuração admin

**Editor:** `UltrasoundTherapyLabConfigEditor.tsx`

| Aba | Persiste em config_data |
|-----|-------------------------|
| Anatomia e Preview | scenario, customThicknesses, mixedLayer, tissuePerfusionProfile |
| Controles Disponíveis | enabledControls.* |
| Limites dos Parâmetros | ranges.* |

**Preview admin (NÃO persiste):** frequency, intensity, era, mode, dutyCycle, duration, coupling, movement — só preview local.

**Lacunas admin:** sem UI para defaults iniciais de transducerType, beamProfile, focusDepth; `enabledControls.focusDepth` sem switch; ranges de customThicknesses/focusDepth sem editor dedicado.

---

## 4. Lab — Fotobiomodulação

### 4.1 Arquivos principais

| Papel | Caminho |
|-------|---------|
| Shell | `src/components/labs/photobio/PhotobioLabV2.tsx` |
| 3D | `src/components/labs/photobio/TissueViewer.tsx` |
| Controles | `PhotobioControls.tsx`, `AnatomyControls.tsx` |
| Insights | `PhotobioInsightsPanel.tsx` |
| Store | `src/stores/photobioStore.ts` |
| Motor | `src/simulation/photobioEngine.ts` |
| Admin visibility | `LabConfigMenu.tsx` |

---

### 4.2 Cena 3D (`TissueViewer.tsx` → `TissueScene`)

#### Tecidos
- 4 camadas: epiderme, derme, adiposo, músculo
- Escala: `mmToWorld = 0.09`; largura 8.5, profundidade 3.4
- `applyContactIndent()` — depressão gaussiana em epiderme/derme por pressão do transdutor
- Toggle **"Visão translúcida"** — opacity 0.46–0.55, `translucentBoost ×1.35` nos feixes

#### Transdutor (modelo premium procedural)
- Capsule body, toruses metálicos, matriz 19 LEDs concêntricos
- Cores por λ: 660 nm laranja / 808 nm magenta
- `TRANSDUCER_BASE_OFFSET = 1.01`
- Inclinação `tiltZ` de `transducerAngle`

#### Efeitos de luz / feixe

| Elemento | Quantidade | Comportamento |
|----------|------------|---------------|
| Beam core | 12 esferas | Additive blending, atenuação exp por profundidade, twinkle pulsado |
| Beam halo | 12 esferas | Spread lateral, wavelength-dependent |
| Anéis concêntricos | 10 toros | Cascata animada Y, depth fade |
| Scatter orgânico | 8 (660) / 12 (808) | Esferas subsuperficiais |
| Bioactive glow | 1 cilindro oco | Brilho se zona Arndt-Schulz ativa |
| Contact ring | 1 ring | Vermelho se `irradiance > 500` |
| Contact spot | 1 circle | Escurecimento por pressão |
| Dose heat strip | 56 planos | Verde→vermelho acumulado ao arrastar |
| Labels Html | 4 | Nomes das camadas |
| Badge térmico | Html | Se irradiance > 500 |

#### Iluminação

| Luz | Parâmetros |
|-----|------------|
| ambient | 0.38, `#f8f4ef` |
| hemisphere | `#fff8f0` / `#6b5344`, 0.28 |
| directional + shadow | [5,6,4], 0.82 |
| fill | [-4,3,-2], 0.22 |
| point (beam) | cor do comprimento de onda |

#### Câmera / controles
- Camera: [0, 1.25, 8.6], FOV 42
- Orbit: distância 6.5–11.5, sem pan

---

### 4.3 Interações 3D (sem slider no painel)

| Ação | Parâmetro afetado | Range |
|------|-------------------|-------|
| Arrastar botão esquerdo | `transducerX` | -2.8 … 2.8 |
| Arrastar botão direito | `transducerAngle` | 0 … 180° |
| Durante drag | `isDragging`, `draggingSpeed` | speed 0.2–5 |
| Acumula dose | `doseMap[56]` | max ~80 por bin |

**Nota pedagógica:** `contactPressure` e `transducerAngle` afetam simulação mas **não têm sliders** — só defaults ou config admin.

---

### 4.4 Parâmetros do store

| Parâmetro | Default | Range | UI exposta |
|-----------|---------|-------|------------|
| `wavelength` | 660 | 660 \| 808 nm | sim |
| `power` | 100 mW | 10–500 | sim |
| `spotSize` | 0.5 cm² | 0.1–1.0 | sim |
| `exposureTime` | 30 s | 1–300 | sim |
| `mode` | CW | CW \| Pulsed | sim |
| `dutyCycle` | 50 | **fixo 50%** (store força) | slider UI mas ignorado |
| `transducerAngle` | 90° | 0–180 | **só 3D** |
| `contactPressure` | 50 | 0–100 | **só 3D/default** |
| `transducerX` | 0 | -2.8…2.8 | **só 3D** |
| `anatomyPreset` | default | default, elderly, athlete, obese, custom | sim |
| `layerConfig.*Mm` | ver tabela | ver tabela | custom only |

**Presets anatômicos (mm):**

| Preset | Epiderme | Derme | Adiposo | Músculo |
|--------|----------|-------|---------|---------|
| default | 1 | 4 | 15 | 25 |
| elderly | 0.5 | 2 | 10 | 12 |
| athlete | 1 | 4 | 5 | 35 |
| obese | 1 | 4 | 40 | 10 |

#### Derivados

- `irradiance` = power / spotSize (mW/cm²)
- `energy` = (power/1000) × exposureTime × (Pulsed ? 0.5 : 1) J
- `fluence` = energy / spotSize J/cm²

#### `controlModes` (admin)

showWavelength, showPower, showSpotSize, showExposureTime, showMode, showAnatomyPresets, showCustomAnatomy — cada um: show | hidden | disabled

---

### 4.5 Motor (`photobioEngine.ts`)

| Saída | Lógica |
|-------|--------|
| `penetrationProfile` | 660: 70/30/0% por camada; 808: 20/50/30% |
| `arndtSchulzZone` | <2 subdose; 2–8 terapêutica; 10–30 inibitória; >50 bioinibição |
| `muscleFluenceRatio` | exp(-k × adiposeMm), k=0.038 (660) ou 0.02 (808) |
| `realDoseFactor` | angle × pressure × speed; min 0.05 |
| `angleEfficiency` | cos(\|90−angle\|) |
| `pressureFactor` | <20 → 0.5; >80 → 1.2 |
| `speedFactor` | 1/max(0.2, speed) se dragging |
| `techniqueWarnings` | scan rápido; parado + fluence >30 |
| `thermalWarning` | irradiance > 500 |
| `anatomyWarning` | adipose ≥ 20 mm |

---

## 5. Lab — Eletroterapia / TENS

### 5.1 Arquivos principais

| Papel | Caminho |
|-------|---------|
| Shell V2 | `src/components/labs/tens-v2/TensLabV2.tsx` |
| Viewer 3D | `src/components/labs/tens-v2/Tens3DViewer.tsx` |
| Controles | `TensLabControlPanel.tsx` |
| Insights | `TensLabInsightsPanel.tsx` |
| Cena compartilhada | `src/components/labs/tens3d/Tens3DSceneSetup.tsx` |
| Tecidos | `TissueLayersModel.tsx` |
| Campo elétrico | `ElectricFieldVisualization.tsx` |
| Eletrodos | `ElectrodeModel.tsx` |
| Heatmap lesão | `StressHeatmap.tsx` |
| Hotspots | `MetalImplantHotspot.tsx`, `ThermalHotspot.tsx` |
| Admin 3D | `Tens3DSimulator.tsx` |
| Legacy 2.5D admin | `TensSemi3DView.tsx` |
| Store | `src/stores/tensLabStore.ts` |
| Motor | `src/simulation/TensFieldEngine.ts` |
| Tissue types | `src/types/tissueConfig.ts` |
| Lab config | `src/types/tensLabConfig.ts` |

---

### 5.2 Cena 3D — componentes visuais

#### `Tens3DSceneSetup.tsx`

| Elemento | Valor |
|----------|-------|
| Camera | [0, 2.5, 10], FOV 55 |
| Orbit zoom | 5–35 |
| Polar angle | π/5 … π/2.1 |
| ambient | 0.42 |
| hemisphere | `#fff6ee` / `#3d3028`, 0.32 |
| directional + shadow | [10,10,5], 1.05 (shadow off Android) |
| fill | [-8,6,-4], 0.28 |
| point lights | cyan `#60a5fa`, purple `#a855f7` |
| fog | `#0f172a`, 12–28 |
| grid | 24×24, Y=-4 |

#### `TissueLayersModel.tsx`
- Alturas: `tissueConfig.*Thickness × 5` (normalizado 0–1)
- Osso: altura fixa 0.5 unidades
- Texturas com `lesionIndex` para eritema/dano muscular
- Emissive por modo:
  - electric + intensityNorm>0.3 → músculo `#552020`
  - lesion + index>0.3 → pele `#cc2222`; >0.5 → músculo `#771111`
- Implante metálico: box + glow azul
- Inclusões anatômicas: boxes tipados (bone, muscle, fat, metal_implant)
- Labels sprite só em modo `anatomical`

#### `ElectrodeModel.tsx`
- Pad cilíndrico (+ vermelho / − azul), gel, halo, fio, label Text
- Pulse scale quando ativo

#### `ElectricFieldVisualization.tsx`
- 8–20 linhas Catmull-Rom entre eletrodos
- Distorção por implante/inclusões
- Penetração 0.2–2.0 (intensity, gordura)
- Box volumétrico pulsante transparente
- 50–150 partículas se intensityNorm > 0.4
- Animação opacity por mode: convencional (sin), acupuntura (pulsos), burst, modulado
- Cores: `#4499ff` (electric) / `#ff6666` (lesion)

#### `StressHeatmap.tsx`
- Canvas 512×512 procedural em plano sob tecido
- Hotspots: eritema (index>0.3), dano muscular (>0.5), implante (>0.4)
- Pulsa se lesionIndex>0.5 ou riskScore>30

#### `MetalImplantHotspot.tsx` / `ThermalHotspot.tsx`
- Anéis + partículas; cor térmica amarelo→vermelho

---

### 5.3 Modos visuais

| Modo | Onde | Renderiza |
|------|------|-----------|
| `anatomical` | Admin simulator | Tecido + eletrodos + labels |
| `electric` | Default V2 | + linhas de campo + partículas |
| `lesion` | Admin simulator | Campo vermelho + StressHeatmap + emissive |
| `activated` | Store (tab "Região Ativada") | Mapeado para electric no V2 |

**V2 automático:** StressHeatmap se `lesionIndex > 0.2`; hotspots metal/térmico por thresholds.

**`lesionIndex` (0–1):** risk alto +0.7, moderado +0.4, +0.3×intensityNorm, +0.3×pulseNorm, implante+alta intensidade +0.4, osso superficial +0.3, pele fina +0.25.

**Bug conhecido:** store usa `"activated"`, UI emite `"activation"`.

---

### 5.4 Parâmetros configuráveis

#### Store runtime

| Parâmetro | Default | Range |
|-----------|---------|-------|
| `frequency` | 80 Hz | labConfig 1–200 |
| `pulseWidth` | 200 µs | 50–400 |
| `intensity` | 20 mA | 0–80 |
| `mode` | convencional | convencional, acupuntura, burst, modulado |
| `electrodes.distanceCm` | 6 | 2–12 |
| `electrodes.sizeCm` | 4 | 2–6 (step 0.5) |
| `electrodes.shape` | circular | fixo |
| `viewerTab` | electric | anatomy, electric, activated |
| `experienceLevel` | intermediate | beginner, intermediate, advanced |

#### `TissueConfig`

| Campo | Range | Notas |
|-------|-------|-------|
| skinThickness | 0–1 | relativo |
| fatThickness | 0–1 | 0 = sem camada gordura |
| muscleThickness | 0–1 | |
| boneDepth | 0–1 | |
| hasMetalImplant | bool | legacy |
| metalImplantDepth/Span | 0–1 | |
| inclusions[] | opcional | type, depth, span, position 0–1 |

**Presets tecido:**

| ID | Perfil |
|----|--------|
| forearm_slim | fino, sem implante |
| forearm_muscular | músculo alto |
| thigh_obese_implant | gordura alta + implante |
| ankle_bony | osso superficial |
| custom | editável |

#### `TensLabConfig` (admin)

enabledControls: frequency, pulseWidth, intensity, mode, electrodeDistance  
allowedModes, frequencyRange, pulseWidthRange, intensityRange, electrodeDistanceRange  
showFeedbackSection, showRiskSection, showWaveformSection

---

### 5.5 Motor (`TensFieldEngine.ts`)

**Condutividades (S/m):** skin 0.1, fat 0.04, muscle 0.4, bone 0.02, metal ~40

| Saída | Range / notas |
|-------|---------------|
| E_peak_skin, E_peak_muscle | V/cm |
| fieldSpreadCm | cm |
| activationDepthMm | 2–50 |
| activatedAreaCm2 | cm² |
| sensoryActivation, motorActivation | 0–100 |
| comfortScore | 0–100 |
| riskScore | 0–100 |
| riskLevel | baixo / moderado / alto (<25 / <60 / ≥60) |
| heatmapData | grid 20×15 |
| activationZone | center, radii, depth |
| metalHotspot, thermalHotspot | quando aplicável |

---

## 6. Camada admin, publicação e wrappers

### 6.1 `VirtualLabEditorUnified.tsx`

Persiste `config_data` por `lab_type`:

| lab_type | Conteúdo config_data |
|----------|---------------------|
| ultrasound | presetId, layers, acousticLayers, inclusions, transducer, simulationFeatures, studentControls… |
| ultrasound_therapy | `UltrasoundTherapyConfig` completo |
| tens | via `TensLabConfigEditor` |
| photobiomodulation | shape `defaultPhotobioConfig` + controlModes |
| mri | MRILabConfigEditor |

Global: `name`, `slug`, `description`, `videoUrl`

### 6.2 `LabWrapper.tsx`

| Prop | Efeito |
|------|--------|
| videoUrl | Vídeo YouTube suporte |
| immersive | Layout full-height, esconde vídeo/disclaimer |
| showDisclaimer | Aviso educacional |

### 6.3 Roteamento estudante (`LabExperience.tsx`)

| lab_type | Componente |
|----------|------------|
| ultrasound_therapy / ultrassom_terapeutico | UltrasoundTherapyLabPage |
| photobiomodulation / fbm | PhotobioLabPage |
| tens | TensLabPage |

---

## 7. Decoplamentos simulação ↔ visual (crítico para melhorias)

| Lab | Parâmetro | Simulação | Visual 3D |
|-----|-----------|-----------|-----------|
| US Terapêutico | beamProfile, focusDepth, transducerType | Ignorado | Feixe + modelo transdutor |
| US Terapêutico | ERA alta | Usa ERA real | Face cap 3 cm² |
| US Terapêutico | beamWidth engine | Independente de frequência | Beam 3D usa λ e D |
| US Terapêutico | Cavitação / bone reflection | Valores numéricos | Efeitos ilustrativos |
| Fotobio | dutyCycle UI | Fixo 50% | Animação pulsa |
| Fotobio | angle, pressure | Motor | Indent 3D + warnings |
| TENS | lesion mode | Overlay automático | Modo explícito só admin |
| Todos | Skin tone | Não afeta física | Textura + cor |

---

## 8. Lacunas, dívida técnica e oportunidades explícitas

### 8.1 Lacunas funcionais / UX

1. Fotobio: `contactPressure`, `transducerAngle` sem controles no painel — só drag 3D.
2. Fotobio: duty cycle editável na UI mas store força 50%.
3. TENS: mismatch `activated` vs `activation` nas tabs.
4. Admin US terapêutico: sliders de preview não persistem.
5. Admin US terapêutico: sem UI para defaults de transducerType/beamProfile/focusDepth.
6. `TensLabBottomDock` (waveform, safety, notes) existe mas não está no layout V2.
7. `TherapeuticUltrasoundLab.tsx` — legado 2D, não roteado.
8. Dois stacks TENS: Three.js full vs CSS `TensSemi3DView` no admin.

### 8.2 Lacunas visuais / realismo

1. Sem normal maps — apenas bumpMap procedural.
2. Sem subsurface scattering (SSS) — pele é StandardMaterial opaco.
3. Sem animação de fluidos (sangue, edema, sudorese).
4. Transdutor fotobio é primitivas genéricas — não compartilha pipeline clínico do US terapêutico.
5. Eletrodos TENS são cilindros simples — sem textura de hydrogel realista.
6. Campo elétrico: linhas + partículas — não volume rendering nem isosurfaces.
7. Android: sem sombras — perda de profundidade tecidual.
8. Inclusões TENS são boxes — não orgânicas.
9. Sem variação de anatomia por região corporal (membro vs tronco) além de presets espessura.

### 8.3 Lacunas pedagógicas / lúdicas

1. Sem trilha guiada / tutorial interativo step-by-step nos labs terapêuticos.
2. Sem sistema de pontuação, badges ou desafios (“atinga zona terapêutica sem risco”).
3. Sem comparação lado a lado antes/depois de mudança de parâmetro.
4. Sem replay ou gravação da sessão.
5. Preset “exemplo inadequado” existe só no US terapêutico — não nos outros labs.
6. Feedback háptico / sonoro ausente.
7. Labels anatômicos estáticos — sem highlight da camada “alvo” da energia.
8. Dose map fotobio só visível ao arrastar — não persiste narrativa pós-sessão.

---

## 9. Índice de arquivos (referência rápida)

### Compartilhado
- `src/lib/clinicalSkinTones.ts`
- `src/lib/clinicalTissueTextures.ts`
- `src/lib/clinicalTissueGeometry.ts`
- `src/lib/labPerformance.ts`
- `src/components/labs/LabCanvas.tsx`
- `src/components/labs/LabCanvasSurface.tsx`
- `src/components/labs/LabWrapper.tsx`

### Ultrassom terapêutico (3D)
- `src/components/labs/ultrasound-therapy/*.tsx` (20 arquivos)
- `src/lib/ultrasoundTherapyBeam.ts`
- `src/lib/ultrasoundTherapyStack.ts`
- `src/config/therapeuticTransducerDefinitions.ts`
- `src/config/ultrasoundTherapyPresets.ts`

### Fotobiomodulação
- `src/components/labs/photobio/*.tsx`
- `src/stores/photobioStore.ts`
- `src/simulation/photobioEngine.ts`

### TENS
- `src/components/labs/tens-v2/*.tsx`
- `src/components/labs/tens3d/*.tsx`
- `src/stores/tensLabStore.ts`
- `src/simulation/TensFieldEngine.ts`
- `src/types/tissueConfig.ts`

---

## 10. Prompt sugerido para enviar à IA analista

Copie o bloco abaixo junto com este documento:

---

**PROMPT:**

Você recebeu a anamnese completa do estado atual das simulações 3D terapêuticas da plataforma ProGenia (ultrassom terapêutico, fotobiomodulação, eletroterapia/TENS).

Com base **exclusivamente** neste documento:

1. **Diagnóstico:** liste os 10 maiores gaps entre o estado atual e uma simulação ideal em termos de realismo visual, coerência pedagógica e engajamento lúdico.

2. **Propostas priorizadas:** para cada lab, sugira melhorias concretas em três eixos:
   - **Realismo** (materiais, anatomia, iluminação, animação, coerência física aparente)
   - **Ludicidade** (gamificação, feedback, microinterações, narrativa, desafios)
   - **Pedagogia visual** (overlays, comparações, trilhas guiadas, ligação métrica↔3D)

3. **Quick wins vs projetos grandes:** classifique cada sugestão (esforço S/M/L) e impacto (1–5).

4. **Restrições:** respeite limitações Android WebView (sem sombras, DPR 1, sem AA) — proponha fallbacks.

5. **Decoplamentos:** onde a simulação numérica e o visual estão desalinhados, proponha unificação ou, se intencional, como comunicar isso ao aluno visualmente.

6. **Roadmap:** sequência recomendada de implementação em 3 fases (MVP visual → profundidade pedagógica → polish premium).

Seja específico: nomeie componentes, parâmetros e efeitos do documento. Não invente features que não existam no inventário sem marcá-las como "novas".

---

*Documento gerado para handoff entre IAs / equipe de produto. Repositório: progenia.*
