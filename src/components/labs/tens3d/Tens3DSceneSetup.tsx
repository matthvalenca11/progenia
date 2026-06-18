/**
 * Tens3DSceneSetup - Configuração compartilhada da cena 3D
 * Garante que builder e modo aula/teste tenham a mesma visualização
 */

import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { isAndroidNative } from "@/lib/labPerformance";

export function Tens3DSceneSetup() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.5, 10]} fov={55} />

      <OrbitControls
        makeDefault
        enableZoom
        enablePan={false}
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 5}
        maxDistance={35}
        minDistance={5}
        enableDamping={!isAndroidNative}
        dampingFactor={0.08}
        rotateSpeed={isAndroidNative ? 0.85 : 1}
        zoomSpeed={isAndroidNative ? 0.9 : 1}
      />

      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#fff6ee", "#3d3028", 0.32]} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.05}
        castShadow={!isAndroidNative}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.28} color="#ffe8d0" />
      <pointLight position={[0, 5, 0]} intensity={0.6} color="#60a5fa" />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#a855f7" />
      <hemisphereLight args={["#ffffff", "#444444", 0.25]} />

      <fog attach="fog" args={["#0f172a", 12, 28]} />
    </>
  );
}
