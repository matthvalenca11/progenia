import type { DynamicChartBlockData, DynamicChartPresetId } from "@/types/dynamicChart";
import { t } from "../helpers";

function presetBlock(
  presetId: DynamicChartPresetId,
  data: Omit<DynamicChartBlockData, "source_type" | "preset_id">,
): DynamicChartBlockData {
  return {
    source_type: "preset",
    preset_id: presetId,
    feedbackDisplayMode: "highest_priority",
    ...data,
  };
}

/**
 * Modelo de Hill (1938) — relação força–velocidade no contrato concêntrico.
 * v = b·(F0 − F)/(F + a), com a ≈ 0,25·F0 e b = Vmax·a/F0.
 * Invertendo: F(v) = (b·F0 − v·a)/(b + v).
 */
function hillForceVelocity(): DynamicChartBlockData {
  return presetBlock("hill_force_velocity", {
    title: t("Relação Força–Velocidade (Hill)", "Force–Velocity Relationship (Hill)"),
    subtitle: t("Contrato muscular concêntrico", "Concentric muscle contraction"),
    description: t(
      "O modelo de Hill descreve a relação hiperbólica entre força e velocidade de encurtamento: à medida que a velocidade aumenta, a força máxima gerada diminui.",
      "The Hill model describes the hyperbolic relationship between force and shortening velocity: as velocity increases, the maximum generated force decreases.",
    ),
    axes: {
      x: {
        label: t("Velocidade de encurtamento", "Shortening velocity"),
        unit: "m/s",
        min: 0,
        max: 1.5,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Força", "Force"),
        unit: "N",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "f0",
        name: t("Força máxima isométrica (F₀)", "Maximum isometric force (F₀)"),
        unit: "N",
        min: 200,
        max: 900,
        step: 10,
        defaultValue: 600,
      },
      {
        id: "vmax",
        name: t("Velocidade máxima (Vmax)", "Maximum velocity (Vmax)"),
        unit: "m/s",
        min: 0.4,
        max: 2,
        step: 0.05,
        defaultValue: 1.2,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "f0 > 750",
        feedbackText: t(
          "**Alta F₀:** maior capacidade de força isométrica — a curva F–V se desloca para cima em baixas velocidades.",
          "**High F₀:** greater isometric force capacity — the F–V curve shifts upward at low velocities.",
        ),
        type: "success",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "vmax > 1.5",
        feedbackText: t(
          "**Vmax elevado:** fibras rápidas (tipo II) — maior velocidade de encurtamento, porém força reduzida em altas velocidades.",
          "**High Vmax:** fast-twitch fibers (type II) — greater shortening velocity, but reduced force at high velocities.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** F(L) = Fmax · exp(−((L − Lopt)/W)²) — sobreposição de miofilamentos (relação comprimento–tensão) */
function muscleLengthTension(): DynamicChartBlockData {
  return presetBlock("muscle_length_tension", {
    title: t("Relação Comprimento–Tensão Muscular", "Muscle Length–Tension Relationship"),
    subtitle: t(
      "Sobreposição de miofilamentos e janela ótima",
      "Myofilament overlap and optimal window",
    ),
    description: t(
      "A força isométrica varia com o comprimento do sarcômero, seguindo uma curva gaussiana com pico no comprimento ótimo (Lopt), onde a sobreposição actina-miosina é máxima.",
      "Isometric force varies with sarcomere length, following a Gaussian curve peaking at the optimal length (Lopt), where actin–myosin overlap is maximal.",
    ),
    axes: {
      x: {
        label: t("Comprimento muscular relativo (L/Lopt)", "Relative muscle length (L/Lopt)"),
        unit: "",
        min: 0.7,
        max: 1.4,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Força isométrica", "Isometric force"),
        unit: "N",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "f_max",
        name: t("Força máxima (Fmax)", "Maximum force (Fmax)"),
        unit: "N",
        min: 200,
        max: 1500,
        step: 10,
        defaultValue: 800,
      },
      {
        id: "l_opt",
        name: t("Comprimento ótimo (Lopt)", "Optimal length (Lopt)"),
        unit: "",
        min: 0.8,
        max: 1.3,
        step: 0.01,
        defaultValue: 1.05,
      },
      {
        id: "gaussian_width",
        name: t("Largura da curva (W)", "Curve width (W)"),
        unit: "",
        min: 0.1,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.25,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "l_opt > 1.15",
        feedbackText: t(
          "**Lopt deslocado:** comprimento ótimo elevado sugere sarcômeros alongados — pode indicar lesão por estiramento ou adaptação a treino excêntrico.",
          "**Shifted Lopt:** an elevated optimal length suggests lengthened sarcomeres — may indicate stretch injury or adaptation to eccentric training.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb2",
        condition: "gaussian_width < 0.15",
        feedbackText: t(
          "**Janela estreita:** pequenos desvios do comprimento ótimo reduzem drasticamente a força — maior sensibilidade ao posicionamento articular.",
          "**Narrow window:** small deviations from the optimal length drastically reduce force — greater sensitivity to joint positioning.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb3",
        condition: "f_max > 1000",
        feedbackText: t(
          "**Alta força máxima:** unidade ou grupo muscular com grande capacidade contrátil (ex.: quadríceps treinado).",
          "**High maximum force:** motor unit or muscle group with large contractile capacity (e.g., trained quadriceps).",
        ),
        type: "success",
        priority: 3,
      },
    ],
  });
}

/** ε(t) = σ · C · (1 − exp(−t/τ)) — creep viscoelástico (modelo de Kelvin–Voigt, C = 1/E) */
function viscoelasticCreep(): DynamicChartBlockData {
  return presetBlock("viscoelastic_creep", {
    title: t("Creep Viscoelástico", "Viscoelastic Creep"),
    subtitle: t("Deformação retardada (Kelvin–Voigt)", "Delayed deformation (Kelvin–Voigt)"),
    description: t(
      "Sob carga constante, tecidos viscoelásticos (tendão, cápsula articular) se deformam progressivamente até um platô, com velocidade de deformação determinada pela constante de tempo τ.",
      "Under constant load, viscoelastic tissues (tendon, joint capsule) progressively deform toward a plateau, with deformation rate determined by the time constant τ.",
    ),
    axes: {
      x: {
        label: t("Tempo sob carga", "Time under load"),
        unit: "s",
        min: 0,
        max: 120,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Deformação (ε)", "Strain (ε)"),
        unit: "%",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "applied_stress",
        name: t("Tensão aplicada (σ)", "Applied stress (σ)"),
        unit: "kPa",
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 50,
      },
      {
        id: "tau",
        name: t("Constante de tempo (τ)", "Time constant (τ)"),
        unit: "s",
        min: 1,
        max: 60,
        step: 1,
        defaultValue: 20,
      },
      {
        id: "compliance",
        name: t("Complacência tecidual (C = 1/E)", "Tissue compliance (C = 1/E)"),
        unit: "1/kPa",
        min: 0.001,
        max: 0.02,
        step: 0.001,
        defaultValue: 0.01,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "tau > 40",
        feedbackText: t(
          "**τ elevada:** deformação lenta e progressiva — tecido com alta viscosidade relativa, típico de estruturas colágenas densas.",
          "**High τ:** slow, progressive deformation — tissue with high relative viscosity, typical of dense collagenous structures.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "compliance > 0.015",
        feedbackText: t(
          "**Alta complacência:** tecido mais deformável — maior deslocamento para a mesma tensão aplicada, associado a menor rigidez.",
          "**High compliance:** more deformable tissue — greater displacement for the same applied stress, associated with lower stiffness.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "applied_stress > 80",
        feedbackText: t(
          "**Tensão aplicada alta:** risco de deformação plástica ou lesão tecidual se sustentada por tempo prolongado.",
          "**High applied stress:** risk of plastic deformation or tissue injury if sustained for a prolonged period.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

/** σ = E · ε — região elástica linear (Lei de Hooke) do osso cortical */
function boneStressStrain(): DynamicChartBlockData {
  return presetBlock("bone_stress_strain", {
    title: t("Tensão × Deformação Óssea", "Bone Stress–Strain"),
    subtitle: t("Região elástica linear (Lei de Hooke)", "Linear elastic region (Hooke's law)"),
    description: t(
      "Na região elástica do osso cortical, a tensão varia linearmente com a deformação; a inclinação da reta é o módulo de Young (E). Além da deformação de escoamento, o comportamento deixa de ser linear.",
      "In the elastic region of cortical bone, stress varies linearly with strain; the line's slope is Young's modulus (E). Beyond the yield strain, behavior is no longer linear.",
    ),
    axes: {
      x: {
        label: t("Deformação (ε)", "Strain (ε)"),
        unit: "",
        min: 0,
        max: 0.02,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Tensão (σ)", "Stress (σ)"),
        unit: "MPa",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "young_modulus",
        name: t("Módulo de Young (E)", "Young's modulus (E)"),
        unit: "GPa",
        min: 10,
        max: 20,
        step: 0.5,
        defaultValue: 17,
      },
      {
        id: "yield_strain",
        name: t("Deformação de escoamento", "Yield strain"),
        unit: "",
        min: 0.005,
        max: 0.015,
        step: 0.001,
        defaultValue: 0.01,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "young_modulus > 18",
        feedbackText: t(
          "**Módulo de Young elevado:** osso mais rígido e mineralizado — maior tensão para a mesma deformação.",
          "**High Young's modulus:** stiffer, more mineralized bone — greater stress for the same strain.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "yield_strain < 0.008",
        feedbackText: t(
          "**Deformação de escoamento baixa:** osso mais frágil — atinge a região plástica/fratura com menor deformação.",
          "**Low yield strain:** more brittle bone — reaches the plastic/fracture region at lower strain.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "yield_strain > 0.012",
        feedbackText: t(
          "**Deformação de escoamento alta:** osso mais dúctil — tolera maior deformação antes de sair da região elástica.",
          "**High yield strain:** more ductile bone — tolerates greater strain before leaving the elastic region.",
        ),
        type: "success",
        priority: 3,
      },
    ],
  });
}

export const BIOMECHANICS_PRESET_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  hill_force_velocity: hillForceVelocity,
  muscle_length_tension: muscleLengthTension,
  viscoelastic_creep: viscoelasticCreep,
  bone_stress_strain: boneStressStrain,
};
