import type {
  ClinicalPresetCategory,
  ClinicalPresetCategoryId,
  DynamicChartPresetId,
  DynamicChartPresetMeta,
} from "@/types/dynamicChart";
import { i18n } from "./helpers";

export const PRESET_CATEGORIES: ClinicalPresetCategory[] = [
  {
    id: "electrotherapy",
    label: i18n("Estimulação elétrica", "Electrical stimulation"),
    presetIds: ["tens_strength_duration", "fes_force_frequency", "nmes_force_pulse_width", "fes_fatigue_session"],
  },
  {
    id: "ultrasound",
    label: i18n("Ultrassom", "Ultrasound"),
    presetIds: ["us_attenuation", "us_sata_duty", "us_frequency_penetration"],
  },
  {
    id: "photobiomodulation",
    label: i18n("Fotobiomodulação", "Photobiomodulation"),
    presetIds: ["pbm_arndt_schulz", "pbm_dose_time", "pbm_wavelength_penetration"],
  },
  {
    id: "diathermy",
    label: i18n("Diatermia", "Diathermy"),
    presetIds: ["diathermy_penetration", "diathermy_heating_time"],
  },
  {
    id: "neurophysiology",
    label: i18n("Neurofisiologia", "Neurophysiology"),
    presetIds: [
      "action_potential",
      "tms_io_curve",
      "nernst_equilibrium",
      "nerve_accommodation",
    ],
  },
  {
    id: "biomechanics",
    label: i18n("Biomecânica", "Biomechanics"),
    presetIds: [
      "hill_force_velocity",
      "muscle_length_tension",
      "viscoelastic_creep",
      "bone_stress_strain",
    ],
  },
  {
    id: "cardiorespiratory",
    label: i18n("Cardio / Respiratória", "Cardiorespiratory"),
    presetIds: [
      "hb_bohr_dissociation",
      "frank_starling",
      "cardiac_output_exercise",
      "spirometry_loop",
    ],
  },
  {
    id: "pharmacology",
    label: i18n("Farmacologia", "Pharmacology"),
    presetIds: [
      "michaelis_menten",
      "first_order_elimination",
      "dose_accumulation",
    ],
  },
];

