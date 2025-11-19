/**
 * WebGL-based Ultrasound Rendering Engine
 * Uses ray marching for physically-based ultrasound simulation
 */

import { UltrasoundLabConfigAdvanced, AnatomyLayer } from '@/types/ultrasoundAdvanced';
import { UltrasoundInclusionConfig } from '@/types/acousticMedia';

export interface UltrasoundEngineConfig {
  // Anatomy and physics
  layers: AnatomyLayer[];
  inclusions: UltrasoundInclusionConfig[];
  
  // Transducer and imaging
  transducerType: 'linear' | 'convex' | 'microconvex';
  frequency: number; // MHz
  depth: number; // cm
  focus: number; // cm
  gain: number; // 0-100
  dynamicRange: number; // dB
  
  // Imaging mode
  mode: 'b-mode' | 'color-doppler';
  
  // Simulation features
  features: {
    showStructuralBMode: boolean;
    showBeamOverlay: boolean;
    showDepthScale: boolean;
    showFocusMarker: boolean;
    showPhysicsPanel: boolean;
    enablePosteriorEnhancement: boolean;
    enableAcousticShadow: boolean;
    enableReverberation: boolean;
    enableNearFieldClutter: boolean;
    showFieldLines: boolean;
    showAttenuationMap: boolean;
    enableColorDoppler: boolean;
    showAnatomyLabels: boolean;
  };
  
  // Animation
  time: number;
}

interface RayMarchResult {
  intensity: number;
  depth: number;
  mediumId: string;
  reflections: number;
  attenuation: number;
}

