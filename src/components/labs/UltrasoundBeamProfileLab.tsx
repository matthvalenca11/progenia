import { useState, useMemo } from "react";
import { LabLayout } from "./LabLayout";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";

export function UltrasoundBeamProfileLab() {
  const [era, setEra] = useState(5); // cm²
  const [bnr, setBnr] = useState(5); // Beam Non-uniformity Ratio
  const [power, setPower] = useState(10); // W

  const calculations = useMemo(() => {
    const spatialAverage = power / era;
    const spatialPeak = spatialAverage * bnr;

    let bnrClassification = "";
    if (bnr <= 4) bnrClassification = "BNR baixo - distribuição uniforme";
    else if (bnr <= 6) bnrClassification = "BNR moderado - hot spots pequenos";
    else bnrClassification = "BNR alto - hot spots intensos, requer movimentação";

    return {
      spatialAverage: spatialAverage.toFixed(2),
      spatialPeak: spatialPeak.toFixed(2),
      bnrClassification,
    };
  }, [era, bnr, power]);

  const renderBeamProfile = () => {
    const gridSize = 9;
    const cells = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Distance from center
        const centerRow = Math.floor(gridSize / 2);
        const centerCol = Math.floor(gridSize / 2);
        const distanceFromCenter = Math.sqrt(
          Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
        );

        // Base intensity (Gaussian-like distribution)
        const maxDistance = Math.sqrt(2) * Math.floor(gridSize / 2);
        let baseIntensity = 1 - (distanceFromCenter / maxDistance) * 0.7;

        // Add hot spots based on BNR
        const hotSpotFactor = (bnr - 3) / 7; // Normalize BNR effect
        const randomVariation = (Math.random() - 0.5) * hotSpotFactor;
        
        // Create concentrated hot spots for high BNR
        const isHotSpot = Math.random() > (1 - hotSpotFactor * 0.3) && distanceFromCenter < maxDistance * 0.6;
        if (isHotSpot) {
          baseIntensity = Math.min(1, baseIntensity + hotSpotFactor * (0.5 + Math.random() * 0.5));
        } else {
          baseIntensity = Math.max(0, baseIntensity + randomVariation * 0.3);
        }

        // Color mapping: blue -> yellow -> red
        let color = "";
        if (baseIntensity < 0.3) {
          const t = baseIntensity / 0.3;
          color = `hsl(220, 70%, ${30 + t * 30}%)`; // blue
        } else if (baseIntensity < 0.7) {
          const t = (baseIntensity - 0.3) / 0.4;
          color = `hsl(${220 - t * 160}, 70%, ${60 + t * 20}%)`; // blue to yellow
        } else {
          const t = (baseIntensity - 0.7) / 0.3;
          color = `hsl(${60 - t * 60}, ${70 + t * 20}%, ${80 - t * 30}%)`; // yellow to red
        }

        cells.push(
          <div
            key={`${row}-${col}`}
            className="aspect-square rounded-sm transition-colors duration-300 border border-background/20"
            style={{ backgroundColor: color }}
            title={`Intensidade relativa: ${(baseIntensity * 100).toFixed(0)}%`}
          />
        );
      }
    }

    return (
      <div
        className="grid gap-1 p-4 bg-muted/20 rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {cells}
      </div>
    );
  };

  const controls = (
    <>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>ERA (cm²)</Label>
          <span className="text-sm font-medium">{era} cm²</span>
        </div>
        <Slider
          value={[era]}
          onValueChange={([v]) => setEra(v)}
          min={3}
          max={10}
          step={0.5}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>BNR (Beam Non-uniformity Ratio)</Label>
          <span className="text-sm font-medium">{bnr.toFixed(1)}</span>
        </div>
        <Slider
          value={[bnr]}
          onValueChange={([v]) => setBnr(v)}
          min={3}
          max={10}
          step={0.5}
        />
        <p className="text-xs text-muted-foreground">
          BNR = Intensidade de Pico / Intensidade Média
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Potência (W)</Label>
          <span className="text-sm font-medium">{power} W</span>
        </div>
        <Slider
          value={[power]}
          onValueChange={([v]) => setPower(v)}
          min={1}
          max={30}
          step={1}
        />
      </div>

      <Card className="bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Legenda de Cores:</strong><br />
          <span className="inline-block w-3 h-3 bg-blue-400 rounded mr-1" /> Azul = Intensidade baixa<br />
          <span className="inline-block w-3 h-3 bg-yellow-400 rounded mr-1" /> Amarelo = Intensidade moderada<br />
          <span className="inline-block w-3 h-3 bg-red-400 rounded mr-1" /> Vermelho = Hot spots (intensidade alta)
        </p>
      </Card>
    </>
  );

  const visualization = (
    <div className="space-y-6">
      {/* Beam Profile Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Distribuição Espacial de Intensidade</h3>
        {renderBeamProfile()}
        <p className="text-xs text-muted-foreground mt-3">
          {bnr <= 4
            ? "Distribuição uniforme - baixo risco de hot spots"
            : bnr <= 6
            ? "Hot spots moderados - movimentação lenta recomendada"
            : "Hot spots intensos - movimentação contínua obrigatória"}
        </p>
      </div>

      {/* Results */}
      <Card className="bg-muted/30 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">I espacial média:</span>
          <span className="font-mono font-bold">{calculations.spatialAverage} W/cm²</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">I espacial de pico:</span>
          <span className="font-mono font-bold text-red-600">{calculations.spatialPeak} W/cm²</span>
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-sm font-medium">{calculations.bnrClassification}</p>
        </div>
      </Card>

      {/* Explanation */}
      <div className="text-xs text-muted-foreground space-y-2">
        <p>
          <strong>BNR (Beam Non-uniformity Ratio):</strong> Relação entre intensidade de pico e intensidade média
        </p>
        <p>
          <strong>Hot Spots:</strong> Regiões de alta intensidade que podem causar desconforto ou lesão se o transdutor permanecer estático
        </p>
        <p>
          <strong>Implicação Clínica:</strong> BNR alto exige movimentação contínua do cabeçote durante o tratamento
        </p>
      </div>
    </div>
  );

  return (
    <LabLayout
      title="Perfil de Feixe Ultrassônico"
      description="Visualize hot spots, BNR e distribuição de intensidade no campo acústico"
      controls={controls}
      visualization={visualization}
    />
  );
}
