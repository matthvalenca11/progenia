import type { PhotobioOpticsResult } from "@/lib/photobioOptics";
import type { PhotobioStackLayout } from "./photobioViewerLayout";

interface PhotobioDepthProfileOverlayProps {
  opticsProfile: PhotobioOpticsResult;
  layout: PhotobioStackLayout;
}

/** Reservado para anotações 3D futuras — mantém a cena limpa por padrão. */
export function PhotobioDepthProfileOverlay(_props: PhotobioDepthProfileOverlayProps) {
  return null;
}