export class UltrasoundEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private config: UltrasoundEngineConfig;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  
  // WebGL resources
  private program: WebGLProgram | null = null;
  private frameBuffer: ImageData | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  
  // Performance
  private lastFrameTime: number = 0;
  private targetFPS: number = 30;
  
  constructor(canvas: HTMLCanvasElement, config: UltrasoundEngineConfig) {
    this.canvas = canvas;
    this.config = config;
    this.initialize();
  }
  
  /**
   * Initialize WebGL context and shaders
   */
  private initialize(): void {
    // Try WebGL2 first, fallback to WebGL1, then 2D canvas
    this.gl = this.canvas.getContext('webgl2') || 
              this.canvas.getContext('webgl') ||
              null;
    
    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D canvas');
      this.ctx2d = this.canvas.getContext('2d');
      if (!this.ctx2d) {
        throw new Error('Cannot get 2D context');
      }
      return;
    }
    
    // Initialize WebGL shaders and programs
    this.initializeShaders();
  }
  
  /**
   * Initialize WebGL shaders for ray marching
   */
  private initializeShaders(): void {
    if (!this.gl) return;
    
    const vertexShaderSource = `
      attribute vec2 position;
      varying vec2 vUV;
      void main() {
        vUV = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 vUV;
      uniform float time;
      uniform float gain;
      uniform float depth;
      uniform float frequency;
      uniform float focus;
      uniform int transducerType; // 0=linear, 1=convex, 2=microconvex
      
      // Ray marching parameters
      const int MAX_STEPS = 64;
      const float STEP_SIZE = 0.05;
      
      // Noise function for speckle
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Multi-octave noise for realistic speckle
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      // Rayleigh distribution for speckle amplitude
      float rayleigh(float x, float sigma) {
        return (x / (sigma * sigma)) * exp(-(x * x) / (2.0 * sigma * sigma));
      }
      
      // Ray marching through acoustic volume
      vec3 raymarch(vec2 uv, float t) {
        // Convert UV to ray direction based on transducer type
        vec2 origin = vec2(0.5, 0.0);
        vec2 direction;
        
        if (transducerType == 0) {
          // Linear: parallel rays
          direction = vec2(uv.x - 0.5, 1.0);
        } else if (transducerType == 1) {
          // Convex: fan from center
          float angle = (uv.x - 0.5) * 0.8;
          direction = vec2(sin(angle), cos(angle));
        } else {
          // Microconvex: narrow fan
          float angle = (uv.x - 0.5) * 0.5;
          direction = vec2(sin(angle), cos(angle));
        }
        
        direction = normalize(direction);
        
        float totalIntensity = 0.0;
        float currentDepth = 0.0;
        vec2 pos = origin;
        
      // Ray marching loop
        for (int step = 0; step < MAX_STEPS; step++) {
          pos += direction * STEP_SIZE;
          currentDepth = length(pos - origin) * depth;
          
          if (currentDepth > depth || pos.y > 1.0 || pos.x < 0.0 || pos.x > 1.0) {
            break;
          }
          
          // Frequency-dependent attenuation
          float attenuation = exp(-frequency * 0.5 * currentDepth);
          
          // Focal zone enhancement
          float focalFactor = 1.0 - abs(currentDepth - focus) / focus;
          focalFactor = max(0.0, focalFactor);
          
          // Base tissue reflectivity
          float layerReflectivity = 0.3 + 0.2 * sin(currentDepth * 3.0);
          
          // Speckle noise with Rayleigh distribution
          vec2 noiseCoord = pos * 50.0 + vec2(time * 0.1, 0.0);
          float speckle = fbm(noiseCoord);
          speckle = rayleigh(speckle, 0.4);
          
          // Combine factors
          float intensity = layerReflectivity * attenuation * (1.0 + focalFactor * 0.3) * speckle;
          totalIntensity += intensity * gain * 0.01;
        }
        
        // Normalize and apply gain
        totalIntensity = clamp(totalIntensity * 2.0, 0.0, 1.0);
        
        return vec3(totalIntensity);
      }
      
      void main() {
        vec3 color = raymarch(vUV, time);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile shaders');
      return;
    }
    
    this.program = this.gl.createProgram();
    if (!this.program) return;
    
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Failed to link program:', this.gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Create full-screen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    
    const positionLocation = this.gl.getAttribLocation(this.program, 'position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
  }
  
  private compileShader(source: string, type: number): WebGLShader | null {
    if (!this.gl) return null;
    
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  /**
   * Update configuration and trigger re-render
   */
  public updateConfig(newConfig: Partial<UltrasoundEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Render a single frame
   */
  public renderFrame(): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    
    // Throttle to target FPS
    if (deltaTime < 1000 / this.targetFPS) {
      return;
    }
    
    this.lastFrameTime = now;
    
    if (this.gl && this.program) {
      this.renderWebGL();
    } else if (this.ctx2d) {
      this.renderCanvas2D();
    }
  }
  
  /**
   * WebGL rendering path
   */
  private renderWebGL(): void {
    if (!this.gl || !this.program) return;
    
    this.gl.useProgram(this.program);
    
    // Set uniforms
    const timeLocation = this.gl.getUniformLocation(this.program, 'time');
    const gainLocation = this.gl.getUniformLocation(this.program, 'gain');
    const depthLocation = this.gl.getUniformLocation(this.program, 'depth');
    const frequencyLocation = this.gl.getUniformLocation(this.program, 'frequency');
    const focusLocation = this.gl.getUniformLocation(this.program, 'focus');
    const transducerTypeLocation = this.gl.getUniformLocation(this.program, 'transducerType');
    
    this.gl.uniform1f(timeLocation, this.config.time);
    this.gl.uniform1f(gainLocation, this.config.gain);
    this.gl.uniform1f(depthLocation, this.config.depth);
    this.gl.uniform1f(frequencyLocation, this.config.frequency);
    this.gl.uniform1f(focusLocation, this.config.focus);
    
    const transducerTypeValue = 
      this.config.transducerType === 'linear' ? 0 :
      this.config.transducerType === 'convex' ? 1 : 2;
    this.gl.uniform1i(transducerTypeLocation, transducerTypeValue);
    
    // Clear and draw
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Draw overlays if enabled
    this.drawOverlays();
  }
  
  /**
   * Canvas 2D fallback rendering path with Doppler support
   */
  private renderCanvas2D(): void {
    if (!this.ctx2d) return;
    
    const { width, height } = this.canvas;
    
    if (!this.frameBuffer || this.frameBuffer.width !== width || this.frameBuffer.height !== height) {
      this.frameBuffer = this.ctx2d.createImageData(width, height);
    }
    
    const data = this.frameBuffer.data;
    
    // Render B-mode base image
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const uv = { x: x / width, y: y / height };
        const result = this.raymarchSoftware(uv);
        
        const idx = (y * width + x) * 4;
        const intensity = Math.floor(result.intensity * 255);
        data[idx] = intensity;
        data[idx + 1] = intensity;
        data[idx + 2] = intensity;
        data[idx + 3] = 255;
      }
    }
    
    this.ctx2d.putImageData(this.frameBuffer, 0, 0);
    
    // Render Doppler overlay if enabled
    if (this.config.mode === 'color-doppler' && this.config.features.enableColorDoppler) {
      this.renderDopplerOverlay();
    }
    
    this.drawOverlays();
  }
  
  /**
   * Render Color Doppler overlay on top of B-mode
   */
  private renderDopplerOverlay(): void {
    if (!this.ctx2d) return;
    
    const { width, height } = this.canvas;
    
    // Find all vessel inclusions
    const vessels = this.config.inclusions.filter(inc => inc.type === 'vessel');
    if (vessels.length === 0) return;
    
    // Create Doppler overlay
    for (const vessel of vessels) {
      this.ctx2d.save();
      
      // Convert vessel position to screen coords
      const centerX = ((vessel.centerLateralPos + 1) / 2) * width;
      const centerY = (vessel.centerDepthCm / this.config.depth) * height;
      const radiusX = (vessel.sizeCm.width / 2 / this.config.depth) * height;
      const radiusY = (vessel.sizeCm.height / 2 / this.config.depth) * height;
      
      // Draw flow field inside vessel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const uv = { x: x / width, y: y / height };
          const depth = uv.y * this.config.depth;
          const lateralPos = (uv.x - 0.5) * 2;
          
          // Check if inside vessel
          const dx = (lateralPos - vessel.centerLateralPos) / (vessel.sizeCm.width / 2);
          const dy = (depth - vessel.centerDepthCm) / (vessel.sizeCm.height / 2);
          const inVessel = dx * dx + dy * dy <= 1;
          
          if (inVessel) {
            // Calculate laminar flow velocity (parabolic profile)
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            const velocity = (1 - distFromCenter * distFromCenter) * 0.5; // Max 0.5 m/s
            
            // Add temporal variation
            const flowPhase = this.config.time * 2 + lateralPos * 3;
            const velocityWithPulse = velocity * (1 + 0.2 * Math.sin(flowPhase));
            
            // Color mapping: red = toward probe, blue = away
            const flowDirection = Math.sin(lateralPos * Math.PI); // Varies by position
            const colorVelocity = velocityWithPulse * flowDirection;
            
            // Map to color
            let r = 0, g = 0, b = 0;
            if (colorVelocity > 0) {
              // Flow toward probe (red)
              r = Math.floor(Math.min(255, colorVelocity * 512));
              g = 0;
              b = 0;
            } else {
              // Flow away from probe (blue)
              r = 0;
              g = 0;
              b = Math.floor(Math.min(255, -colorVelocity * 512));
            }
            
            // Add noise for realism
            const noise = this.noise2D(x * 0.1, y * 0.1 + this.config.time);
            const alpha = Math.max(0.3, 0.6 + noise * 0.2);
            
            // Blend with B-mode
            this.ctx2d.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            this.ctx2d.fillRect(x, y, 1, 1);
          }
        }
      }
      
      this.ctx2d.restore();
    }
  }
  
  /**
   * Software ray marching (fallback) with inclusion and Doppler support
   */
  private raymarchSoftware(uv: { x: number; y: number }): RayMarchResult {
    const depth = uv.y * this.config.depth;
    const lateralPos = (uv.x - 0.5) * 2; // -1 to 1
    
    // Check if inside any inclusion
    const inclusion = this.getInclusionAtPoint(lateralPos, depth);
    
    // Base tissue properties
    let baseReflectivity = 0.3;
    let attenuation = Math.exp(-this.config.frequency * 0.5 * depth);
    let speckle = this.noise2D(uv.x * 50, uv.y * 50 + this.config.time * 0.1);
    
    // Apply inclusion effects
    if (inclusion) {
      const effects = this.calculateInclusionEffects(inclusion, lateralPos, depth, uv);
      baseReflectivity = effects.reflectivity;
      attenuation *= effects.attenuationMod;
      speckle *= effects.speckleMod;
    }
    
    // Check for acoustic shadow from inclusions above
    const shadowFactor = this.calculateAcousticShadow(lateralPos, depth);
    attenuation *= shadowFactor;
    
    // Check for posterior enhancement from inclusions above
    const enhancementFactor = this.calculatePosteriorEnhancement(lateralPos, depth);
    
    // Focal zone enhancement
    const focalFactor = 1.0 - Math.abs(depth - this.config.focus) / this.config.focus;
    const focalGain = Math.max(0, focalFactor) * 0.3 + 1.0;
    
    let intensity = baseReflectivity * attenuation * speckle * this.config.gain * 0.01 * focalGain * enhancementFactor;
    
    return {
      intensity: Math.min(Math.max(intensity, 0), 1.0),
      depth,
      mediumId: inclusion?.mediumInsideId || 'muscle',
      reflections: 0,
      attenuation,
    };
  }
  
  private getInclusionAtPoint(lateralPos: number, depth: number): UltrasoundInclusionConfig | null {
    for (const inc of this.config.inclusions) {
      const inLateral = Math.abs(lateralPos - inc.centerLateralPos) <= inc.sizeCm.width / 2;
      const inDepth = Math.abs(depth - inc.centerDepthCm) <= inc.sizeCm.height / 2;
      
      if (inc.shape === 'circle') {
        const dx = lateralPos - inc.centerLateralPos;
        const dy = depth - inc.centerDepthCm;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= inc.sizeCm.width / 2) return inc;
      } else if (inc.shape === 'ellipse') {
        const dx = (lateralPos - inc.centerLateralPos) / (inc.sizeCm.width / 2);
        const dy = (depth - inc.centerDepthCm) / (inc.sizeCm.height / 2);
        if (dx * dx + dy * dy <= 1) return inc;
      } else if (inc.shape === 'rectangle') {
        if (inLateral && inDepth) return inc;
      }
    }
    return null;
  }
  
  private calculateInclusionEffects(
    inclusion: UltrasoundInclusionConfig,
    lateralPos: number,
    depth: number,
    uv: { x: number; y: number }
  ) {
    let reflectivity = 0.3;
    let attenuationMod = 1.0;
    let speckleMod = 1.0;
    
    // Distance to center
    const dx = lateralPos - inclusion.centerLateralPos;
    const dy = depth - inclusion.centerDepthCm;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = Math.max(inclusion.sizeCm.width, inclusion.sizeCm.height) / 2;
    const edgeDist = maxRadius - distToCenter;
    const isNearEdge = edgeDist < 0.1; // within 1mm of edge
    
    switch (inclusion.type) {
      case 'cyst':
        // Anechoic interior - muito escuro
        reflectivity = 0.02;
        speckleMod = 0.05;
        // Bright border
        if (isNearEdge && inclusion.borderEchogenicity === 'sharp') {
          reflectivity = 0.95;
          speckleMod = 2.0;
        }
        break;
        
      case 'vessel':
        // Anechoic lumen - muito escuro
        reflectivity = 0.01;
        speckleMod = 0.02;
        // Thin hyperechoic wall - bem brilhante
        if (isNearEdge) {
          reflectivity = 0.9;
          speckleMod = 1.8;
        }
        break;
        
      case 'bone_surface':
      case 'calcification':
        // Very bright interface - máximo brilho
        reflectivity = 1.5;
        speckleMod = 3.0;
        attenuationMod = 0.05; // Strong attenuation inside
        break;
        
      case 'solid_mass':
        // Hypoechoic or hyperechoic depending on medium
        reflectivity = 0.5;
        speckleMod = 1.0;
        break;
        
      case 'heterogeneous_lesion':
        // Variable echogenicity - maior contraste
        const heteroNoise = this.noise2D(uv.x * 100, uv.y * 100);
        reflectivity = 0.2 + heteroNoise * 0.5;
        speckleMod = 0.6 + heteroNoise * 0.8;
        break;
    }
    
    return { reflectivity, attenuationMod, speckleMod };
  }
  
  private calculateAcousticShadow(lateralPos: number, depth: number): number {
    if (!this.config.features.enableAcousticShadow) return 1.0;
    
    let shadowFactor = 1.0;
    
    for (const inc of this.config.inclusions) {
      if (!inc.hasStrongShadow) continue;
      if (depth <= inc.centerDepthCm) continue; // Only shadow below inclusion
      
      // Check if in shadow column - sombra mais forte e mais visível
      const inShadowColumn = Math.abs(lateralPos - inc.centerLateralPos) <= inc.sizeCm.width / 2;
      if (inShadowColumn) {
        const depthBelowInc = depth - (inc.centerDepthCm + inc.sizeCm.height / 2);
        const shadowStrength = Math.exp(-depthBelowInc * 1.0); // Decaimento mais lento
        shadowFactor *= Math.max(0.05, 1.0 - shadowStrength * 0.95); // Sombra mais escura
      }
    }
    
    return shadowFactor;
  }
  
  private calculatePosteriorEnhancement(lateralPos: number, depth: number): number {
    if (!this.config.features.enablePosteriorEnhancement) return 1.0;
    
    let enhancement = 1.0;
    
    for (const inc of this.config.inclusions) {
      if (!inc.posteriorEnhancement) continue;
      if (depth <= inc.centerDepthCm) continue; // Only enhance below inclusion
      
      // Check if in enhancement column - reforço mais visível
      const inEnhancementColumn = Math.abs(lateralPos - inc.centerLateralPos) <= inc.sizeCm.width / 2;
      if (inEnhancementColumn) {
        const depthBelowInc = depth - (inc.centerDepthCm + inc.sizeCm.height / 2);
        // Gradual enhancement that fades with distance - mais intenso
        const enhancementStrength = Math.exp(-depthBelowInc * 1.0);
        enhancement *= 1.0 + enhancementStrength * 0.8; // Up to +80% gain - mais visível
      }
    }
    
    return enhancement;
  }
  
  private noise2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }
  
  /**
   * Draw overlays (depth scale, beam, labels, etc.)
   */
  private drawOverlays(): void {
    const ctx = this.ctx2d || this.canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = this.canvas;
    const { features } = this.config;
    
    ctx.save();
    
    // Depth scale
    if (features.showDepthScale) {
      this.drawDepthScale(ctx, width, height);
    }
    
    // Focus marker
    if (features.showFocusMarker) {
      this.drawFocusMarker(ctx, width, height);
    }
    
    // Beam overlay
    if (features.showBeamOverlay) {
      this.drawBeamOverlay(ctx, width, height);
    }
    
    // Anatomy labels
    if (features.showAnatomyLabels) {
      this.drawAnatomyLabels(ctx, width, height);
    }
    
    // Field lines
    if (features.showFieldLines) {
      this.drawFieldLines(ctx, width, height);
    }
    
    ctx.restore();
  }
  
  private drawDepthScale(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    
    const steps = Math.ceil(this.config.depth);
    for (let i = 0; i <= steps; i++) {
      const y = (i / this.config.depth) * height;
      ctx.beginPath();
      ctx.moveTo(width - 30, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
      ctx.fillText(`${i}`, width - 18, y + 4);
    }
  }
  
  private drawFocusMarker(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const y = (this.config.focus / this.config.depth) * height;
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.moveTo(width - 25, y);
    ctx.lineTo(width - 30, y - 5);
    ctx.lineTo(width - 30, y + 5);
    ctx.fill();
  }
  
  private drawBeamOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    const centerX = width / 2;
    
    if (this.config.transducerType === 'linear') {
      // Parallel beam lines
      for (let i = -2; i <= 2; i++) {
        const x = centerX + (i * width / 10);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    } else {
      // Fan beam lines
      const angle = this.config.transducerType === 'convex' ? 0.8 : 0.5;
      for (let i = -2; i <= 2; i++) {
        const a = (i / 2) * angle;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX + Math.sin(a) * height, height);
        ctx.stroke();
      }
    }
  }
  
  private drawAnatomyLabels(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    
    // Simplified - would read from actual layers
    const labels = [
      { text: 'Pele', y: 0.1 },
      { text: 'Gordura', y: 0.25 },
      { text: 'Músculo', y: 0.5 },
    ];
    
    labels.forEach(label => {
      ctx.fillText(label.text, 10, label.y * height);
    });
  }
  
  private drawFieldLines(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.15)';
    ctx.lineWidth = 1;
    
    // Draw concentric arcs representing wave propagation
    for (let i = 1; i <= 10; i++) {
      const radius = (i / 10) * height;
      ctx.beginPath();
      ctx.arc(width / 2, 0, radius, 0, Math.PI);
      ctx.stroke();
    }
  }
  
  /**
   * Start continuous rendering
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }
  
  /**
   * Stop rendering
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Animation loop
   */
  private animate = (): void => {
    if (!this.isRunning) return;
    
    this.config.time += 0.016; // ~60fps time increment
    this.renderFrame();
    
    this.animationFrameId = requestAnimationFrame(this.animate);
  };
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    
    this.gl = null;
    this.ctx2d = null;
    this.frameBuffer = null;
  }
}
