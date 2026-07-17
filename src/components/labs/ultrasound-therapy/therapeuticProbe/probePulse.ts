import type { MeshPhysicalMaterial, MeshStandardMaterial } from "three";

export function setCeramicPulseClinical(
  mat: MeshStandardMaterial | MeshPhysicalMaterial | null,
  mode: "continuous" | "pulsed",
  intensity: number,
  dutyCycle: number,
  time: number,
  isFocused: boolean,
) {
  if (!mat) return;
  const base = isFocused ? 0.07 : 0.05;
  if (mode === "continuous") {
    mat.emissiveIntensity = base + Math.sin(time * 2.2) * 0.02 * intensity;
  } else {
    const period = 1.0;
    const onTime = period * (dutyCycle / 100);
    const isOn = (time % period) / period < onTime / period;
    mat.emissiveIntensity = isOn ? base * 1.8 * intensity : base * 0.35;
  }
}
