# Roadmap UX — Labs Terapêuticos

Estado atual e direção de evolução dos laboratórios **Ultrassom Terapêutico**, **Fotobiomodulação** e **TENS** no ProGenia.

> Todos os labs seguem o princípio: **simulação educacional simplificada** — visualização para aprendizado, não substituto de equipamento clínico ou literatura primária.

---

## Layout comum (padrão 3 linhas)

| Linha | Conteúdo | Labs |
|-------|----------|------|
| 1 | Header — título, badges de risco/dose, tabs de visualização | US, Fotobio, TENS |
| 2 | Canvas 3D principal (~54–65% viewport) | Todos |
| 3 | Controles + métricas (50/50 desktop) | Todos |
| 4 (opcional) | Dock inferior — waveform, segurança, notas | TENS |

Mobile: canvas no topo, `LabMobileTabBar` (Controles | Métricas), disclaimer compacto, touch targets ≥ 44px nos botões críticos.

---

## Ultrassom Terapêutico

### Features atuais

- Tabs 3D: Anatomia, Feixe, Térmico, Propagação (+ Fisiologia via dock/mode)
- Modo guiado com desafios (`TherapyChallengePanel`, `GuidedTherapyCoach`)
- Snapshots e comparação A/B (`SessionTimeline`, `SimulationComparisonPanel`)
- IFU / tipos de transdutor (`therapeuticTransducerDefinitions`)
- interactionMap instanciado + physiologyResponse overlay
- Tier visual Android (`ultrasoundVisualQuality.ts`)

### UX consistente

- `SimulationStatusBar` — risco, fenômeno dominante, resposta fisiológica
- `EducationalSimulationDisclaimer` no layout principal
- Controles colapsáveis; preview admin sincronizado com `config_data`

### Próximos passos

- [ ] Modo guiado no mobile (bottom sheet dedicado)
- [ ] Reduzir toggles de propagação no mobile (preset “Essencial / Avançado”)
- [ ] Haptic leve ao atingir objetivo de desafio (Capacitor)
- [ ] Localização EN dos disclaimers (i18n)

---

## Fotobiomodulação

### Features atuais

- Controles: λ, potência, spot, tempo, CW/Pulsed + **duty cycle funcional**
- Técnica: ângulo, pressão, scanning com **doseMap** narrativo
- Curva Arndt-Schulz no painel de métricas
- Feedback visual: risco térmico, contato, ângulo

### Performance (Android)

- Sombras desligadas (`shouldCastTherapeuticShadows`)
- Menos nós de feixe, scatter e LEDs (`therapeuticLabsPerformance.ts`)
- Posições de scatter memoizadas (sem `Math.random()` por frame)

### Próximos passos

- [ ] Instancing para faixa de dose acumulada (56 segmentos → 1 mesh)
- [ ] Modo guiado espelhando ultrassom (janela terapêutica como desafio)
- [ ] Presets clínicos nomeados (reparo, analgesia) com texto leigo

---

## TENS

### Features atuais

- Tabs: Anatomia, Campo Elétrico, Região Ativada, Risco/Lesão
- `TensLabBottomDock` — forma de onda, segurança, notas
- Inclusões anatômicas com geometrias arredondadas (`RoundedBox` / esferas)
- `TensActivationZone` — overlay da região ativada estimada

### Performance (Android)

- Campo elétrico: máx. 10 linhas, 28 segmentos, 60 partículas
- Linhas memoizadas com dispose no unmount (sem `new Line` por render)
- Sombras off em `TissueLayersModel`
- Raios de implante: 4 vs 8 no desktop

### Próximos passos

- [ ] Unificar store selectors (evitar destructuring amplo em `TensLabV2`)
- [ ] Modo guiado: “analgesia vs endorfinas” por faixa de Hz
- [ ] Gráfico de ativação sensorial/motora no painel de métricas

---

## Acessibilidade

| Item | Status |
|------|--------|
| Botões reset com `aria-label` | Parcial (Fotobio OK; revisar US/TENS) |
| Disclaimer com `role="note"` | `EducationalSimulationDisclaimer` |
| Contraste badges risco | emerald/amber/red com borda |
| Tooltips densos no mobile | Propagação US: toggles ocultos em overlay mobile |
| Sliders touch | altura mínima via `min-h-[44px]` em ações primárias |

---

## Textos e tom pedagógico

**Usar:**

- “Simulação educacional”, “modelo ilustrativo”, “índice relativo”
- “Janela terapêutica (modelo Arndt-Schulz simplificado)”
- “Ablação **educacional**” — nunca “ablação clínica garantida”

**Evitar:**

- “Precisão clínica”, “dose prescrita”, “protocolo aprovado”
- Siglas sem expansão na primeira ocorrência (ERA → Intensidade Espacial Média, quando visível ao aluno)

Componente reutilizável: `src/components/labs/EducationalSimulationDisclaimer.tsx`

---

## Checklist de estabilização (esta entrega)

- [x] Script `npm run typecheck` (`tsc --noEmit`)
- [x] Build produção passa
- [x] interactionMap via InstancedMesh com cap Android
- [x] physiologyResponse calculado no motor, não no frame loop
- [x] Limites TENS/Fotobio centralizados em `therapeuticLabsPerformance.ts`
- [x] Disclaimers nos três labs
- [x] Documentação interactionMap + physiologyResponse

---

## Arquitetura de performance (resumo)

```
Parâmetro alterado
       ↓
store.runSimulation()
       ↓
Motor (ultrasoundTherapyEngine | photobioEngine | TensFieldEngine)
       ↓
Resultado cacheado no Zustand
       ↓
Componentes 3D leem snapshot + animam apenas propriedades visuais
```

**Regra:** Nunca chamar builders de mapa (`buildUltrasoundInteractionMap`, `calculateTissueInteraction`) dentro de `useFrame`.

---

## Contato / manutenção

Ao adicionar nova camada visual:

1. Verificar contagem de draw calls no Android.
2. Preferir `InstancedMesh` ou material único translúcido.
3. Adicionar limite em `therapeuticLabsPerformance.ts` ou `ultrasoundVisualQuality.ts`.
4. Atualizar este roadmap e, se aplicável, `ultrasound-therapy-interaction-mode.md`.
