/**
 * WebGLUltrasoundEngine
 *
 * GPU-accelerated B-mode ultrasound renderer using WebGL2 fragment shaders.
 * All physics (attenuation, speckle, tissue boundaries, shadows, focus) run
 * on the GPU — each pixel is computed in parallel, enabling 60 fps even on
 * low-end Android devices.
 *
 * Drop-in replacement for UnifiedUltrasoundEngine: same UnifiedEngineConfig,
 * same start/stop/updateConfig/renderFrameAt interface.
 */

import { ACOUSTIC_MEDIA, getAcousticMedium } from '@/types/acousticMedia';
import type { UnifiedEngineConfig } from './UnifiedUltrasoundEngine';

// ─── Echogenicity numeric map ───────────────────────────────────────────────
const ECHO_VALUES = {
  anechoic:    0.00,
  hypoechoic:  0.18,
  isoechoic:   0.45,
  hyperechoic: 0.80,
} as const;

function echoForMedium(mediumId: string): number {
  const m = ACOUSTIC_MEDIA[mediumId as keyof typeof ACOUSTIC_MEDIA];
  if (!m) return 0.3;
  return ECHO_VALUES[m.baseEchogenicity] ?? 0.3;
}

function attenForMedium(mediumId: string): number {
  const m = ACOUSTIC_MEDIA[mediumId as keyof typeof ACOUSTIC_MEDIA];
  return m ? m.attenuation_dB_per_cm_MHz : 0.5;
}

// ─── GLSL shaders ──────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */`#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = /* glsl */`#version 300 es
precision highp float;
out vec4 fragColor;

// ── Resolution & animation ─────────────────────────────────────────────────
uniform vec2  u_res;          // canvas size in pixels
uniform float u_time;         // seconds since start (drives speckle animation)

// ── Scan parameters ────────────────────────────────────────────────────────
uniform float u_gain;          // 0–100
uniform float u_depth;         // max depth, cm
uniform float u_frequency;     // MHz
uniform float u_focus;         // focus depth, cm
uniform float u_dynamicRange;  // dB (40–80)
uniform int   u_transducer;    // 0=linear 1=convex 2=microconvex
uniform float u_lateralOffset; // cm, transducer lateral shift

// ── Layers (up to 8) ───────────────────────────────────────────────────────
// .x=depthStart(cm) .y=echogenicity(0-1) .z=attenuation(dB/cm/MHz) .w=unused
uniform vec4 u_layer[8];
uniform int  u_numLayers;

// ── Inclusions (up to 6) ───────────────────────────────────────────────────
// .x=lateral(cm) .y=depth(cm) .z=semiW(cm) .w=echogenicity(0-1)
// Extra: semiH packed in u_inclH[i]
uniform vec4  u_incl[6];
uniform float u_inclH[6];     // semi-height in cm
uniform int   u_numIncl;

// ── Feature flags ──────────────────────────────────────────────────────────
uniform int u_showDepthScale;
uniform int u_showFocusMarker;
uniform int u_enableShadow;
uniform int u_enableEnhancement;

// ═══ NOISE ═══════════════════════════════════════════════════════════════════

float h(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth value noise
float sn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1,0)), u.x),
             mix(h(i + vec2(0,1)), h(i + vec2(1,1)), u.x), u.y);
}

// Coherent acoustic speckle: simulates interference of back-scattered waves.
// The time parameter makes it animate slowly (0.1–0.2 Hz visual tempo).
float speckle(vec2 scanPos, float t) {
  // Scale to get the granular speckle texture characteristic of B-mode
  vec2 p = scanPos * vec2(3.2, 2.5);

  float s  = sn(p * 10.0 + vec2( t*0.18,  t*0.09)) * 0.42;
  s       += sn(p * 21.0 + vec2( t*0.13, -t*0.07)) * 0.28;
  s       += sn(p * 43.0 - vec2( t*0.08,  t*0.05)) * 0.16;
  s       += sn(p * 87.0 + vec2( t*0.05,  t*0.03)) * 0.10;
  s       += sn(p *175.0 - vec2( t*0.03,  t*0.02)) * 0.04;

  // Phase modulation (coherent interference pattern — gives the speckle "grain")
  float ph1 = sn(p * 9.1 + vec2(0.3, 0.7)) * 6.2832;
  float ph2 = sn(p * 18.5 + vec2(0.7, 0.2)) * 6.2832;
  s += 0.13 * sin(p.x * 29.0 + ph1 + t * 0.45) * cos(p.y * 23.0 - ph2 + t * 0.31);

  return clamp(s, 0.0, 1.0);
}