export const PRESET_CATALOG: DynamicChartPresetMeta[] = [
  {
    id: "tens_strength_duration",
    title: i18n("TENS — Curva Intensidade × Duração", "TENS — Strength–Duration Curve"),
    subtitle: i18n("Reobase e Cronaxia (Weiss)", "Rheobase and Chronaxie (Weiss)"),
    description: i18n(
      "Relação hiperbólica entre largura de pulso e intensidade mínima para excitação neural.",
      "Hyperbolic relationship between pulse width and minimum intensity for neural excitation.",
    ),
    category: "electrotherapy",
    discipline: i18n("Eletroterapia", "Electrotherapy"),
    icon: "curve",
    readonly_equations: ["I = I_rh · (1 + c / t)"],
  },
  {
    id: "us_attenuation",
    title: i18n("Ultrassom — Atenuação Acústica", "Ultrasound — Acoustic Attenuation"),
    subtitle: i18n("Lei exponencial de Beer", "Beer–Lambert exponential law"),
    description: i18n(
      "Decaimento exponencial da intensidade acústica com a profundidade tecidual.",
      "Exponential decay of acoustic intensity with tissue depth.",
    ),
    category: "ultrasound",
    discipline: i18n("Ultrassom terapêutico", "Therapeutic ultrasound"),
    icon: "decay",
    readonly_equations: ["I(x) = I₀ · e^(−α · x)"],
  },
  {
    id: "pbm_arndt_schulz",
    title: i18n("Laser / PBM — Lei de Arndt-Schulz", "Laser / PBM — Arndt-Schulz Law"),
    subtitle: i18n("Resposta bifásica dose × efeito", "Biphasic dose–response"),
    description: i18n(
      "Efeito biológico ótimo em dose intermediária; subdose e sobredose reduzem a resposta.",
      "Optimal biological effect at intermediate dose; under- and overdosing reduce response.",
    ),
    category: "photobiomodulation",
    discipline: i18n("Fotobiomodulação", "Photobiomodulation"),
    icon: "bell",
    readonly_equations: ["E = E_max · (D/D₀) · e^(1 − D/D₀)"],
  },
  {
    id: "diathermy_penetration",
    title: i18n("Diatermia — Penetração Térmica", "Diathermy — Thermal Penetration"),
    subtitle: i18n("Absorção de energia vs profundidade", "Energy absorption vs depth"),
    description: i18n(
      "Distribuição de potência absorvida com a profundidade em campos eletromagnéticos de diatermia.",
      "Absorbed power distribution with depth in diathermy electromagnetic fields.",
    ),
    category: "diathermy",
    discipline: i18n("Diatermia", "Diathermy"),
    icon: "wave",
    readonly_equations: [
      "P(x) = P₀ · e^(−2x / δ)",
      "δ ≈ k / √(f · μ · σ)",
    ],
  },
  {
    id: "fes_force_frequency",
    title: i18n("FES — Força × Frequência", "FES — Force × Frequency"),
    subtitle: i18n("Fusão de frequência e saturação", "Frequency fusion and saturation"),
    description: i18n(
      "Recrutamento de unidades motoras e tetanização em estimulação elétrica funcional.",
      "Motor unit recruitment and tetanic fusion in functional electrical stimulation.",
    ),
    category: "electrotherapy",
    discipline: i18n("Estimulação elétrica funcional", "Functional electrical stimulation"),
    icon: "sigmoid",
    readonly_equations: ["F(f) = F_max · (1 − e^(−f / f_fusion))"],
  },
  {
    id: "action_potential",
    title: i18n("Potencial de Ação Neuronal", "Neuronal Action Potential"),
    subtitle: i18n("Canais Na⁺ e K⁺ (modelo paramétrico)", "Na⁺ and K⁺ channels (parametric model)"),
    description: i18n(
      "Modelo simplificado de despolarização e repolarização de membrana.",
      "Simplified model of membrane depolarization and repolarization.",
    ),
    category: "neurophysiology",
    discipline: i18n("Neurofisiologia", "Neurophysiology"),
    icon: "curve",
    readonly_equations: [
      "V_m(t) = V_rest + (V_peak − V_rest) · f_Na(t) · f_K(t)",
      "f_Na(t) = 1 − e^(−t / τ_Na)",
      "f_K(t) = 1 − e^(−(t − t_peak) / τ_K)",
    ],
  },
  {
    id: "tms_io_curve",
    title: i18n("TMS — Curva Entrada-Saída", "TMS — Input–Output Curve"),
    subtitle: i18n("Sigmoide do limiar motor (Hill)", "Motor threshold sigmoid (Hill)"),
    description: i18n(
      "Amplitude da resposta motor evocada (MEP) em função da intensidade do estímulo.",
      "Motor evoked potential (MEP) amplitude as a function of stimulus intensity.",
    ),
    category: "neurophysiology",
    discipline: i18n("Estimulação magnética transcraniana", "Transcranial magnetic stimulation"),
    icon: "sigmoid",
    readonly_equations: [
      "MEP = baseline + A · I^n / (I^n + EC50^n)",
    ],
  },
  {
    id: "nernst_equilibrium",
    title: i18n("Equação de Nernst", "Nernst Equation"),
    subtitle: i18n("Potencial de equilíbrio iônico", "Ionic equilibrium potential"),
    description: i18n(
      "Potencial elétrico de equilíbrio para um íon em função da razão de concentrações intra/extra celular.",
      "Electrical equilibrium potential for an ion as a function of intra/extracellular concentration ratio.",
    ),
    category: "neurophysiology",
    discipline: i18n("Biofísica de membrana", "Membrane biophysics"),
    icon: "nerve",
    readonly_equations: [
      "E = (R · T / z · F) · ln([ion]o / [ion]i)",
      "E ≈ (61,5 / z) · log10([ion]o / [ion]i) mV (37 °C)",
    ],
  },
  {
    id: "nerve_accommodation",
    title: i18n("Acomodação Nervosa", "Neural Accommodation"),
    subtitle: i18n("Aumento do limiar ao longo do tempo", "Threshold rise over time"),
    description: i18n(
      "Acomodação: limiar de excitação aumenta com estimulação repetitiva ou contínua.",
      "Accommodation: excitation threshold rises with repetitive or continuous stimulation.",
    ),
    category: "neurophysiology",
    discipline: i18n("Neurofisiologia", "Neurophysiology"),
    icon: "curve",
    readonly_equations: ["I_threshold(t) = I₀ · e^(t / τ_acc)"],
  },
  {
    id: "hill_force_velocity",
    title: i18n("Hill — Força × Velocidade", "Hill — Force × Velocity"),
    subtitle: i18n("Contrato muscular concêntrico", "Concentric muscle contraction"),
    description: i18n(
      "Modelo clássico de Hill (1938) para força durante encurtamento concêntrico.",
      "Classic Hill (1938) model for force during concentric shortening.",
    ),
    category: "biomechanics",
    discipline: i18n("Biomecânica muscular", "Muscle biomechanics"),
    icon: "wave",
    readonly_equations: [
      "F(v) = (b · F₀ − v · a) / (b + v)",
      "a ≈ 0,25 · F₀;  b = V_max · a / F₀",
    ],
  },
  {
    id: "muscle_length_tension",
    title: i18n("Comprimento × Tensão", "Length × Tension"),
    subtitle: i18n("Sobreposição de miofilamentos", "Myofilament overlap"),
    description: i18n(
      "Curva gaussiana da força isométrica em função do comprimento muscular.",
      "Gaussian isometric force curve vs muscle length.",
    ),
    category: "biomechanics",
    discipline: i18n("Fisiologia muscular", "Muscle physiology"),
    icon: "muscle",
    readonly_equations: ["F(L) = F_max · exp(−((L − L_opt) / W)²)"],
  },
  {
    id: "viscoelastic_creep",
    title: i18n("Creep Viscoelástico", "Viscoelastic Creep"),
    subtitle: i18n("Deformação retardada (Kelvin–Voigt)", "Delayed deformation (Kelvin–Voigt)"),
    description: i18n(
      "Resposta de deformação ao longo do tempo sob carga constante em tecido viscoelástico.",
      "Deformation response over time under constant load in viscoelastic tissue.",
    ),
    category: "biomechanics",
    discipline: i18n("Rheologia tecidual", "Tissue rheology"),
    icon: "decay",
    readonly_equations: [
      "ε(t) = σ / E · (1 − e^(−t / τ))",
    ],
  },
  {
    id: "bone_stress_strain",
    title: i18n("Tensão × Deformação Óssea", "Bone Stress–Strain"),
    subtitle: i18n("Região elástica linear (Lei de Hooke)", "Linear elastic region (Hooke's law)"),
    description: i18n(
      "Relação linear entre tensão e deformação na região elástica do osso cortical.",
      "Linear stress–strain relationship in the cortical bone elastic region.",
    ),
    category: "biomechanics",
    discipline: i18n("Biomecânica óssea", "Bone biomechanics"),
    icon: "bone",
    readonly_equations: ["σ = E · ε"],
  },
  {
    id: "hb_bohr_dissociation",
    title: i18n("Efeito Bohr — Hemoglobina", "Bohr Effect — Hemoglobin"),
    subtitle: i18n("Curva de dissociação de O₂ (Hill)", "O₂ dissociation curve (Hill)"),
    description: i18n(
      "SaO₂ vs PO₂ com deslocamento de P50 por pH, pCO₂ e temperatura.",
      "SaO₂ vs PO₂ with P50 shift by pH, pCO₂, and temperature.",
    ),
    category: "cardiorespiratory",
    discipline: i18n("Fisiologia respiratória", "Respiratory physiology"),
    icon: "heart",
    readonly_equations: [
      "SaO₂ = 100 · PO₂^n / (P50^n + PO₂^n)",
      "log10(P50) = log10(P50_ref) + 0,48·(7,4−pH) + 0,0024·(pCO₂−40) + 0,015·(T−37)",
    ],
  },
  {
    id: "frank_starling",
    title: i18n("Lei de Frank-Starling", "Frank-Starling Law"),
    subtitle: i18n("Volume diastólico × volume sistólico", "End-diastolic volume × stroke volume"),
    description: i18n(
      "O coração dilata e contrai com mais força quando o retorno venoso aumenta (precarga).",
      "The heart dilates and contracts more forcefully when venous return increases (preload).",
    ),
    category: "cardiorespiratory",
    discipline: i18n("Fisiologia cardíaca", "Cardiac physiology"),
    icon: "heart",
    readonly_equations: [
      "SV = SV_max · (EDV − EDV₀) / (EDV + EDV_ref)",
    ],
  },
  {
    id: "cardiac_output_exercise",
    title: i18n("Débito Cardíaco × Exercício", "Cardiac Output × Exercise"),
    subtitle: i18n("Resposta cardiovascular ao esforço", "Cardiovascular response to effort"),
    description: i18n(
      "Aumento do débito cardíaco com carga de exercício (modelo linear submáximo).",
      "Increase in cardiac output with exercise workload (submaximal linear model).",
    ),
    category: "cardiorespiratory",
    discipline: i18n("Exercício clínico", "Clinical exercise"),
    icon: "heart",
    readonly_equations: ["CO = CO_rest + k · W"],
  },
  {
    id: "spirometry_loop",
    title: i18n("Alça Espirométrica (Fluxo × Volume)", "Spirometry Flow–Volume Loop"),
    subtitle: i18n("Inspiração e expiração forçada", "Forced inspiration and expiration"),
    description: i18n(
      "Loop fluxo–volume simplificado para visualizar limites inspiratórios e expiratórios.",
      "Simplified flow–volume loop showing inspiratory and expiratory limits.",
    ),
    category: "cardiorespiratory",
    discipline: i18n("Função pulmonar", "Pulmonary function"),
    icon: "lung",
    readonly_equations: [
      "F_in(V) = Ḟ_peak,in · √(1 − (V / VC)²)",
      "F_exp(V) = −Ḟ_peak,exp · √(1 − ((VC − V) / VC)²)",
    ],
  },
  {
    id: "michaelis_menten",
    title: i18n("Michaelis–Menten", "Michaelis–Menten"),
    subtitle: i18n("Cinética enzimática / farmacodinâmica", "Enzyme / pharmacodynamic kinetics"),
    description: i18n(
      "Velocidade de reação ou efeito farmacológico vs concentração do substrato/ligante.",
      "Reaction rate or pharmacologic effect vs substrate/ligand concentration.",
    ),
    category: "pharmacology",
    discipline: i18n("Farmacocinética", "Pharmacokinetics"),
    icon: "pharmacy",
    readonly_equations: ["v = V_max · [S] / (K_m + [S])"],
  },
  {
    id: "first_order_elimination",
    title: i18n("Eliminação de 1ª Ordem", "First-Order Elimination"),
    subtitle: i18n("Decaimento exponencial de concentração", "Exponential concentration decay"),
    description: i18n(
      "Concentração plasmática após dose única com eliminação de primeira ordem.",
      "Plasma concentration after a single dose with first-order elimination.",
    ),
    category: "pharmacology",
    discipline: i18n("Farmacocinética", "Pharmacokinetics"),
    icon: "pharmacy",
    readonly_equations: [
      "C(t) = C₀ · e^(−k · t)",
      "k = 0,693 / t₁/₂",
    ],
  },
  {
    id: "dose_accumulation",
    title: i18n("Acumulação de Doses", "Dose Accumulation"),
    subtitle: i18n("Aproximação ao estado estacionário", "Approach to steady state"),
    description: i18n(
      "Acúmulo de fármaco com administração repetida até atingir concentração de equilíbrio.",
      "Drug accumulation with repeated dosing until steady-state concentration.",
    ),
    category: "pharmacology",
    discipline: i18n("Farmacocinética", "Pharmacokinetics"),
    icon: "pharmacy",
    readonly_equations: [
      "C_ss = C_dose / (1 − e^(−k · τ))",
      "C(t) = C_ss · (1 − e^(−k · t))",
    ],
  },
  {
    id: "nmes_force_pulse_width",
    title: i18n("NMES — Força × Largura de Pulso", "NMES — Force × Pulse Width"),
    subtitle: i18n("Recrutamento por duração do pulso", "Recruitment by pulse duration"),
    description: i18n(
      "Relação sigmoide entre largura de pulso e força evocada em estimulação neuromuscular.",
      "Sigmoid relationship between pulse width and evoked force in neuromuscular stimulation.",
    ),
    category: "electrotherapy",
    discipline: i18n("NMES", "NMES"),
    icon: "sigmoid",
    readonly_equations: ["F(pw) = F_max · (1 − e^(−pw / τ))"],
  },
  {
    id: "fes_fatigue_session",
    title: i18n("FES — Fadiga × Tempo", "FES — Fatigue × Time"),
    subtitle: i18n("Decaimento de força na sessão", "Force decay during session"),
    description: i18n(
      "Modelo exponencial de fadiga em função do tempo, frequência e duty cycle.",
      "Exponential fatigue model as a function of time, frequency, and duty cycle.",
    ),
    category: "electrotherapy",
    discipline: i18n("Estimulação elétrica funcional", "Functional electrical stimulation"),
    icon: "decay",
    readonly_equations: ["F(t) = F₀ · e^(−k · t · f · duty)"],
  },
  {
    id: "us_sata_duty",
    title: i18n("Ultrassom — SATA × Duty", "Ultrasound — SATA × Duty"),
    subtitle: i18n("Dose térmica média no pulso", "Average thermal dose in pulsed mode"),
    description: i18n(
      "Intensidade espacial média no tempo proporcional ao duty cycle.",
      "Time-averaged spatial intensity proportional to duty cycle.",
    ),
    category: "ultrasound",
    discipline: i18n("Ultrassom terapêutico", "Therapeutic ultrasound"),
    icon: "wave",
    readonly_equations: ["SATA = I_pico · (duty / 100)"],
  },
  {
    id: "us_frequency_penetration",
    title: i18n("Ultrassom — Penetração × Frequência", "Ultrasound — Penetration × Frequency"),
    subtitle: i18n("k / f em tecidos moles", "k / f in soft tissue"),
    description: i18n(
      "Profundidade efetiva inversamente proporcional à frequência.",
      "Effective depth inversely proportional to frequency.",
    ),
    category: "ultrasound",
    discipline: i18n("Ultrassom terapêutico", "Therapeutic ultrasound"),
    icon: "decay",
    readonly_equations: ["z_eff ≈ k / f", "f em MHz, z em cm"],
  },
  {
    id: "pbm_dose_time",
    title: i18n("PBM — Dose × Tempo", "PBM — Dose × Time"),
    subtitle: i18n("J/cm² = irradiância × tempo", "J/cm² = irradiance × time"),
    description: i18n(
      "Acúmulo linear de dose energética em irradiância constante.",
      "Linear accumulation of energy dose at constant irradiance.",
    ),
    category: "photobiomodulation",
    discipline: i18n("Fotobiomodulação", "Photobiomodulation"),
    icon: "curve",
    readonly_equations: ["D = (P / 1000) · t", "P em mW/cm², t em s, D em J/cm²"],
  },
  {
    id: "pbm_wavelength_penetration",
    title: i18n("PBM — Penetração × λ", "PBM — Penetration × λ"),
    subtitle: i18n("660 nm vs 808 nm", "660 nm vs 808 nm"),
    description: i18n(
      "Penetração óptica efetiva em função do comprimento de onda.",
      "Effective optical penetration as a function of wavelength.",
    ),
    category: "photobiomodulation",
    discipline: i18n("Fotobiomodulação", "Photobiomodulation"),
    icon: "bell",
    readonly_equations: [
      "Penetração ↑ com λ na janela NIR (≈808 nm)",
      "Vermelho (660 nm) mais superficial",
    ],
  },
  {
    id: "diathermy_heating_time",
    title: i18n("Diatermia — ΔT × Tempo", "Diathermy — ΔT × Time"),
    subtitle: i18n("Aquecimento e perfusão", "Heating and perfusion"),
    description: i18n(
      "Elevação térmica com platô; perfusão dissipa calor.",
      "Temperature rise with plateau; perfusion dissipates heat.",
    ),
    category: "diathermy",
    discipline: i18n("Diatermia", "Diathermy"),
    icon: "heart",
    readonly_equations: ["ΔT(t) = ΔT_max · (1 − e^(−t / τ)) / perfusão"],
  },
];

export function getPresetCatalogEntry(presetId: DynamicChartPresetId) {
  return PRESET_CATALOG.find((entry) => entry.id === presetId);
}

export function getPresetsByCategory(categoryId: ClinicalPresetCategoryId) {
  return PRESET_CATALOG.filter((entry) => entry.category === categoryId);
}

export function getPresetCategoryLabel(
  categoryId: ClinicalPresetCategoryId,
  language: "pt" | "en" = "pt",
): string {
  const category = PRESET_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return categoryId;
  return language === "en" && category.label.en.trim()
    ? category.label.en
    : category.label.pt;
}
