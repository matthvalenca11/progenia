import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const BasicInfoSection = () => {
  const { labName, labDescription, setLabName, setLabDescription } = useUltrasoundLabStore();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Informações Básicas
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Nome e descrição do laboratório virtual que será exibido aos estudantes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>Defina o nome e descrição do laboratório</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lab-name">Nome do Laboratório *</Label>
          <Input
            id="lab-name"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            placeholder="Ex: Ultrassom de Ombro - Tendão Supraespinal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lab-description">Descrição</Label>
          <Textarea
            id="lab-description"
            value={labDescription}
            onChange={(e) => setLabDescription(e.target.value)}
            placeholder="Descreva os objetivos de aprendizado e o que os alunos poderão explorar neste laboratório..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};
