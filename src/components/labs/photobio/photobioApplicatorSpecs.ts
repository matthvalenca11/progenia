import type { PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioApplicatorType, PhotobioVisualQualityTier } from "./photobioApplicatorTypes";

export const WAVELENGTH_COLORS = {
  660: { beam: "#FF4500", glow: "#ff5a2a", lens: "#ffe8dc" },
  808: { beam: "#c4008f", glow: "#ff47ff", lens: "#3a0a2a" },
} as const;

export interface EmitterSlot {
  x: number;
  y: number;
  z: number;
  wavelength: 660 | 808;
  ring: number;
}

export interface ApplicatorLayout {
  bodyOffsetY: number;
  tipOffsetY: number;
  headRadius: number;
  lensRadius: number;
  emitters: EmitterSlot[];
}

function qualityScale(tier: PhotobioVisualQualityTier): number {
  if (tier === "low") return 0.55;
  if (tier === "medium") return 0.78;
  return 1;
}

function ringEmitters(
  count: number,
  radius: number,
  y: number,
  wavelength: 660 | 808,
  ring: number,
  startAngle = 0,
): EmitterSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + (i / count) * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
      wavelength,
      ring,
    };
  });
}

export function buildApplicatorLayout(
  type: PhotobioApplicatorType,
  spotSizeCm2: number,
  tier: PhotobioVisualQualityTier,
  activeWavelength: PhotobioWavelength,
  secondaryWavelength?: PhotobioWavelength,
): ApplicatorLayout {
  const q = qualityScale(tier);
  const spotRadiusCm = Math.sqrt(Math.max(spotSizeCm2, 0.05) / Math.PI);
  const lensRadius = 0.06 + spotRadiusCm * 0.11;

  if (type === "pointLaser") {
    return {
      bodyOffsetY: 0.82,
      tipOffsetY: -0.98,
      headRadius: 0.055 + spotRadiusCm * 0.04,
      lensRadius: Math.min(0.09, lensRadius * 0.55),
      emitters: [{ x: 0, y: -0.99, z: 0, wavelength: activeWavelength, ring: 0 }],
    };
  }

  if (type === "largeAreaPanel") {
    const cols = tier === "low" ? 3 : tier === "medium" ? 4 : 5;
    const rows = tier === "low" ? 2 : 3;
    const spacing = 0.07;
    const emitters: EmitterSlot[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const alt: 660 | 808 = (r + c) % 2 === 0 ? 660 : 808;
        emitters.push({
          x: (c - (cols - 1) / 2) * spacing,
          y: 0,
          z: (r - (rows - 1) / 2) * spacing * 0.85,
          wavelength: alt,
          ring: 0,
        });
      }
    }
    return {
      bodyOffsetY: 0.35,
      tipOffsetY: -0.06,
      headRadius: 0.28 + spotRadiusCm * 0.06,
      lensRadius: Math.min(0.32, 0.18 + spotRadiusCm * 0.08),
      emitters,
    };
  }

  if (type === "dualWavelengthCluster") {
    const perRing = tier === "low" ? 6 : tier === "medium" ? 8 : 10;
    const rings = tier === "low" ? 2 : 3;
    const emitters: EmitterSlot[] = [];
    for (let ring = 0; ring < rings; ring += 1) {
      const radius = 0.045 + ring * 0.042;
      const wl: 660 | 808 = ring % 2 === 0 ? 660 : 808;
      emitters.push(...ringEmitters(perRing, radius, 0, wl, ring, ring * 0.2));
    }
    if (secondaryWavelength && secondaryWavelength !== activeWavelength) {
      emitters.push({
        x: 0,
        y: 0,
        z: 0,
        wavelength: secondaryWavelength,
        ring: 0,
      });
    }
    return {
      bodyOffsetY: 1.02 * q + 0.12,
      tipOffsetY: -1.0,
      headRadius: 0.21 + spotRadiusCm * 0.05,
      lensRadius: Math.min(0.24, lensRadius),
      emitters,
    };
  }

  // cluster (default THOR-style)
  const perRing = Math.max(4, Math.round((tier === "low" ? 5 : tier === "medium" ? 7 : 9) * q));
  const emitters: EmitterSlot[] = [
    ...ringEmitters(perRing, 0.05, 0, 660, 0),
    ...ringEmitters(perRing, 0.095, 0, 808, 1, Math.PI / perRing),
  ];
  return {
    bodyOffsetY: 0.95 * q + 0.1,
    tipOffsetY: -0.98,
    headRadius: 0.18 + spotRadiusCm * 0.045,
    lensRadius: Math.min(0.2, lensRadius * 0.9),
    emitters,
  };
}

/** Espessura da pastilha de contato (face que assenta na pele). */
export const APPLICATOR_CONTACT_PAD_HEIGHT = 0.022;

/** Lowest mesh Y inside ApplicatorHead (local to head group). */
export const APPLICATOR_MESH_BOTTOM_Y: Record<PhotobioApplicatorType, number> = {
  cluster: -0.71,
  pointLaser: -0.39,
  dualWavelengthCluster: -0.83,
  largeAreaPanel: 0.05,
};

/** ApplicatorHead group Y offset inside the body-lift group. */
export const APPLICATOR_HEAD_BASE_Y: Record<PhotobioApplicatorType, number> = {
  cluster: -0.88,
  pointLaser: -0.88,
  dualWavelengthCluster: -0.88,
  largeAreaPanel: -0.02,
};

/** Y of the lowest contact mesh relative to the device root group. */
export function applicatorSkinContactOffsetY(
  type: PhotobioApplicatorType,
  bodyLift: number,
): number {
  return bodyLift + APPLICATOR_HEAD_BASE_Y[type] + APPLICATOR_MESH_BOTTOM_Y[type];
}

/** Distance from the contact face (y=0) to the device root when the face rests on skin. */
export function applicatorContactLiftY(
  type: PhotobioApplicatorType,
  bodyLift: number,
): number {
  return -applicatorSkinContactOffsetY(type, bodyLift);
}

/** Raio físico da face plana de contato (malha 3D), em unidades de mundo. */
export function getApplicatorContactRadius(
  type: PhotobioApplicatorType,
  spotSizeCm2: number,
): number {
  const spotRadiusCm = Math.sqrt(Math.max(spotSizeCm2, 0.05) / Math.PI);
  if (type === "pointLaser") return 0.055 + spotRadiusCm * 0.04;
  if (type === "largeAreaPanel") return 0.28 + spotRadiusCm * 0.06;
  if (type === "dualWavelengthCluster") return 0.21 + spotRadiusCm * 0.05;
  return 0.18 + spotRadiusCm * 0.045;
}

export function clampPowerGlow(powerMw: number): number {
  return Math.max(0.35, Math.min(1.75, 0.42 + powerMw / 380));
}

export function contactSinkDepth(contactPressure: number): number {
  return (Math.max(0, Math.min(100, contactPressure)) / 100) * 0.035;
}

export function emitterIntensity(
  slot: EmitterSlot,
  activeWavelength: PhotobioWavelength,
  powerGlow: number,
  pulse: number,
  isActive: boolean,
): number {
  if (!isActive) return 0.08;
  const isActiveEmitter = slot.wavelength === activeWavelength;
  const base = isActiveEmitter ? 1.15 * powerGlow : 0.22 * powerGlow;
  return base * pulse;
}
