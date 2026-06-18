/**
 * Bottom sheet mobile — controles e métricas sem cobrir o canvas.
 */

import { useState } from "react";
import { SlidersHorizontal, BarChart3, Target, ChevronUp, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ParameterQuickCards } from "./ParameterQuickCards";
import { TargetTissueSelector } from "./TargetTissueSelector";
import { UltrasoundTherapyControlPanel } from "./UltrasoundTherapyControlPanel";
import { UltrasoundTherapyInsightsPanel } from "./UltrasoundTherapyInsightsPanel";
import { AcousticPhenomenaToggles } from "./AcousticPhenomenaToggles";
import { TherapyLabModeToggle } from "./TherapyLabModeToggle";
import { TherapyChallengePanel } from "./TherapyChallengePanel";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";

interface MobileTherapyBottomSheetProps {
  embedded?: boolean;
}

export function MobileTherapyBottomSheet({ embedded: _embedded }: MobileTherapyBottomSheetProps) {
  const [open, setOpen] = useState(false);
  const { viewerTab, labMode } = useUltrasoundTherapyStore();
  const defaultTab = labMode === "guided" ? "challenge" : "quick";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-2">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto h-11 gap-2 rounded-full px-5 shadow-lg"
          onClick={() => setOpen(true)}
        >
          <ChevronUp className="h-4 w-4" />
          Controles e resultados
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className={cn("flex max-h-[min(78dvh,680px)] flex-col rounded-t-2xl p-0")}
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base">Laboratório de Ultrassom</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue={defaultTab} key={defaultTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 grid h-10 shrink-0 grid-cols-5">
              <TabsTrigger value="challenge" className="gap-1 text-[10px]">
                <Sparkles className="h-3.5 w-3.5" />
                Desafio
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-1 text-[10px]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Rápido
              </TabsTrigger>
              <TabsTrigger value="target" className="gap-1 text-[10px]">
                <Target className="h-3.5 w-3.5" />
                Alvo
              </TabsTrigger>
              <TabsTrigger value="full" className="gap-1 text-[10px]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Full
              </TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1 text-[10px]">
                <BarChart3 className="h-3.5 w-3.5" />
                Métricas
              </TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-8">
              <TabsContent value="challenge" className="mt-0 space-y-3">
                <TherapyLabModeToggle compact />
                <TherapyChallengePanel compact />
              </TabsContent>
              <TabsContent value="quick" className="mt-0 space-y-4">
                <ParameterQuickCards compact />
                {viewerTab === "interaction" && <AcousticPhenomenaToggles compact />}
              </TabsContent>

              <TabsContent value="target" className="mt-0">
                <TargetTissueSelector compact />
              </TabsContent>

              <TabsContent value="full" className="mt-0">
                <UltrasoundTherapyControlPanel hideHeader compact />
              </TabsContent>

              <TabsContent value="metrics" className="mt-0">
                <UltrasoundTherapyInsightsPanel hideHeader compact />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