// ═══ COORDINATE TRANSFORM ════════════════════════════════════════════════════

// Convert screen UV (0..1, y=0 top) → scan (lateral_cm, depth_cm).
// Returns vec2(999,999) for pixels outside the beam.
vec2 toScan(vec2 uv) {
  const float LATERAL_HALF = 2.5; // ±2.5 cm = 5 cm total linear field

  if (u_transducer == 0) {
    // Linear: simple rectangular mapping
    float lat = (uv.x - 0.5) * (LATERAL_HALF * 2.0) + u_lateralOffset;
    float dep = uv.y * u_depth;
    return vec2(lat, dep);
  }

  // Convex (1) or microconvex (2): fan geometry
  float halfAngle = (u_transducer == 1) ? 0.5236 : 0.4363; // 30° or 25° in radians
  float angle = (uv.x - 0.5) * halfAngle * 2.0;
  float r     = uv.y * u_depth;

  float lat = sin(angle) * r + u_lateralOffset;
  float dep = cos(angle) * r;

  // Clip corners that fall outside the fan wedge
  float fanEdgeAtDep = tan(halfAngle) * dep;
  if (abs(lat - u_lateralOffset) > fanEdgeAtDep + 0.08) return vec2(999.0, 999.0);

  return vec2(lat, dep);
}

// ═══ TISSUE LOOKUP ═══════════════════════════════════════════════════════════

// Returns (echogenicity, attenuation_coeff) for a given scan point.
vec2 tissue(vec2 scan) {
  float echo  = 0.04;  // background acoustic noise
  float atten = 0.50;  // dB/cm/MHz default

  // Layer lookup (sorted by ascending depth)
  for (int i = 0; i < 8; i++) {
    if (i >= u_numLayers) break;
    float ls = u_layer[i].x;
    float le = (i + 1 < u_numLayers) ? u_layer[i + 1].x : u_depth + 100.0;
    if (scan.y >= ls && scan.y < le) {
      echo  = u_layer[i].y;
      atten = u_layer[i].z;
    }
  }

  // Inclusion lookup — override tissue at this point if inside an inclusion
  for (int j = 0; j < 6; j++) {
    if (j >= u_numIncl) break;
    vec2  ctr  = u_incl[j].xy;   // (lateral, depth) in cm
    float semiW = u_incl[j].z;
    float semiH = u_inclH[j];
    float ie   = u_incl[j].w;

    // Ellipse test in scan space
    vec2 d = scan - ctr;
    float t = (d.x * d.x) / (semiW * semiW) + (d.y * d.y) / (semiH * semiH);

    if (t < 1.0) {
      // Soft edge at t in [0.7..1.0]
      float blend = 1.0 - smoothstep(0.70, 1.0, t);
      echo = mix(echo, ie, blend);
    }
  }

  return vec2(echo, atten);
}

// ═══ ATTENUATION ══════════════════════════════════════════════════════════════

// Total two-way attenuation factor at depth (exponential sum over layers).
float atten(float depth) {
  float totalDb = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_numLayers) break;
    float ls = u_layer[i].x;
    float le = (i + 1 < u_numLayers) ? u_layer[i + 1].x : depth + 100.0;
    if (ls >= depth) break;
    float seg = min(le, depth) - max(ls, 0.0);
    if (seg > 0.0) totalDb += u_layer[i].z * seg;
  }
  // Two-way travel (transmit + receive) doubles attenuation
  return pow(10.0, -2.0 * totalDb * u_frequency / 20.0);
}

