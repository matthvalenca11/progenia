import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LabLayoutProps {
  title: string;
  description: string;
  controls: ReactNode;
  visualization: ReactNode;
}

export function LabLayout({ title, description, controls, visualization }: LabLayoutProps) {
  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Controls Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
            <CardDescription>Ajuste os controles para ver os resultados em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {controls}
          </CardContent>
        </Card>

        {/* Visualization Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Visualização</CardTitle>
            <CardDescription>Observe os efeitos das mudanças de parâmetros</CardDescription>
          </CardHeader>
          <CardContent>
            {visualization}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
