import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import type { PhotobioOpticsResult, PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioMode } from "@/stores/photobioStore";
import { getPhotobioScatterCount } from "@/lib/therapeuticLabsPerformance";
import { clamp, type PhotobioStackLayout } from "./photobioViewerLayout";
import type { PhotobioViewerVisualConfig } from "./photobioViewerModes";
import { PhotobioBeamVolume } from "./PhotobioBeamVolume";
import { PhotobioScatterField } from "./PhotobioScatterField";
import { PhotobioAbsorptionOverlay } from "./PhotobioAbsorptionOverlay";
import { PhotobioOpticalContact } from "./PhotobioOpticalContact";

interface PhotobioBeamProps {
  wavelength: PhotobioWavelength;
  irradiance: number;
  mode: PhotobioMode;
  dutyCycle: number;
  translucentView: boolean;
  opticsProfile: PhotobioOpticsResult;
  interactionMap: PhotobioInteractionMap;
  layout: PhotobioStackLayout;
  transducerX: number;
  transducerAngle: number;
  contactPressure: number;
  spotSizeCm2: number;
  visualConfig: PhotobioViewerVisualConfig;
  isDragging: boolean;
  effectiveFluence: number;
  onAccumulateDose: (positionX: number, doseDelta: number) => void;
}

export function PhotobioBeam({
  wavelength,
  irradiance,
  mode,
  dutyCycle,
  translucentView,
  opticsProfile,
  interactionMap,
  layout,
  transducerX,
  transducerAngle,
  contactPressure,
  spotSizeCm2,
  visualConfig,
  isDragging,
  effectiveFluence,
  onAccumulateDose,
}: PhotobioBeamProps) {
  const doseTickRef = useRef(0);
  const { contactSurfaceY, spotScale, incidenceEfficiency, contactCenterOffsetX } = layout;

  const coupling = opticsProfile.contactTransmission ?? 0.95;
  const thermalRiskIndex = opticsProfile.thermalRiskIndex ?? clamp(irradiance / 500, 0, 1);
  const intensityScale = visualConfig.beamIntensityScale;
  const translucentBoost = translucentView ? 1.2 : 1;
  const scatterCount = getPhotobioScatterCount(wavelength);

  useFrame((_, delta) => {
    if (!visualConfig.showDoseSurfaceMap || !isDragging) {
      doseTickRef.current = 0;
      return;
    }
    doseTickRef.current += delta;
    if (doseTickRef.current >= 0.08) {
      const doseDelta = Math.max(0.04, effectiveFluence * 0.018 * doseTickRef.current);
      onAccumulateDose(transducerX, doseDelta);
      doseTickRef.current = 0;
    }
  });

  const showAnything =
    visualConfig.showBeamVolume ||
    visualConfig.showBeamScatter ||
    visualConfig.showBeamAbsorption ||
    visualConfig.showOpticalContact;

  if (!showAnything) return null;

  return (
    <>
      {visualConfig.showBeamVolume && (
        <PhotobioBeamVolume
          opticsProfile={opticsProfile}
          spotSizeCm2={spotSizeCm2}
          contactSurfaceY={contactSurfaceY}
          transducerX={transducerX}
          transducerAngle={transducerAngle}
          wavelength={wavelength}
          coupling={coupling}
          intensityScale={intensityScale * translucentBoost}
          isPulsed={mode === "Pulsed"}
          dutyCycle={dutyCycle}
        />
      )}

      {visualConfig.showBeamScatter && (
        <PhotobioScatterField
          interactionMap={interactionMap}
          contactSurfaceY={contactSurfaceY}
          wavelength={wavelength}
          maxCount={scatterCount}
          intensityScale={intensityScale * translucentBoost * 1.15}
          isPulsed={mode === "Pulsed"}
          dutyCycle={dutyCycle}
        />
      )}

      {visualConfig.showBeamAbsorption && (
        <PhotobioAbsorptionOverlay
          opticsProfile={opticsProfile}
          layout={layout}
          wavelength={wavelength}
          transducerX={transducerX}
          thermalRiskIndex={thermalRiskIndex}
          maxMarkers={wavelength === 660 ? 32 : 26}
          visible
        />
      )}

      {visualConfig.showOpticalContact && (
        <PhotobioOpticalContact
          transducerX={transducerX}
          contactSurfaceY={contactSurfaceY}
          transducerAngle={transducerAngle}
          incidenceEfficiency={incidenceEfficiency}
          contactCenterOffsetX={contactCenterOffsetX}
          coupling={coupling}
          thermalRiskIndex={thermalRiskIndex}
          irradianceMwCm2={irradiance}
          spotScale={spotScale}
        />
      )}
    </>
  );
}
