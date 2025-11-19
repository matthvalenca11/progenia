import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as THREE from "three";

// Fragment shader for realistic ultrasound rendering
const ultrasoundShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uGain;
    uniform float uFocus;
    uniform float uFrequency;
    uniform float uDepth;
    uniform float uDynamicRange;
    uniform int uTransducerType; // 0=linear, 1=curved, 2=phased
    uniform int uMode; // 0=B-mode, 1=M-mode, 2=Doppler
    uniform vec2 uResolution;
    uniform float uTGC[8];
    
    varying vec2 vUv;
    
    // Simplex noise function for speckle
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187,
                          0.366025403784439,
                         -0.577350269189626,
                          0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    // Multi-octave noise for speckle texture
    float speckleNoise(vec2 uv, float time) {
      float n = 0.0;
      float freq = 1.0;
      float amp = 1.0;
      
      for(int i = 0; i < 4; i++) {
        n += snoise(uv * freq * 50.0 + time * 0.05) * amp;
        freq *= 2.0;
        amp *= 0.5;
      }
      
      return n * 0.5 + 0.5;
    }
    
    // Fine-grained speckle
    float microSpeckle(vec2 uv, float time) {
      return snoise(uv * 200.0 * uFrequency + time * 0.1) * 0.5 + 0.5;
    }
    
    // Depth attenuation with frequency dependence
    float depthAttenuation(float depth, float freq) {
      float alpha = 0.5 * freq; // dB/cm/MHz
      return exp(-alpha * depth * 0.8);
    }
    
    // Beam profile - Gaussian in lateral direction
    float beamProfile(vec2 pos, float depth, float focus) {
      float lateralPos = abs(pos.x - 0.5) * 2.0;
      float nearFieldLength = 0.3 / uFrequency;
      float beamWidth = 0.05 + abs(depth - focus) * 0.15;
      return exp(-lateralPos * lateralPos / (beamWidth * beamWidth));
    }
    
    // Focal zone enhancement
    float focalGain(float depth, float focus) {
      float focusWidth = 0.15;
      float dist = abs(depth - focus);
      return 1.0 + 0.4 * exp(-dist * dist / (focusWidth * focusWidth));
    }
    
    // Time Gain Compensation
    float applyTGC(float depth) {
      int idx = int(depth * 8.0);
      idx = clamp(idx, 0, 7);
      return uTGC[idx];
    }
    
    // Anatomical layers with different echogenicity
    float anatomyLayers(vec2 pos, float time) {
      float depth = pos.y;
      float lateral = pos.x;
      float intensity = 0.0;
      
      // Skin layer (0.0 - 0.12) - hyperechoic
      if(depth < 0.12) {
        float skinNoise = snoise(vec2(lateral * 100.0, depth * 200.0 + time * 0.02));
        intensity = 0.85 + skinNoise * 0.15;
      }
      // Fat layer (0.12 - 0.25) - hypoechoic
      else if(depth < 0.25) {
        float fatNoise = snoise(vec2(lateral * 60.0, depth * 150.0 + time * 0.01));
        intensity = 0.25 + fatNoise * 0.15;
      }
      // Fascia (0.25 - 0.28) - hyperechoic
      else if(depth < 0.28) {
        float fasciaSharp = snoise(vec2(lateral * 200.0, depth * 500.0));
        intensity = 0.9 + fasciaSharp * 0.1;
      }
      // Muscle layer (0.28 - 1.0) - medium echogenicity with striations
      else {
        // Muscle fiber orientation
        float striation = sin((lateral + depth * 0.3) * 80.0 + time * 0.05) * 0.5 + 0.5;
        float muscleBase = 0.45 + striation * 0.15;
        
        // Add fibrous texture
        float fiberNoise = snoise(vec2(lateral * 120.0, depth * 100.0 + time * 0.03));
        intensity = muscleBase + fiberNoise * 0.12;
        
        // Random bright reflectors (blood vessels, connective tissue)
        float reflector1 = smoothstep(0.02, 0.0, length(pos - vec2(0.35, 0.55)));
        float reflector2 = smoothstep(0.025, 0.0, length(pos - vec2(0.65, 0.70)));
        intensity += (reflector1 + reflector2) * 0.4;
      }
      
      return intensity;
    }
    
    void main() {
      vec2 uv = vUv;
      float depth = uv.y;
      
      // Base anatomical structure
      float anatomy = anatomyLayers(uv, uTime);
      
      // Depth attenuation
      float attenuation = depthAttenuation(depth, uFrequency);
      
      // Beam profile (lateral falloff)
      float beam = beamProfile(uv, depth, uFocus);
      
      // Focal zone enhancement
      float focus = focalGain(depth, uFocus);
      
      // TGC application
      float tgc = applyTGC(depth);
      
      // Multi-scale speckle
      float speckle = speckleNoise(uv, uTime);
      float microSpec = microSpeckle(uv, uTime);
      float combinedSpeckle = mix(speckle, microSpec, 0.6);
      
      // Combine all components
      float intensity = anatomy * attenuation * beam * focus * combinedSpeckle * tgc;
      
      // Apply gain (with compression to avoid clipping)
      intensity = intensity * uGain;
      intensity = intensity / (1.0 + intensity * 0.3); // soft compression
      
      // Add subtle motion/jitter
      float jitter = snoise(uv * 500.0 + uTime * 2.0) * 0.02;
      intensity += jitter;
      
      // Add scan line artifacts
      float scanLines = sin(uv.y * 800.0) * 0.01;
      intensity += scanLines;
      
      // Clamp and apply grayscale ultrasound palette
      intensity = clamp(intensity, 0.0, 1.0);
      
      // Ultrasound-style grayscale with slight blue tint
      vec3 color = vec3(intensity * 0.95, intensity, intensity * 1.05);
      
      // Add slight vignette at edges
      float vignette = 1.0 - length(uv - 0.5) * 0.4;
      color *= vignette;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// Ultrasound display component using WebGL shader
function UltrasoundDisplay({ 
  gain, 
  focus, 
  frequency, 
  depth,
  dynamicRange,
  transducerType,
  mode,
  tgc
}: { 
  gain: number; 
  focus: number; 
  frequency: number;
  depth: number;
  dynamicRange: number;
  transducerType: number;
  mode: number;
  tgc: number[];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGain: { value: gain },
      uFocus: { value: focus },
      uFrequency: { value: frequency },
      uDepth: { value: depth },
      uDynamicRange: { value: dynamicRange },
      uTransducerType: { value: transducerType },
      uMode: { value: mode },
      uTGC: { value: tgc },
      uResolution: { value: new THREE.Vector2(512, 512) }
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uGain.value = gain;
      material.uniforms.uFocus.value = focus;
      material.uniforms.uFrequency.value = frequency;
      material.uniforms.uDepth.value = depth;
      material.uniforms.uDynamicRange.value = dynamicRange;
      material.uniforms.uTransducerType.value = transducerType;
      material.uniforms.uMode.value = mode;
      material.uniforms.uTGC.value = tgc;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[4, 4]} />
      <shaderMaterial
        attach="material"
        args={[{
          vertexShader: ultrasoundShader.vertexShader,
          fragmentShader: ultrasoundShader.fragmentShader,
          uniforms: uniforms
        }]}
      />
    </mesh>
  );
}

