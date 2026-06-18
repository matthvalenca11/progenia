# Modo de Interação — Ultrassom Terapêutico

Documentação técnica e pedagógica do **interactionMap** e **physiologyResponse** no laboratório de Ultrassom Terapêutico (ProGenia).

> **Aviso:** Tudo descrito aqui é **simulação educacional**. Não representa predição clínica, dosimetria regulatória ou modelagem acústica numérica (FEM/BEM).

---

## Visão geral

O motor `simulateUltrasoundTherapy()` (`src/simulation/ultrasoundTherapyEngine.ts`) produz, entre outros campos:

| Saída | Módulo | Uso principal |
|--------|--------|----------------|
| `interactionMap` | `src/lib/ultrasoundTherapyInteractionMap.ts` | Aba **Propagação** — volume instanciado de células acústicas |
| `physiologyResponse` | `src/lib/ultrasoundPhysiologyResponse.ts` | Abas **Térmico / Fisiologia** — overlays e legendas |

Ambos são calculados **uma vez por `runSimulation()`** quando parâmetros mudam (ERA, modo, coupling, anatomia, etc.). **Não** são recalculados em `useFrame` nem em loops de renderização 3D.

---

## interactionMap

### O que é

Grade 2D (lateral × profundidade) de células heurísticas. Cada célula estima fenômenos relativos:

- Intensidade relativa e perda por atenuação
- Reflexão (ex.: osso)
- Ondas estacionárias (modo contínuo)
- Taxa térmica e temperatura estimada
- Índices de cavitação, lesão térmica e ablação **educacional**

### Resolução

| Plataforma | Largura × Altura | Células totais |
|------------|------------------|----------------|
| Desktop | 72 × 56 | 4 032 |
| Android nativo | 40 × 32 | 1 280 |

Definido por `getDefaultInteractionMapResolution()` em `ultrasoundTherapyInteractionMap.ts`, usando `isAndroidNative`.

### Pipeline

1. Entrada: parâmetros acústicos + stack anatômico (`buildStackLayers`).
2. Para cada célula: intensidade no ponto, atenuação por tecido, reflexão óssea, heating rate simplificado.
3. Agregação em `summary`: máximos e `dominantPhenomenon` (ex.: `deep-heating`, `bone-reflection`, `ablation`).

### Visualização 3D

Componente: `AcousticPropagationVolume.tsx`

- **Instancing:** até 1 200 instâncias (desktop) ou 400 (Android) via `InstancedMesh` — nunca uma mesh por célula da grade completa.
- Seleção: células com score acima de um limiar; as top-N por relevância pedagógica.
- Animação: apenas cores/opacidades no `useFrame`; geometria fixa após `useLayoutEffect`.
- Android: atualização de cor a cada 3 frames (`getPropagationColorUpdateInterval()`).

Camadas ligáveis em `AcousticPhenomenaToggles` (`visualizationOptions` no store).

### Limitações do modelo

- Não resolve equação de onda; usa proxies escalares.
- Temperatura é estimativa estacionária simplificada, não bioheat transfer completo.
- Cavitação e ablação são **índices relativos 0–1** para narrativa visual, não limiares regulatórios.
- Coupling gel, movimento do transdutor e perfil de feixe real são aproximados.

---

## physiologyResponse

### O que é

Camada **interpretativa** sobre o resultado térmico/acústico. Traduz índices em resposta fisiológica **didática**:

| Índice | Significado pedagógico |
|--------|------------------------|
| `hyperemiaIndex` | Vasodilatação superficial ilustrativa |
| `edemaIndex` | Edema leve ilustrativo |
| `muscleThermalStressIndex` | Estresse térmico muscular |
| `periostealPainIndex` | Risco de irritação periosteal (osso raso) |
| `collagenDenaturationIndex` / `coagulationIndex` | Alterações proteicas simplificadas |
| `ablationIndex` | Zona extrema **educacional** (não prognóstico) |

`summary.primaryResponse` escolhe o fenômeno dominante com texto explicativo em português.

### Entrada

```typescript
buildUltrasoundPhysiologyResponse({
  result,           // UltrasoundTherapyResult (temperaturas, dose, etc.)
  interactionMap,   // opcional — reforça cavitação/ablação espacial
  config,
});
```

Chamado **dentro** de `simulateUltrasoundTherapy()` após o mapa de interação.

### Visualização 3D

Componente: `PhysiologyResponseOverlay.tsx`

- Poucas meshes (discos, esferas, anéis) — **sem** instancing massivo.
- `useFrame` apenas ajusta opacidade pulsante; índices vêm do store, não são recalculados.
- Marcadores HTML complementares: `TissueDamageMarkers`, `PhysiologyLegend`.

---

## Zustand e performance

Store: `src/stores/ultrasoundTherapyStore.ts`

- `runSimulation()` dispara ao alterar config; resultado cacheado em `simulationResult`.
- Componentes 3D devem usar **selectors** (`useUltrasoundTherapyStore(s => s.simulationResult)`) para evitar re-render global.
- `visualizationOptions` altera apenas camadas visuais; não reexecuta o motor.

---

## Fallbacks Android

| Área | Desktop | Android |
|------|---------|---------|
| Resolução interactionMap | 72×56 | 40×32 |
| Instâncias propagação | 1200 | 400 |
| Sombras em tempo real | Sim | Não (`shouldEnableRealTimeShadows`) |
| DPR canvas | [1, 2] | 1 |
| Antialiasing GL | Sim | Não |
| Texturas tecido | 768 px | 512 px |
| Bolhas cavitação | até 64 | até 22 |
| Atualização cor propagação | cada frame | 1/3 frames |

Config central: `src/lib/ultrasoundVisualQuality.ts`, `src/lib/labPerformance.ts`, `src/lib/therapeuticLabsPerformance.ts`.

---

## Próximos passos sugeridos

1. **Worker thread** — mover `buildUltrasoundInteractionMap` para Web Worker em sessões longas.
2. **Texture atlas** — heatmap 2D único em vez de instâncias para GPUs muito fracas.
3. **Validação pedagógica** — rubricas alinhadas a competências (coupling, dose, segurança).
4. **Telemetria opcional** — tempo em aba Propagação vs Fisiologia para analytics de ensino.
5. **Export didático** — PDF/snapshot com disclaimer e parâmetros (parcialmente coberto por `SessionTimeline`).

---

## Referências no código

- Motor: `src/simulation/ultrasoundTherapyEngine.ts`
- Mapa: `src/lib/ultrasoundTherapyInteractionMap.ts`
- Fisiologia: `src/lib/ultrasoundPhysiologyResponse.ts`
- Volume 3D: `src/components/labs/ultrasound-therapy/AcousticPropagationVolume.tsx`
- Overlay fisiológico: `src/components/labs/ultrasound-therapy/PhysiologyResponseOverlay.tsx`
- Store: `src/stores/ultrasoundTherapyStore.ts`
