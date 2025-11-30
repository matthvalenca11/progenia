export type TensMode = "convencional" | "acupuntura" | "burst" | "modulado";

export interface TensParams {
  frequencyHz: number;    // 1–200
  pulseWidthUs: number;   // 50–400
  intensitymA: number;    // 0–80
  mode: TensMode;
}

export interface TensSimulationResult {
  comfortLevel: number;     // 0–100 (100 = muito confortável)
  activationLevel: number;  // 0–100 (100 = ativação sensorial alta)
  comfortMessage: string;   // texto para o card de feedback
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function simulateTens(params: TensParams): TensSimulationResult {
  const { frequencyHz, pulseWidthUs, intensitymA, mode } = params;

  // Normalizações (0–1)
  const normIntensity = clamp01(intensitymA / 80);
  const normPulse = clamp01((pulseWidthUs - 50) / (400 - 50));
  const normFreq = clamp01((frequencyHz - 1) / (200 - 1));

  // Viés de conforto por modo
  let comfortBias = 0;
  switch (mode) {
    case "convencional":
      comfortBias = 0.10;
      break;
    case "acupuntura":
      comfortBias = -0.05;
      break;
    case "burst":
      comfortBias = -0.10;
      break;
    case "modulado":
      comfortBias = 0;
      break;
  }

  // Disconforto básico (mais intensidade e pulso largo = mais desconforto)
  const rawDiscomfort =
    0.55 * normIntensity +
    0.30 * normPulse +
    0.15 * normFreq;

  const adjustedDiscomfort = clamp01(rawDiscomfort - comfortBias);

  // Conforto é o inverso do desconforto
  let comfortLevel = (1 - adjustedDiscomfort) * 100;
  comfortLevel = Math.round(clamp01(comfortLevel / 100) * 100);

  // Ativação sensorial: cresce com intensidade e frequência
  const rawActivation =
    0.60 * normIntensity +
    0.25 * normFreq +
    0.15 * normPulse;

  let activationBoost = 0;
  switch (mode) {
    case "convencional":
      activationBoost = 0.05;
      break;
    case "acupuntura":
      activationBoost = 0.10;
      break;
    case "burst":
      activationBoost = 0.15;
      break;
    case "modulado":
      activationBoost = 0.08;
      break;
  }

  let activationLevel = clamp01(rawActivation + activationBoost) * 100;
  activationLevel = Math.round(activationLevel);

  // Mensagem de conforto
  let comfortMessage = "";
  if (comfortLevel >= 70) {
    comfortMessage = "Estimulação confortável";
  } else if (comfortLevel >= 40) {
    comfortMessage = "Estimulação intensa (monitorar conforto do paciente)";
  } else {
    comfortMessage =
      "Parâmetros potencialmente desconfortáveis – ajustar intensidade ou largura de pulso";
  }

  return {
    comfortLevel,
    activationLevel,
    comfortMessage,
  };
}
