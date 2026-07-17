import { LatheGeometry, Vector2 } from "three";

/** Corpo único cabeça+pescoço — sem cilindros empilhados */
export function buildProbeBodyProfile(
  headR: number,
  activeR: number,
  faceBottomY: number,
  faceH: number,
  neckR: number,
  neckH: number,
  focused: boolean,
): Vector2[] {
  const faceTopY = faceBottomY + faceH;
  const neckTopY = faceTopY + neckH;
  const flare = focused ? 1.04 : 1.0;

  return [
    new Vector2(activeR * 1.04, faceBottomY + 0.004),
    new Vector2(headR * 0.72 * flare, faceBottomY + faceH * 0.18),
    new Vector2(headR * 0.9 * flare, faceBottomY + faceH * 0.62),
    new Vector2(headR * 0.86, faceTopY - 0.001),
    new Vector2(headR * 0.62, faceTopY + neckH * 0.28),
    new Vector2(neckR * 1.04, faceTopY + neckH * 0.72),
    new Vector2(neckR * 0.96, neckTopY),
  ];
}

export function buildProbeBodyGeometry(
  headR: number,
  activeR: number,
  faceBottomY: number,
  faceH: number,
  neckR: number,
  neckH: number,
  focused: boolean,
): LatheGeometry {
  const geo = new LatheGeometry(
    buildProbeBodyProfile(headR, activeR, faceBottomY, faceH, neckR, neckH, focused),
    72,
  );
  geo.computeVertexNormals();
  return geo;
}

export function buildConcaveActiveFaceProfile(radius: number, depth: number): Vector2[] {
  const segments = 24;
  const points: Vector2[] = [new Vector2(0.001, depth * 0.1)];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const r = radius * t;
    points.push(new Vector2(r, depth * (1 - t * t * 0.82)));
  }
  points.push(new Vector2(radius * 0.99, 0.001));
  points.push(new Vector2(0.001, 0.001));
  return points;
}

export function buildGelDomeProfile(radius: number, peakHeight: number, edgeHeight: number): Vector2[] {
  const segments = 20;
  const points: Vector2[] = [
    new Vector2(0.002, edgeHeight),
    new Vector2(radius, edgeHeight),
  ];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const r = radius * (1 - t);
    const nr = radius > 0 ? r / radius : 0;
    const h = edgeHeight + (peakHeight - edgeHeight) * (1 - nr * nr);
    points.push(new Vector2(r, h));
  }
  return points;
}
