/**
 * Rota DEV-only para reproduzir labs terapêuticos sem auth/Supabase.
 * Acesse: /dev/lab-smoke/ultrasound-therapy
 */
import { UltrasoundTherapyLabV2 } from "@/components/labs/ultrasound-therapy/UltrasoundTherapyLabV2";
import TensLabPage from "@/pages/TensLabPage";
import PhotobioLabPage from "@/pages/PhotobioLabPage";
import { useParams } from "react-router-dom";

export default function TherapeuticLabSmoke() {
  const { type } = useParams<{ type: string }>();

  if (type === "tens") {
    return (
      <div className="h-[100dvh] w-full">
        <TensLabPage embedded />
      </div>
    );
  }

  if (type === "photobio") {
    return (
      <div className="h-[100dvh] w-full">
        <PhotobioLabPage embedded />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full">
      <UltrasoundTherapyLabV2 embedded showBackButton={false} />
    </div>
  );
}
