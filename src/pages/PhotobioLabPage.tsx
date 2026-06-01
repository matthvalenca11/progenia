import PhotobioLabV2 from "@/components/labs/photobio/PhotobioLabV2";

interface PhotobioLabPageProps {
  config?: Record<string, unknown>;
  previewMode?: boolean;
}

export default function PhotobioLabPage({ config, previewMode = false }: PhotobioLabPageProps) {
  return <PhotobioLabV2 config={config} showBackButton={!previewMode} />;
}

