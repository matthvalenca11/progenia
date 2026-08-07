import * as THREE from "three";

/** MRI-style false-color ramp (purple → cyan → green → yellow). */
const HEAT_STOPS: Array<{ t: number; c: THREE.Color }> = [
  { t: 0.0, c: new THREE.Color("#2d0066") },
  { t: 0.22, c: new THREE.Color("#0066cc") },
  { t: 0.45, c: new THREE.Color("#00b8b8") },
  { t: 0.68, c: new THREE.Color("#33dd88") },
  { t: 0.85, c: new THREE.Color("#a8f030") },
  { t: 1.0, c: new THREE.Color("#ffff44") },
];

function sampleHeatmap(t: number, out = new THREE.Color()): THREE.Color {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const a = HEAT_STOPS[i];
    const b = HEAT_STOPS[i + 1];
    if (x <= b.t) {
      const u = (x - a.t) / Math.max(1e-6, b.t - a.t);
      return out.copy(a.c).lerp(b.c, u);
    }
  }
  return out.copy(HEAT_STOPS[HEAT_STOPS.length - 1].c);
}

function smoothBell(x: number, center: number, width: number) {
  const d = (x - center) / Math.max(width, 1e-6);
  return Math.exp(-d * d);
}

/** Deform unit sphere into a readable head silhouette (face +Z, profile ≈ MRI atlas). */
export function deformHeadVertex(x: number, y: number, z: number): THREE.Vector3 {
  let px = x;
  let py = y;
  let pz = z;

  // Base cranial ellipsoid — taller than wide, face-forward
  px *= 0.84;
  py *= 1.08;
  pz *= 0.92;

  const face = THREE.MathUtils.smoothstep(pz, -0.05, 0.55);

  // Occiput / back of skull — flat
  if (pz < -0.05) {
    const back = THREE.MathUtils.smoothstep(-pz, 0.05, 0.55);
    pz *= 1 - back * 0.22;
    px *= 1 + back * 0.04;
  }

  // Forehead dome
  if (py > 0.05) {
    const crown = THREE.MathUtils.smoothstep(py, 0.05, 0.65);
    px *= 1 - crown * 0.08;
    pz *= 1 - crown * 0.06;
    py += crown * 0.05 * face;
  }

  // Brow ridge
  if (py > 0.05 && py < 0.35 && pz > 0.35) {
    py += 0.05 * face;
    pz += 0.03 * face;
  }

  // Cheek taper (face width)
  if (face > 0.2) {
    px *= 1 - face * 0.1;
  }

  // Jaw + chin
  if (py < 0.05 && pz > -0.15) {
    const jaw = THREE.MathUtils.smoothstep(-py, 0.05, 0.55);
    px *= 0.78 + jaw * 0.18;
    if (pz > 0.2 && py < -0.12) {
      py -= 0.16 * jaw * face;
      pz += 0.05 * jaw;
    }
  }

  // Nose bridge + tip
  const noseBridge = smoothBell(px, 0, 0.11) * smoothBell(py, 0.02, 0.18) * smoothBell(pz, 0.72, 0.12);
  pz += noseBridge * 0.16;
  if (Math.abs(px) < 0.08 && py > -0.18 && py < 0.08 && pz > 0.58) {
    pz += 0.1 * (1 - Math.abs(px) / 0.08);
  }

  // Eye sockets (indent for readable face)
  for (const side of [-1, 1]) {
    const ex = px - side * 0.26;
    const ey = py - 0.1;
    const ez = pz - 0.58;
    const socket = ex * ex * 4 + ey * ey * 3 + ez * ez * 5;
    if (socket < 0.035) {
      const t = 1 - socket / 0.035;
      pz -= 0.09 * t;
      py -= 0.02 * t;
    }
  }

  // Ear bulges (lateral)
  const earL = smoothBell(Math.abs(px), 0.9, 0.08) * smoothBell(py, 0.04, 0.22) * smoothBell(pz, 0, 0.35);
  if (earL > 0.08) {
    px += Math.sign(px) * earL * 0.11;
  }

  // Neck taper at base
  if (py < -0.52) {
    const neck = THREE.MathUtils.smoothstep(-py, 0.52, 0.95);
    px *= 1 - neck * 0.28;
    pz *= 1 - neck * 0.22;
    py -= neck * 0.06;
  }

  return new THREE.Vector3(px, py, pz);
}

export function headShellHeat(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  const face = THREE.MathUtils.smoothstep(nz, -0.15, 0.75);
  const depth = 1 - r * 0.32;
  const crown = THREE.MathUtils.smoothstep(y, -0.15, 0.7);
  const profile = THREE.MathUtils.smoothstep(nz, 0.2, 0.85) * (1 - THREE.MathUtils.smoothstep(Math.abs(x), 0.2, 0.75));
  return THREE.MathUtils.clamp(
    0.15 + depth * 0.28 + face * 0.2 + crown * 0.16 + profile * 0.14 + nz * 0.08,
    0,
    1,
  );
}

export function brainHeat(x: number, y: number, z: number): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  const gyri =
    0.5 +
    0.5 *
      Math.sin(x * 14 + y * 11) *
      Math.cos(y * 13 - z * 10) *
      Math.sin(z * 12 + x * 8);
  return THREE.MathUtils.clamp(0.35 + (1 - r) * 0.25 + gyri * 0.22, 0, 1);
}

export function buildColoredHeadGeometry(
  radius: number,
  segments: [number, number],
  heatFn: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number,
  deform = true,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, segments[0], segments[1]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const v = deform ? deformHeadVertex(tmp.x, tmp.y, tmp.z) : tmp;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const norm = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const n = new THREE.Vector3().fromBufferAttribute(norm, i);
    const t = heatFn(tmp.x, tmp.y, tmp.z, n.x, n.y, n.z);
    sampleHeatmap(t, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Procedural brain cross-section texture for the clipping cap. */
export function createBrainSliceTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  bg.addColorStop(0, "#ffff55");
  bg.addColorStop(0.35, "#55ee99");
  bg.addColorStop(0.65, "#22bbcc");
  bg.addColorStop(1, "#330066");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  for (let ring = 0; ring < 7; ring++) {
    const rr = r * (0.2 + ring * 0.11);
    ctx.strokeStyle = `rgba(255,255,120,${0.15 + ring * 0.04})`;
    ctx.lineWidth = 1.2 + ring * 0.15;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.08) {
      const wobble = Math.sin(a * 5 + ring) * 4 + Math.cos(a * 9 - ring * 2) * 3;
      const px = cx + Math.cos(a) * (rr + wobble);
      const py = cy + Math.sin(a) * (rr + wobble * 0.85);
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Sulci strokes
  ctx.strokeStyle = "rgba(45,0,102,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r * 0.15, cy + Math.sin(angle) * r * 0.15);
    ctx.bezierCurveTo(
      cx + Math.cos(angle + 0.4) * r * 0.55,
      cy + Math.sin(angle + 0.4) * r * 0.55,
      cx + Math.cos(angle - 0.3) * r * 0.75,
      cy + Math.sin(angle - 0.3) * r * 0.75,
      cx + Math.cos(angle + 0.1) * r * 0.9,
      cy + Math.sin(angle + 0.1) * r * 0.9,
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createClippedVolumeMaterial(
  clippingPlanes: THREE.Plane[],
  opts?: { opacity?: number; side?: THREE.Side },
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: (opts?.opacity ?? 1) < 1,
    opacity: opts?.opacity ?? 1,
    side: opts?.side ?? THREE.FrontSide,
    clippingPlanes,
    clipShadows: false,
  });
}
