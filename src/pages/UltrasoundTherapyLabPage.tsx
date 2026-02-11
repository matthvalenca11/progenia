/**
 * UltrasoundTherapyLabPage - Página do Laboratório de Ultrassom Terapêutico
 */

import { useMemo } from "react";
import { UltrasoundTherapyLabV2 } from "@/components/labs/ultrasound-therapy/UltrasoundTherapyLabV2";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";

interface UltrasoundTherapyLabPageProps {
  config?: UltrasoundTherapyConfig | any;
  previewMode?: boolean;
}

export default function UltrasoundTherapyLabPage({ 
  config, 
  previewMode = false 
}: UltrasoundTherapyLabPageProps) {
  // Validar e normalizar config - detectar se é config de diagnóstico
  const normalizedConfig: UltrasoundTherapyConfig = useMemo(() => {
    if (!config || typeof config !== 'object') {
      console.warn('⚠️ UltrasoundTherapyLabPage: Sem config, usando default');
      return defaultUltrasoundTherapyConfig;
    }
    
    // Detectar se o config tem estrutura de diagnóstico (não deveria acontecer!)
    const hasDiagnosticKeys = config.gain !== undefined || 
                              config.depth !== undefined || 
                              config.layers !== undefined || 
                              config.acousticLayers !== undefined ||
                              config.inclusions !== undefined || 
                              config.presetId !== undefined;
    
    if (hasDiagnosticKeys) {
      console.error('❌ UltrasoundTherapyLabPage: Config parece ser de DIAGNÓSTICO!', {
        hasGain: config.gain !== undefined,
        hasDepth: config.depth !== undefined,
        hasLayers: config.layers !== undefined,
        hasAcousticLayers: config.acousticLayers !== undefined,
        hasInclusions: config.inclusions !== undefined,
        configKeys: Object.keys(config).slice(0, 15),
      });
      return defaultUltrasoundTherapyConfig;
    }
    
    // Verificar se tem estrutura de terapêutico
    const hasTherapyKeys = config.era !== undefined || 
                          config.mode === 'continuous' || 
                          config.mode === 'pulsed' ||
                          config.dutyCycle !== undefined ||
                          config.scenario !== undefined;
    
    if (!hasTherapyKeys) {
      console.warn('⚠️ UltrasoundTherapyLabPage: Config não tem estrutura de terapêutico, usando default');
      return defaultUltrasoundTherapyConfig;
    }
    
    // Mesclar com default para garantir campos obrigatórios
    const merged: UltrasoundTherapyConfig = {
      ...defaultUltrasoundTherapyConfig,
      ...config,
      enabledControls: {
        ...defaultUltrasoundTherapyConfig.enabledControls,
        ...(config.enabledControls || {}),
      },
      ranges: {
        ...defaultUltrasoundTherapyConfig.ranges,
        ...(config.ranges || {}),
      },
    };
    
    console.log('✅ UltrasoundTherapyLabPage: Config validado e normalizado', {
      scenario: merged.scenario,
      frequency: merged.frequency,
      mode: merged.mode,
      intensity: merged.intensity,
    });
    
    return merged;
  }, [config]);
  
  return (
    <UltrasoundTherapyLabV2 
      config={normalizedConfig} 
      labName="Laboratório Virtual de Ultrassom Terapêutico"
      showBackButton={!previewMode}
    />
  );
}