const UltrasoundFullSimulator = () => {
  const [gainPercent, setGainPercent] = useState(60);
  const [focusPercent, setFocusPercent] = useState(50);
  const [freqPercent, setFreqPercent] = useState(50);
  const [depthPercent, setDepthPercent] = useState(70);
  const [dynamicRange, setDynamicRange] = useState(60);
  const [transducerType, setTransducerType] = useState("linear");
  const [imagingMode, setImagingMode] = useState("b-mode");
  const [frozen, setFrozen] = useState(false);
  const [tgcSliders, setTgcSliders] = useState([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]);

  // Map to physical parameters
  const intensity = 0.1 + (gainPercent / 100) * 2.4; // 0.1-2.5 W/cm²
  const focusDepthCm = 1 + (focusPercent / 100) * 4; // 1-5 cm
  const frequencyMHz = 1 + (freqPercent / 100) * 2; // 1-3 MHz
  const maxDepthCm = 2 + (depthPercent / 100) * 8; // 2-10 cm

  // Shader parameters (normalized 0-1)
  const shaderGain = 0.3 + (gainPercent / 100) * 1.2;
  const shaderFocus = focusPercent / 100;
  const shaderFreq = 0.5 + (freqPercent / 100) * 1.5;
  const shaderDepth = depthPercent / 100;

  // Transducer type mapping
  const transducerTypeMap: { [key: string]: number } = {
    "linear": 0,
    "curved": 1,
    "phased": 2
  };

  // Imaging mode mapping
  const modeMap: { [key: string]: number } = {
    "b-mode": 0,
    "m-mode": 1,
    "doppler": 2
  };

  // Dose calculations
  const eraCm2 = 5;
  const timeSec = 300;
  const powerW = intensity * eraCm2;
  const energyJ = powerW * timeSec;
  const doseJcm2 = intensity * timeSec;

  let doseLabel = "Dose baixa (< 5 J/cm²)";
  if (doseJcm2 >= 5 && doseJcm2 <= 20) doseLabel = "Dose moderada (5–20 J/cm²)";
  if (doseJcm2 > 20) doseLabel = "Dose alta (> 20 J/cm²)";

  const handleTgcChange = (index: number, value: number) => {
    const newTgc = [...tgcSliders];
    newTgc[index] = value / 100;
    setTgcSliders(newTgc);
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">
          Laboratório Virtual – Simulador de Ultrassom Realístico
        </h2>
        <p className="text-sm text-muted-foreground">
          Simulador avançado com renderização procedural realista usando shaders WebGL.
          Observe speckle noise, atenuação por profundidade, zona focal e camadas anatômicas.
        </p>
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-8">
        {/* ULTRASOUND DISPLAY */}
        <div className="space-y-4">
          <Card className="relative h-[500px] w-full overflow-hidden rounded-lg bg-black border border-slate-700">
            <Canvas
              camera={{ position: [0, 0, 5], fov: 50 }}
              style={{ width: "100%", height: "100%" }}
            >
              <UltrasoundDisplay
                gain={shaderGain}
                focus={shaderFocus}
                frequency={shaderFreq}
                depth={shaderDepth}
                dynamicRange={dynamicRange / 100}
                transducerType={transducerTypeMap[transducerType]}
                mode={modeMap[imagingMode]}
                tgc={tgcSliders}
              />
            </Canvas>

            {/* Overlay info */}
            <div className="absolute top-2 left-2 text-[10px] font-mono text-green-400 bg-black/60 px-2 py-1 rounded">
              {frequencyMHz.toFixed(1)} MHz | GAIN {gainPercent}% | FOCUS {focusDepthCm.toFixed(1)}cm | DEPTH {maxDepthCm.toFixed(1)}cm
            </div>

            {/* Depth markers */}
            <div className="absolute right-2 top-4 bottom-4 flex flex-col justify-between text-[9px] font-mono text-green-400/70">
              {Array.from({ length: Math.ceil(maxDepthCm) + 1 }, (_, i) => i).map((d) => (
                <div key={d} className="flex items-center gap-1">
                  <div className="w-2 h-[1px] bg-green-400/50" />
                  <span>{d}cm</span>
                </div>
              ))}
            </div>

            {/* Freeze button */}
            <Button
              size="sm"
              variant="outline"
              className="absolute bottom-2 left-2 text-xs"
              onClick={() => setFrozen(!frozen)}
            >
              {frozen ? "▶ Resume" : "⏸ Freeze"}
            </Button>
          </Card>

          {/* Numeric display */}
          <Card className="p-4 bg-slate-900 border-slate-700">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Potência:</span>
                <span className="ml-2 font-mono text-green-400">{powerW.toFixed(2)} W</span>
              </div>
              <div>
                <span className="text-slate-400">Energia (5min):</span>
                <span className="ml-2 font-mono text-green-400">{energyJ.toFixed(0)} J</span>
              </div>
              <div>
                <span className="text-slate-400">Dose:</span>
                <span className="ml-2 font-mono text-green-400">{doseJcm2.toFixed(1)} J/cm²</span>
              </div>
              <div>
                <span className="text-slate-400">Classificação:</span>
                <span className="ml-2 font-mono text-amber-400">{doseLabel}</span>
              </div>
            </div>
          </Card>

          <Card className="p-3 bg-slate-900/50 border-slate-700">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-green-400">Visualização procedural realística:</strong> Esta
              imagem é gerada em tempo real usando shaders WebGL que simulam física de ultrassom,
              incluindo speckle noise granular, atenuação exponencial com a profundidade (dependente
              da frequência), perfil gaussiano do feixe, zona focal com ganho aumentado, camadas
              anatômicas (pele, gordura, fáscia, músculo) com diferentes ecogenicidades, e
              artefatos de varredura. Frequências mais altas produzem maior resolução mas menor
              penetração.
            </p>
          </Card>
        </div>

        {/* CONTROLS */}
        <div className="space-y-6">
          {/* Transducer & Mode Selection */}
          <Card className="p-4 space-y-4 bg-slate-900 border-slate-700">
            <div className="space-y-2">
              <Label className="text-slate-200">Transdutor</Label>
              <Select value={transducerType} onValueChange={setTransducerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear (7-12 MHz)</SelectItem>
                  <SelectItem value="curved">Convexo (2-6 MHz)</SelectItem>
                  <SelectItem value="microconvex">Microconvexo (5-10 MHz)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Modo de Imagem</Label>
              <Select value={imagingMode} onValueChange={setImagingMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b-mode">Modo B (Brightness)</SelectItem>
                  <SelectItem value="m-mode">Modo M (Motion)</SelectItem>
                  <SelectItem value="doppler">Doppler Color</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-4 space-y-5 bg-slate-900 border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100">Controles Principais</h3>

            {/* Gain */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-slate-200">Ganho / Brilho</Label>
                  <p className="text-xs text-slate-400">
                    Amplifica o sinal de retorno
                  </p>
                </div>
                <span className="text-sm font-mono text-green-400">
                  {intensity.toFixed(2)} W/cm²
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[gainPercent]}
                onValueChange={([v]) => setGainPercent(v)}
                className="cursor-pointer"
              />
            </div>

            {/* Depth */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-slate-200">Profundidade Máxima</Label>
                  <p className="text-xs text-slate-400">
                    Controla a profundidade visualizada
                  </p>
                </div>
                <span className="text-sm font-mono text-green-400">
                  {maxDepthCm.toFixed(1)} cm
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[depthPercent]}
                onValueChange={([v]) => setDepthPercent(v)}
                className="cursor-pointer"
              />
            </div>

            {/* Focus */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-slate-200">Profundidade de Foco</Label>
                  <p className="text-xs text-slate-400">
                    Define a região de máxima clareza
                  </p>
                </div>
                <span className="text-sm font-mono text-green-400">
                  {focusDepthCm.toFixed(1)} cm
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[focusPercent]}
                onValueChange={([v]) => setFocusPercent(v)}
                className="cursor-pointer"
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-slate-200">Frequência (MHz)</Label>
                  <p className="text-xs text-slate-400">
                    Afeta resolução e penetração
                  </p>
                </div>
                <span className="text-sm font-mono text-green-400">
                  {frequencyMHz.toFixed(2)} MHz
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[freqPercent]}
                onValueChange={([v]) => setFreqPercent(v)}
                className="cursor-pointer"
              />
            </div>

            {/* Dynamic Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-slate-200">Faixa Dinâmica</Label>
                  <p className="text-xs text-slate-400">
                    Controla contraste da imagem
                  </p>
                </div>
                <span className="text-sm font-mono text-green-400">
                  {dynamicRange} dB
                </span>
              </div>
              <Slider
                min={30}
                max={90}
                step={5}
                value={[dynamicRange]}
                onValueChange={([v]) => setDynamicRange(v)}
                className="cursor-pointer"
              />
            </div>
          </Card>

          {/* TGC Controls */}
          <Card className="p-4 space-y-3 bg-slate-900 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-100">TGC (Time Gain Compensation)</h3>
            <div className="grid grid-cols-4 gap-2">
              {tgcSliders.map((value, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-[10px] text-slate-300">{index * 2}cm</Label>
                  <Slider
                    orientation="vertical"
                    min={0}
                    max={200}
                    step={5}
                    value={[value * 100]}
                    onValueChange={([v]) => handleTgcChange(index, v)}
                    className="h-16"
                  />
                </div>
              ))}
            </div>
          </Card>

          <div className="p-3 bg-slate-900/30 border border-slate-700 rounded-lg">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-amber-400">Nota:</strong> Este é um modelo computacional
              avançado para fins didáticos. A visualização usa renderização procedural com shaders
              para simular características visuais de imagens de ultrassom real. Não substitui
              equipamento clínico ou protocolos médicos.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UltrasoundFullSimulator;
