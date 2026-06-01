import { useParams, useLocation } from "react-router-dom";
import { LabExperience } from "@/components/labs/LabExperience";

export default function LabViewer() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const capsulaId = search.get("capsulaId");
  const labId = search.get("labId");

  if (!slug) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <LabExperience
        slug={slug}
        variant="page"
        capsulaId={capsulaId}
        labId={labId}
      />
    </div>
  );
}
