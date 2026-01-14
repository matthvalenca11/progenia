/**
 * UltrasoundTherapy3DViewer - Visualizador 3D para Ultrassom Terapêutico
 * Versão V1 simplificada - mostra tecidos, feixe acústico e mapa de temperatura
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid } from '@react-three/drei';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Waves, Thermometer } from "lucide-react";
import { TissueLayers } from './TissueLayers';
import { UltrasoundBeam } from './UltrasoundBeam';
import { TemperatureHeatmap } from './TemperatureHeatmap';
import { BoneReflection } from './BoneReflection';
import { TransducerModel } from './TransducerModel';
import { CavitationEffect } from './CavitationEffect';
import { MixedLayer } from './MixedLayer';

type ViewerTab = "anatomy" | "beam" | "thermal";

export function UltrasoundTherapy3DViewer() {
  const { 
    config, 
    simulationResult 
  } = useUltrasoundTherapyStore();
  
  const [viewerTab, setViewerTab] = useState<ViewerTab>("beam");
  
  // V5: Animated scanning pattern
  const [scanTime, setScanTime] = useState(0);
  
  useEffect(() => {
    if (config.movement === "scanning") {
      const interval = setInterval(() => {
        setScanTime((t) => t + 0.1);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setScanTime(0);
    }
  }, [config.movement]);
  
  // Calculate scanning position
  const scanPosition = useMemo(() => {
    if (config.movement === "scanning" && config.transducerPosition) {
      // Simple linear scan pattern
      const scanAmplitude = 0.6;
      const scanX = config.transducerPosition.x + Math.sin(scanTime) * scanAmplitude;
      return { x: scanX, y: config.transducerPosition.y };
    }
    return config.transducerPosition || { x: 0, y: 0 };
  }, [config.movement, config.transducerPosition, scanTime]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      {/* Tabs */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as ViewerTab)}>
          <TabsList className="bg-slate-800/90 backdrop-blur-sm h-8">
            <TabsTrigger value="anatomy" className="gap-1 text-[11px] h-6 px-3">
              <Eye className="h-3 w-3" />Anatomia
            </TabsTrigger>
            <TabsTrigger value="beam" className="gap-1 text-[11px] h-6 px-3">
              <Waves className="h-3 w-3" />Feixe
            </TabsTrigger>
            <TabsTrigger value="thermal" className="gap-1 text-[11px] h-6 px-3">
              <Thermometer className="h-3 w-3" />Temperatura
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3D Canvas */}
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 2.5, 10]} fov={55} />
        <OrbitControls 
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 5}
          maxDistance={35}
          minDistance={5}
          enableDamping={true}
          dampingFactor={0.05}
        />
        
        {/* Enhanced Lighting (local to this viewer) - brighter top/transducer without changing other labs */}
        <hemisphereLight intensity={0.55} groundColor={"#0b1220"} color={"#ffffff"} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 9, 6]} intensity={1.05} />
        <directionalLight position={[-6, 6, -4]} intensity={0.5} />
        {/* Fill light near camera to avoid crushed blacks on the transducer */}
        <pointLight position={[0, 3.5, 9]} intensity={0.9} distance={25} decay={2} />
        <pointLight position={[0, 6, 0]} intensity={0.35} distance={18} decay={2} />
        
        {/* Enhanced Fog - subtle depth gradient */}
        <fog attach="fog" args={['#0f172a', 15, 35]} />
        
        {/* Grid - Consistent with other labs */}
        <Grid args={[24, 24, '#334155', '#1e293b']} position={[0, -4, 0]} />
        
        {/* Transducer Model - V6: Geometrically correct (face = sqrt(ERA/π)) */}
        <TransducerModel 
          era={config.era} 
          coupling={config.coupling}
          mode={config.mode}
          intensity={config.intensity}
          dutyCycle={config.dutyCycle}
          position={scanPosition}
        />
        
        {/* Tissue Layers - V5: Custom thicknesses + Mixed layer support */}
        {!config.mixedLayer?.enabled && (
          <TissueLayers 
            scenario={config.scenario} 
            showLabels={viewerTab === "anatomy"}
            customThicknesses={config.customThicknesses}
          />
        )}
        
        {/* Mixed Layer - V5: Bone/Muscle in same plane */}
        {config.mixedLayer?.enabled && config.scenario === "custom" && (
          <>
            {/* Render normal layers up to mixed layer depth */}
            <TissueLayers 
              scenario={config.scenario} 
              showLabels={viewerTab === "anatomy"}
              customThicknesses={config.customThicknesses}
              stopAtDepth={config.mixedLayer.depth}
            />
            {/* Render mixed layer */}
            <MixedLayer
              depth={config.mixedLayer.depth}
              division={config.mixedLayer.division}
              thickness={0.5}
            />
          </>
        )}
        
        {/* Ultrasound Beam - V6: Starts at face with correct diameter */}
        {(viewerTab === "beam" || viewerTab === "thermal") && simulationResult && (
          <UltrasoundBeam 
            frequency={config.frequency}
            intensity={config.intensity}
            era={config.era}
            effectiveDepth={simulationResult.effectiveDepth}
            penetrationDepth={simulationResult.penetrationDepth}
            coupling={config.coupling}
            position={scanPosition}
          />
        )}
        
        {/* Temperature Heatmap - V6: Follows transducer position + scanning, scales with ERA */}
        {viewerTab === "thermal" && simulationResult && (
          <TemperatureHeatmap 
            maxTemp={simulationResult.maxTemp}
            maxTempDepth={simulationResult.maxTempDepth}
            surfaceTemp={simulationResult.surfaceTemp}
            targetTemp={simulationResult.targetTemp}
            movement={config.movement}
            treatedArea={simulationResult.treatedArea}
            position={scanPosition}
            era={config.era}
          />
        )}
        
        {/* Bone Reflection */}
        {(viewerTab === "beam" || viewerTab === "thermal") && simulationResult && (
          <BoneReflection />
        )}
        
        {/* Cavitation Effect - V4: Didático */}
        {(viewerTab === "beam" || viewerTab === "thermal") && (
          <CavitationEffect
            intensity={config.intensity}
            mode={config.mode}
            dutyCycle={config.dutyCycle}
            frequency={config.frequency}
          />
        )}
      </Canvas>
    </div>
  );
}
