/**
 * Limiares educacionais para colorir métricas do lab de ultrassom terapêutico.
 *
 * Referências (síntese para UI, não prescrição clínica):
 * - Health Canada Safety Code 23: SATA máx. ~3 W/cm² em fisioterapia
 * - WHO / literatura de eletroterapia: faixa terapêutica usual 0,1–3 W/cm²
 * - Dyson, Lehmann: hipertermia terapêutica alvo ~40–45 °C no tecido
 * - CEM43 / modelos térmicos: >43 °C sustentado aumenta risco de dano
 * - Dose acústica (I × t × duty): produto ~3 W/cm² × 10 min ≈ 30 W·min/cm² como teto prático
 */

export type MetricAlertLevel = "ok" | "warn" | "risk";

/** Intensidade espacial média efetiva máxima recomendada (W/cm²) */
export const MAX_SAFE_INTENSITY_W_CM2 = 3.0;

/** Intensidade claramente acima do usual terapêutico (W/cm²) */
export const HIGH_RISK_INTENSITY_W_CM2 = 4.0;

/** Temperatura de superfície: desconforto/queimadura cutânea (°C) */
export const SURFACE_TEMP_WARN_C = 42;
export const SURFACE_TEMP_RISK_C = 45;

/** Temperatura em alvo/profundidade: teto da faixa terapêutica vigorosa (°C) */
export const TISSUE_TEMP_WARN_C = 43;
export const TISSUE_TEMP_RISK_C = 45;

/** Dose acústica como produto intensidade×tempo (W·min/cm²) = J/cm² ÷ 60 */
export const DOSE_WMIN_WARN = 30; // ≈ 3 W/cm² contínuo por 10 min
export const DOSE_WMIN_RISK = 45;

export function metricAlertClass(level: MetricAlertLevel): string | undefined {
  if (level === "risk") return "text-red-500";
  if (level === "warn") return "text-orange-500";
  return undefined;
}

export function effectiveIntensityWCm2(powerW: number, eraCm2: number): number {
  if (eraCm2 <= 0) return 0;
  return powerW / eraCm2;
}

export function doseWMinPerCm2(doseJcm2: number): number {
  return doseJcm2 / 60;
}

export function assessSurfaceTempAlert(tempC: number): MetricAlertLevel {
  if (tempC >= SURFACE_TEMP_RISK_C) return "risk";
  if (tempC >= SURFACE_TEMP_WARN_C) return "warn";
  return "ok";
}

export function assessTissueTempAlert(tempC: number): MetricAlertLevel {
  if (tempC >= TISSUE_TEMP_RISK_C) return "risk";
  if (tempC > TISSUE_TEMP_WARN_C) return "warn";
  return "ok";
}

export function assessIntensityAlert(intensityWCm2: number): MetricAlertLevel {
  if (intensityWCm2 >= HIGH_RISK_INTENSITY_W_CM2) return "risk";
  if (intensityWCm2 > MAX_SAFE_INTENSITY_W_CM2) return "warn";
  return "ok";
}

export function assessDoseAlert(doseJcm2: number): MetricAlertLevel {
  const wMin = doseWMinPerCm2(doseJcm2);
  if (wMin >= DOSE_WMIN_RISK) return "risk";
  if (wMin > DOSE_WMIN_WARN) return "warn";
  return "ok";
}

export function assessPowerAlert(powerW: number, eraCm2: number): MetricAlertLevel {
  return assessIntensityAlert(effectiveIntensityWCm2(powerW, eraCm2));
}
