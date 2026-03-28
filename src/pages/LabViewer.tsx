import { lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

const LabExperience = lazy(() =>
  import("@/components/labs/LabExperience").then((m) => ({ default: m.LabExperience })),
);

export default function LabViewer() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const capsulaId = new URLSearchParams(location.search).get("capsulaId");

  if (!slug) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando laboratório…</p>
        </div>
      }
    >
      <LabExperience slug={slug} variant="page" capsulaId={capsulaId} />
    </Suspense>
  );
}
