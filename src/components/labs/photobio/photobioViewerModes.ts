import type { PhotobioFieldMode } from "@/lib/photobioFieldTexture";
import type { PhotobioViewerTab } from "@/stores/photobioStore";

export interface PhotobioViewerVisualConfig {
  fieldMode: PhotobioFieldMode | null;
  fieldOpacity: number;
  forceTranslucent: boolean;
  showBeamVolume: boolean;
  showBeamScatter: boolean;
  showBeamCone: boolean;
  showBeamAbsorption: boolean;
  showOpticalContact: boolean;
  showDoseSurfaceMap: boolean;
  doseMapEnhanced: boolean;
  showDepthProfile: boolean;
  showBioresponseOverlay: boolean;
  showLayerLabels: boolean;
  beamIntensityScale: number;
  show808DidacticBanner: boolean;
  showSceneWarnings: boolean;
  showTranslucentToggle: boolean;
  modeHint: string;
  shortHint: string;
  accentClass: string;
}

const VIEWER_VISUAL_CONFIG: Record<PhotobioViewerTab, PhotobioViewerVisualConfig> = {
  anatomy: {
    fieldMode: null,
    fieldOpacity: 0,
    forceTranslucent: false,
    showBeamVolume: false,
    showBeamScatter: false,
    showBeamCone: false,
    showBeamAbsorption: false,
    showOpticalContact: true,
    showDoseSurfaceMap: false,
    doseMapEnhanced: false,
    showDepthProfile: false,
    showBioresponseOverlay: false,
    showLayerLabels: true,
    beamIntensityScale: 0,
    show808DidacticBanner: false,
    showSceneWarnings: true,
    showTranslucentToggle: true,
    modeHint: "Anatomia em corte — camadas e alvo terapêutico",
    shortHint: "Camadas teciduais",
    accentClass: "text-amber-300",
  },
  beam: {
    fieldMode: "beam",
    fieldOpacity: 1,
    forceTranslucent: true,
    showBeamVolume: false,
    showBeamScatter: true,
    showBeamCone: false,
    showBeamAbsorption: false,
    showOpticalContact: true,
    showDoseSurfaceMap: false,
    doseMapEnhanced: false,
    showDepthProfile: false,
    showBioresponseOverlay: false,
    showLayerLabels: false,
    beamIntensityScale: 1.2,
    show808DidacticBanner: false,
    showSceneWarnings: true,
    showTranslucentToggle: false,
    modeHint: "Feixe laser — propagação, espalhamento e contato óptico",
    shortHint: "Propagação do feixe",
    accentClass: "text-rose-400",
  },
  fluence: {
    fieldMode: "fluence",
    fieldOpacity: 1,
    forceTranslucent: true,
    showBeamVolume: false,
    showBeamScatter: false,
    showBeamCone: false,
    showBeamAbsorption: false,
    showOpticalContact: false,
    showDoseSurfaceMap: true,
    doseMapEnhanced: true,
    showDepthProfile: false,
    showBioresponseOverlay: false,
    showLayerLabels: false,
    beamIntensityScale: 0,
    show808DidacticBanner: false,
    showSceneWarnings: false,
    showTranslucentToggle: false,
    modeHint: "Mapa de fluência (J/cm²) — calor = dose depositada",
    shortHint: "Fluência acumulada",
    accentClass: "text-yellow-300",
  },
  penetration: {
    fieldMode: "absorption",
    fieldOpacity: 1,
    forceTranslucent: true,
    showBeamVolume: false,
    showBeamScatter: false,
    showBeamCone: false,
    showBeamAbsorption: true,
    showOpticalContact: false,
    showDoseSurfaceMap: false,
    doseMapEnhanced: false,
    showDepthProfile: true,
    showBioresponseOverlay: false,
    showLayerLabels: false,
    beamIntensityScale: 0,
    show808DidacticBanner: false,
    showSceneWarnings: false,
    showTranslucentToggle: false,
    modeHint: "Absorção por camada — Beer–Lambert e perfil F(z)",
    shortHint: "Penetração óptica",
    accentClass: "text-violet-400",
  },
  bioresponse: {
    fieldMode: "bioresponse",
    fieldOpacity: 0.82,
    forceTranslucent: true,
    showBeamVolume: false,
    showBeamScatter: false,
    showBeamCone: false,
    showBeamAbsorption: false,
    showOpticalContact: false,
    showDoseSurfaceMap: false,
    doseMapEnhanced: false,
    showDepthProfile: false,
    showBioresponseOverlay: false,
    showLayerLabels: false,
    beamIntensityScale: 0,
    show808DidacticBanner: false,
    showSceneWarnings: false,
    showTranslucentToggle: false,
    modeHint: "Resposta biológica — curva Arndt–Schulz simulada",
    shortHint: "Zona biológica",
    accentClass: "text-emerald-400",
  },
};

export function getPhotobioViewerVisualConfig(viewerTab: PhotobioViewerTab): PhotobioViewerVisualConfig {
  return VIEWER_VISUAL_CONFIG[viewerTab];
}

export function resolvePhotobioTranslucentView(
  viewerTab: PhotobioViewerTab,
  userTranslucent: boolean,
): boolean {
  const config = getPhotobioViewerVisualConfig(viewerTab);
  return userTranslucent || config.forceTranslucent;
}

/** @deprecated Use getPhotobioViewerVisualConfig(viewerTab).fieldMode */
export function photobioViewerTabToFieldMode(
  tab: PhotobioViewerTab,
): PhotobioFieldMode | null {
  return getPhotobioViewerVisualConfig(tab).fieldMode;
}
