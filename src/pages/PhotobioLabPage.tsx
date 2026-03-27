import PhotobioLabV2 from "@/components/labs/photobio/PhotobioLabV2";

interface PhotobioLabPageProps {
  config?: Record<string, unknown>;
}

export default function PhotobioLabPage({ config }: PhotobioLabPageProps) {
  return <PhotobioLabV2 config={config} />;
}

