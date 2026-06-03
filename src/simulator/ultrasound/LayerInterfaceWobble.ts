/** Peak lateral shift of layer boundaries (~0.1 mm) — subtle, not wavy “cartoon” lines. */
export const LAYER_INTERFACE_WOBBLE_AMP_CM = 0.01;

/**
 * Nominal horizontal interface depth with gentle lateral undulation.
 * @param nominalDepthCm cumulative depth of the interface (cm)
 * @param lateralCm lateral anatomical coordinate (cm)
 * @param interfaceIndex boundary index (0 = after first layer, …)
 */
export function wavyInterfaceDepthCm(
  nominalDepthCm: number,
  lateralCm: number,
  interfaceIndex: number,
): number {
  const s = interfaceIndex * 2.71 + nominalDepthCm * 0.42;
  const w =
    Math.sin(lateralCm * 2.3 + s) * 0.52 +
    Math.sin(lateralCm * 5.1 + s * 1.37) * 0.28 +
    Math.sin(lateralCm * 0.85 + s * 0.6) * 0.14;
  return nominalDepthCm + w * LAYER_INTERFACE_WOBBLE_AMP_CM;
}
