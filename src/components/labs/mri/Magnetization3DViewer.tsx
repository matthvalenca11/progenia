import { Canvas } from "@react-three/fiber";

interface Magnetization3DViewerProps {
  showDebug?: boolean;
}

// Placeholder simples enquanto o módulo de magnetização 3D estiver em hold.
export function Magnetization3DViewer({ showDebug = false }: Magnetization3DViewerProps) {
  return (
    <div className="w-full h-full bg-[#050a15] flex items-center justify-center">
      <Canvas dpr={[1, 1.5]}>
        <color attach="background" args={["#050a15"]} />
      </Canvas>
    </div>
  );
}