// ═══ ACOUSTIC SHADOW / POSTERIOR ENHANCEMENT ════════════════════════════════

// Simple column-based shadow calculation: sample echogenicity above current point.
float shadowMod(vec2 scan) {
  if (u_enableShadow == 0 && u_enableEnhancement == 0) return 1.0;
  if (scan.y < 0.5) return 1.0; // no effect near surface

  float maxE = 0.0;
  float sumE = 0.0;
  const int STEPS = 7;
  for (int s = 1; s < 7; s++) {
    float sd  = scan.y * float(s) / float(STEPS);
    vec2 t    = tissue(vec2(scan.x, sd));
    float e   = t.x;
    sumE += e;
    maxE = max(maxE, e);
  }
  float avgE = sumE / float(STEPS - 1);

  float mod = 1.0;

  // Acoustic shadow: very hyperechoic structure above → dark band
  if (u_enableShadow == 1 && maxE > 0.75) {
    mod *= mix(1.0, 0.04, smoothstep(0.75, 0.92, maxE));
  }

  // Posterior enhancement: anechoic region above → brighter distal
  if (u_enableEnhancement == 1 && avgE < 0.08 && scan.y > 1.0) {
    mod *= mix(1.0, 2.0, smoothstep(0.08, 0.01, avgE));
  }

  return mod;
}

// ═══ OVERLAYS ═════════════════════════════════════════════════════════════════

float overlayAlpha(vec2 uv) {
  float a = 0.0;

  // Depth scale: tick marks every 1 cm on right edge
  if (u_showDepthScale == 1) {
    float depCm = uv.y * u_depth;
    float fr = fract(depCm);
    bool isTick = fr < 0.025 || fr > 0.975;
    if (isTick && uv.x > 0.955) a = max(a, 0.65);
    // Half-cm tick (shorter)
    bool isHalfTick = abs(fr - 0.5) < 0.015;
    if (isHalfTick && uv.x > 0.972) a = max(a, 0.45);
  }

  // Focus marker: horizontal dashes on both edges
  if (u_showFocusMarker == 1) {
    float focusUV = clamp(u_focus / u_depth, 0.0, 1.0);
    float dy = abs(uv.y - focusUV);
    if (dy < 0.006 && (uv.x < 0.04 || uv.x > 0.96)) a = max(a, 0.55);
  }

  return a;
}

