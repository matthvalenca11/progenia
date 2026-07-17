import PhotobioLabV2 from "@/components/labs/photobio/PhotobioLabV2";

import type { PhotobioLabConfig } from "@/types/photobioLabConfig";

interface PhotobioLabPageProps {
  config?: Partial<PhotobioLabConfig> | Record<string, unknown>;
  previewMode?: boolean;
}

export default function PhotobioLabPage({ config, previewMode = false }: PhotobioLabPageProps) {
  return (
    <PhotobioLabV2 config={config} showBackButton={!previewMode} previewMode={previewMode} />
  );
}

