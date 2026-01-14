/**
 * Tens3DSceneSetup - Configuração compartilhada da cena 3D
 * Garante que builder e modo aula/teste tenham a mesma visualização
 */

import { PerspectiveCamera, OrbitControls } from '@react-three/drei';

export function Tens3DSceneSetup() {
  return (
    <>
      {/* Camera - mesma configuração do builder */}
      <PerspectiveCamera makeDefault position={[0, 2.5, 10]} fov={55} />
      
      {/* OrbitControls - zoom out aumentado para visualizar melhor o volume */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 5}
        maxDistance={35}
        minDistance={5}
        enableDamping={true}
        dampingFactor={0.05}
      />

      {/* Enhanced Lighting - melhor contraste e profundidade (igual ao builder) */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      <pointLight position={[0, 5, 0]} intensity={0.6} color="#60a5fa" />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#a855f7" />
      <hemisphereLight args={['#ffffff', '#444444', 0.25]} />
      
      {/* Fog mais sutil para melhor profundidade (igual ao builder) */}
      <fog attach="fog" args={['#0f172a', 12, 28]} />
    </>
  );
}