// ═══ MAIN ════════════════════════════════════════════════════════════════════

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y; // flip: y=0 → near field (top of image)

  vec2 scan = toScan(uv);

  // Out-of-beam pixels → black
  if (scan.x > 900.0 || scan.y < 0.0 || scan.y > u_depth) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // ── Tissue properties at this scan point ──────────────────────────────
  vec2 tv     = tissue(scan);
  float echo  = tv.x;

  // ── Acoustic attenuation (two-way) ────────────────────────────────────
  float attenF = atten(scan.y);

  // ── Speckle (coherent noise, time-animated) ────────────────────────────
  float sp = speckle(scan, u_time);

  // ── Layer boundary (specular reflections at tissue interfaces) ─────────
  float boundary = 0.0;
  for (int i = 1; i < 8; i++) {
    if (i >= u_numLayers) break;
    float bd = u_layer[i].x;
    float dist = abs(scan.y - bd);
    if (dist < 0.18) {
      float prev = u_layer[i - 1].y;
      float curr = u_layer[i].y;
      float rc   = abs(curr - prev) * 0.9;
      boundary   = max(boundary, rc * (1.0 - dist / 0.18) * attenF);
    }
  }

  // ── Focus (lateral beam width → echogenicity falloff away from focus) ──
  float df = abs(scan.y - u_focus);
  float focusGain = 1.0 / (1.0 + df * df * 1.5);
  focusGain = clamp(focusGain, 0.30, 1.0);

  // ── Near-field suppression ─────────────────────────────────────────────
  float nf = smoothstep(0.0, 0.35, scan.y);

  // ── Gain control ──────────────────────────────────────────────────────
  float gainLin = pow(10.0, (u_gain - 50.0) / 40.0);

  // ── Posterior shadow / enhancement ────────────────────────────────────
  float shad = shadowMod(scan);

  // ── Combine ───────────────────────────────────────────────────────────
  // Parenchymal echo modulated by speckle + discrete boundary echo
  float I = (echo * (0.30 + 0.70 * sp) + boundary)
            * attenF * focusGain * gainLin * nf * shad;

  // ── Log (B-mode) compression ──────────────────────────────────────────
  float drLin = pow(10.0, -u_dynamicRange / 20.0);
  I = clamp(I, 0.0, 1.5);
  float logMin = log(drLin);
  float logMax = 0.0; // log(1.0)
  I = clamp((log(max(I, drLin)) - logMin) / (logMax - logMin), 0.0, 1.0);

  // ── Overlay (depth scale, focus marker) ───────────────────────────────
  float ov = overlayAlpha(uv);
  I = mix(I, 0.65, ov);

  fragColor = vec4(I, I, I, 1.0);
}
`;

// ─── Engine class ──────────────────────────────────────────────────────────

export class WebGLUltrasoundEngine {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private ul: Record<string, WebGLUniformLocation | null> = {};
  private animId: number | null = null;
  private isRunning = false;
  private config: UnifiedEngineConfig;
  private startMs: number;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, config: UnifiedEngineConfig) {
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) throw new Error('[WebGLUltrasound] WebGL2 not available');
    this.gl = gl;
    this.config = config;
    this.startMs = performance.now();

    this.prog = this.compile();

    // Fullscreen quad (2 triangles covering NDC space)
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(this.prog);

    // Cache uniform locations
    const names = [
      'u_res', 'u_time', 'u_gain', 'u_depth', 'u_frequency', 'u_focus',
      'u_dynamicRange', 'u_transducer', 'u_lateralOffset',
      'u_numLayers', 'u_numIncl',
      'u_showDepthScale', 'u_showFocusMarker', 'u_enableShadow', 'u_enableEnhancement',
      ...Array.from({ length: 8 }, (_, i) => `u_layer[${i}]`),
      ...Array.from({ length: 6 }, (_, i) => `u_incl[${i}]`),
      ...Array.from({ length: 6 }, (_, i) => `u_inclH[${i}]`),
    ];
    for (const n of names) this.ul[n] = gl.getUniformLocation(this.prog, n);

    // Set canvas resolution (immutable for this engine instance)
    gl.uniform2f(this.ul['u_res']!, canvas.width, canvas.height);

    // Upload initial config
    this.uploadConfig(config);
  }

  // ── Private: compile shaders ──────────────────────────────────────────────

  private compile(): WebGLProgram {
    const gl = this.gl;

    const compileShader = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(s) ?? '';
        gl.deleteShader(s);
        throw new Error(`[WebGLUltrasound] shader compile error:\n${info}`);
      }
      return s;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog) ?? '';
      throw new Error(`[WebGLUltrasound] program link error:\n${info}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  // ── Private: upload UnifiedEngineConfig to shader uniforms ────────────────

  private uploadConfig(c: UnifiedEngineConfig): void {
    const gl = this.gl;
    const u = this.ul;

    gl.uniform1f(u['u_gain']!,         c.gain);
    gl.uniform1f(u['u_depth']!,        c.depth);
    gl.uniform1f(u['u_frequency']!,    c.frequency);
    gl.uniform1f(u['u_focus']!,        Math.min(c.focus, c.depth));
    gl.uniform1f(u['u_dynamicRange']!, c.dynamicRange ?? 60);
    gl.uniform1i(u['u_transducer']!,   c.transducerType === 'linear' ? 0 : c.transducerType === 'convex' ? 1 : 2);
    gl.uniform1f(u['u_lateralOffset']!, c.lateralOffset ?? 0);

    gl.uniform1i(u['u_showDepthScale']!,    c.showDepthScale    ? 1 : 0);
    gl.uniform1i(u['u_showFocusMarker']!,   c.showFocusMarker   ? 1 : 0);
    gl.uniform1i(u['u_enableShadow']!,      c.enableAcousticShadow       ? 1 : 0);
    gl.uniform1i(u['u_enableEnhancement']!, c.enablePosteriorEnhancement ? 1 : 0);

    // ── Layers ───────────────────────────────────────────────────────────
    const layers = c.acousticLayers ?? [];
    const numLayers = Math.min(layers.length, 8);
    gl.uniform1i(u['u_numLayers']!, numLayers);

    let cumDepth = 0;
    for (let i = 0; i < 8; i++) {
      const loc = u[`u_layer[${i}]`];
      if (!loc) continue;
      if (i < numLayers) {
        const l = layers[i];
        const echo  = echoForMedium(l.mediumId);
        const attenC = attenForMedium(l.mediumId);
        // Apply optional fine-tuning biases from lab config
        const echoAdj = echo + (l.reflectivityBias ?? 0) * 0.3;
        gl.uniform4f(loc, cumDepth, Math.max(0, Math.min(1, echoAdj)), attenC, 0);
        cumDepth += l.thicknessCm;
      } else {
        gl.uniform4f(loc, 0, 0, 0, 0);
      }
    }

    // ── Inclusions ────────────────────────────────────────────────────────
    const inclusions = c.inclusions ?? [];
    const numIncl = Math.min(inclusions.length, 6);
    gl.uniform1i(u['u_numIncl']!, numIncl);

    for (let i = 0; i < 6; i++) {
      const locI = u[`u_incl[${i}]`];
      const locH = u[`u_inclH[${i}]`];
      if (!locI || !locH) continue;
      if (i < numIncl) {
        const inc = inclusions[i];
        // centerLateralPos is normalised -0.5..+0.5; engine multiplies by 2.5 → cm
        const latCm   = (inc.centerLateralPos ?? 0) * 2.5;
        const depCm   = inc.centerDepthCm;
        const semiW   = (inc.sizeCm?.width  ?? 1) / 2;
        const semiH   = (inc.sizeCm?.height ?? 1) / 2;
        const ie      = echoForMedium(inc.mediumInsideId);
        gl.uniform4f(locI, latCm, depCm, semiW, ie);
        gl.uniform1f(locH, semiH);
      } else {
        gl.uniform4f(locI, 0, 0, 0, 0);
        gl.uniform1f(locH, 0);
      }
    }
  }

  // ── Private: draw one frame ────────────────────────────────────────────────

  private drawFrame(timeS: number): void {
    const gl = this.gl;
    gl.uniform1f(this.ul['u_time']!, timeS);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Public API (same shape as UnifiedUltrasoundEngine) ────────────────────

  updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    this.gl.useProgram(this.prog);
    this.uploadConfig(this.config);
    // If not running, paint the updated frame immediately so the image isn't stale.
    if (!this.isRunning) {
      this.drawFrame((performance.now() - this.startMs) / 1000);
    }
  }

  /** Render a single frame at the given timestamp (ms). Used for static mode. */
  renderFrameAt(timeMs: number): void {
    this.gl.useProgram(this.prog);
    this.drawFrame(timeMs / 1000);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = (now: number) => {
      if (!this.isRunning) return;
      this.gl.useProgram(this.prog);
      this.drawFrame((now - this.startMs) / 1000);
      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animId != null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  destroy(): void {
    this.stop();
    try {
      this.gl.deleteProgram(this.prog);
    } catch {
      // ignore
    }
  }
}

/**
 * Try to create a WebGLUltrasoundEngine; return null if WebGL2 is unavailable.
 */
export function tryCreateWebGLEngine(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  config: UnifiedEngineConfig,
): WebGLUltrasoundEngine | null {
  try {
    return new WebGLUltrasoundEngine(canvas, config);
  } catch (e) {
    console.warn('[WebGLUltrasound] falling back to JS engine:', e);
    return null;
  }
}
