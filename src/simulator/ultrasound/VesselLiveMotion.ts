import type { UltrasoundInclusionConfig } from '@/types/acousticMedia';

/** Fast upstroke, slower downstroke — shared cardiac envelope. */
export function vesselPulseEnvelope(time: number, artery: boolean): number {
  const rateHz = artery ? 1.2 : 0.78;
  const phase = (time * rateHz) % 1;
  if (phase < 0.18) return phase / 0.18;
  return Math.max(0, 1 - (phase - 0.18) / 0.82);
}

export function isArteryInclusion(inclusion: UltrasoundInclusionConfig): boolean {
  if (inclusion.type !== 'vessel' || inclusion.mediumInsideId !== 'blood') return false;
  const id = `${inclusion.id} ${inclusion.label}`.toLowerCase();
  return id.includes('arter') || id.includes('arté') || id.includes('carot');
}

export function isVeinInclusion(inclusion: UltrasoundInclusionConfig): boolean {
  if (inclusion.type !== 'vessel' || inclusion.mediumInsideId !== 'blood') return false;
  if (isArteryInclusion(inclusion)) return false;
  const id = `${inclusion.id} ${inclusion.label}`.toLowerCase();
  return (
    id.includes('vein') ||
    id.includes('veia') ||
    id.includes('jugul') ||
    id.includes('v jug') ||
    inclusion.type === 'vessel'
  );
}

export function isBloodVessel(inclusion: UltrasoundInclusionConfig): boolean {
  return inclusion.type === 'vessel' && inclusion.mediumInsideId === 'blood';
}

/** Light systolic expansion amplitude (cm radial). */
export function vesselExpansionCm(pulse: number, artery: boolean): number {
  const amp = artery ? 0.04 : 0.022;
  return (pulse - 0.5) * amp;
}

export type VesselProximity = {
  isInside: boolean;
  distanceFromEdge: number;
  localLateralCm: number;
  localDepthCm: number;
  radialPos: number;
  vesselRadiusCm: number;
  insideStrength: number;
  edgeStrength: number;
  laminarCore: number;
};

export function buildVesselProximity(
  depth: number,
  lateral: number,
  inclusion: UltrasoundInclusionConfig,
  dist: { isInside: boolean; distanceFromEdge: number },
): VesselProximity {
  const inclLateralCm = inclusion.centerLateralPos * 2.5;
  const localLateralCm = lateral - inclLateralCm;
  const localDepthCm = depth - inclusion.centerDepthCm;
  const vesselRadiusCm = Math.max(0.001, Math.min(inclusion.sizeCm.width, inclusion.sizeCm.height) / 2);
  const radialCm = Math.max(0.001, Math.sqrt(localLateralCm * localLateralCm + localDepthCm * localDepthCm));
  const radialPos = Math.min(1, radialCm / vesselRadiusCm);
  const nearBand = vesselRadiusCm * 0.5;
  const insideStrength = dist.isInside
    ? 1
    : Math.max(0, 1 - dist.distanceFromEdge / nearBand);
  const edgeStrength = dist.isInside
    ? Math.max(0, 1 - dist.distanceFromEdge / Math.max(0.05, vesselRadiusCm * 0.22))
    : Math.max(0, 1 - dist.distanceFromEdge / (vesselRadiusCm * 0.18));
  const laminarCore = dist.isInside ? Math.max(0, 1 - radialPos * radialPos) : 0;

  return {
    isInside: dist.isInside,
    distanceFromEdge: dist.distanceFromEdge,
    localLateralCm,
    localDepthCm,
    radialPos,
    vesselRadiusCm,
    insideStrength,
    edgeStrength,
    laminarCore,
  };
}

export type VesselFlowSample = {
  dxPx: number;
  dyPx: number;
  intensityMult: number;
  intensityAdd: number;
};

/**
 * Light expansion/retraction warp + laminar flow echo for cache/live frames.
 */
export function computeVesselLiveMotion(
  time: number,
  seed: number,
  inclusion: UltrasoundInclusionConfig,
  prox: VesselProximity,
  lateralPxPerCm: number,
  depthPxPerCm: number,
): VesselFlowSample {
  const artery = isArteryInclusion(inclusion);
  const pulse = vesselPulseEnvelope(time, artery);
  const expandCm = vesselExpansionCm(pulse, artery) * prox.insideStrength;
  const radialCm = Math.max(
    0.001,
    Math.sqrt(prox.localLateralCm * prox.localLateralCm + prox.localDepthCm * prox.localDepthCm),
  );

  let dxPx = 0;
  let dyPx = 0;

  if (radialCm > 0.001 && expandCm !== 0) {
    dxPx += (prox.localLateralCm / radialCm) * expandCm * lateralPxPerCm;
    dyPx += (prox.localDepthCm / radialCm) * expandCm * depthPxPerCm;
  }

  const rotRad = ((inclusion.rotationDegrees ?? 0) * Math.PI) / 180;
  const alongX = Math.cos(rotRad);
  const alongY = Math.sin(rotRad);
  const flowHz = artery ? 4.8 : 2.6;
  const scrollCm =
    Math.sin(time * flowHz + prox.localLateralCm * 7 + prox.localDepthCm * 5 + seed) *
    0.012 *
    prox.laminarCore;
  dxPx += alongX * scrollCm * lateralPxPerCm;
  dyPx += alongY * scrollCm * depthPxPerCm;

  if (inclusion.shape === 'capsule') {
    const wallBreath = (pulse - 0.5) * (artery ? 0.028 : 0.016) * prox.edgeStrength;
    dyPx += prox.localDepthCm * depthPxPerCm * wallBreath;
    dxPx += Math.sin(time * flowHz * 1.1 + seed) * 0.22 * prox.laminarCore;
  }

  const flowTex = Math.sin(time * flowHz * 1.3 + prox.localLateralCm * 11 + prox.localDepthCm * 8 + seed);
  const wallThrob = 1 + (pulse - 0.5) * 0.065 * prox.edgeStrength;
  const laminarMod = 1 + (flowTex * 0.5) * 0.1 * prox.laminarCore;
  const movingEcho = Math.max(0, flowTex - 0.25) * 0.09 * pulse * prox.laminarCore;

  return {
    dxPx,
    dyPx,
    intensityMult: wallThrob * laminarMod,
    intensityAdd: movingEcho,
  };
}
