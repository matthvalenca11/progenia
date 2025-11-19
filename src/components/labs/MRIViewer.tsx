import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface MRIViewerProps {
  config: {
    slices?: string[];
    title?: string;
    description?: string;
  };
}

export const MRIViewer = ({ config }: MRIViewerProps) => {
  const slices = config.slices || [];
  const [currentSlice, setCurrentSlice] = useState(0);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">
          {config.title || "Visualizador de Ressonância Magnética"}
        </h3>
        {config.description && (
          <p className="text-muted-foreground">{config.description}</p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Image Viewer */}
        <Card className="md:col-span-2 p-6">
          <div className="aspect-square bg-black rounded-lg flex items-center justify-center overflow-hidden">
            {slices.length > 0 ? (
              <img
                src={slices[currentSlice]}
                alt={`Fatia ${currentSlice + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-white/50">
                <p>Nenhuma imagem disponível</p>
                <p className="text-sm mt-2">Configure as fatias de RM no admin</p>
              </div>
            )}
          </div>

          {slices.length > 0 && (
            <div className="mt-6 space-y-2">
              <Label>
                Fatia: {currentSlice + 1} / {slices.length}
              </Label>
              <Slider
                value={[currentSlice]}
                onValueChange={(value) => setCurrentSlice(value[0])}
                max={slices.length - 1}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </Card>

        {/* Info Panel */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Informações Anatômicas</h4>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-primary">Fatia Atual</p>
              <p className="text-muted-foreground">
                {currentSlice + 1} de {slices.length}
              </p>
            </div>

            <div>
              <p className="font-medium text-primary">Orientação</p>
              <p className="text-muted-foreground">Axial</p>
            </div>

            <div>
              <p className="font-medium text-primary">Sequência</p>
              <p className="text-muted-foreground">T1-weighted</p>
            </div>

            <div className="pt-4 border-t">
              <p className="font-medium mb-2">Instruções:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Use o controle deslizante para navegar entre as fatias</li>
                <li>• Observe as diferentes estruturas anatômicas</li>
                <li>• Compare intensidades de sinal entre tecidos</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};