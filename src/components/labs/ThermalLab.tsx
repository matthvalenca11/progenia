import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Thermometer, Snowflake, Zap as Laser, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ThermalConfig {
  tipos_disponiveis?: ("crioterapia" | "laser" | "calor")[];
  descricao?: string;
  temp_min_cryo?: number;
  temp_max_cryo?: number;
  potencia_max_laser?: number;
  temp_min_calor?: number;
  temp_max_calor?: number;
}

interface ThermalLabProps {
  config: ThermalConfig;
}

export function ThermalLab({ config }: ThermalLabProps) {
  const tipos = config.tipos_disponiveis || ["crioterapia", "laser"];
  const [tipoAtivo, setTipoAtivo] = useState(tipos[0]);
  
  // Crioterapia
  const [tempCryo, setTempCryo] = useState(0);
  const [tempoCryo, setTempoCryo] = useState(10);
  
  // Laser
  const [potenciaLaser, setPotenciaLaser] = useState(3);
  const [tempoLaser, setTempoLaser] = useState(5);
  
  // Calor
  const [tempCalor, setTempCalor] = useState(40);
  const [tempoCalor, setTempoCalor] = useState(15);

  const tempMinCryo = config.temp_min_cryo || -10;
  const tempMaxCryo = config.temp_max_cryo || 15;
  const potenciaMaxLaser = config.potencia_max_laser || 10;
  const tempMinCalor = config.temp_min_calor || 35;
  const tempMaxCalor = config.temp_max_calor || 50;

  const getCryoInfo = () => {
    if (tempCryo < 0) {
      return {
        efeito: "Crioterapia Intensa",
        fisiologia: "Vasoconstrição profunda, redução metabólica acentuada",
        indicacao: "Fase aguda de lesão, controle de edema intenso",
        tempo: "5-10 minutos para evitar dano tecidual",
      };
    } else if (tempCryo <= 10) {
      return {
        efeito: "Crioterapia Moderada",
        fisiologia: "Vasoconstrição, analgesia por redução de condução nervosa",
        indicacao: "Dor, inflamação moderada, pós-treino",
        tempo: "10-15 minutos, seguro e eficaz",
      };
    } else {
      return {
        efeito: "Resfriamento Leve",
        fisiologia: "Efeito refrescante, vasoconstrição superficial",
        indicacao: "Desconforto leve, recuperação pós-exercício",
        tempo: "15-20 minutos",
      };
    }
  };

  const getLaserInfo = () => {
    if (potenciaLaser < 3) {
      return {
        tipo: "Laser de Baixa Potência",
        efeito: "Bioestimulação, reparo tecidual",
        penetracao: "Superficial a média (até 2cm)",
        aplicacao: "Cicatrização, modulação inflamatória leve",
      };
    } else if (potenciaLaser <= 6) {
      return {
        tipo: "Laser de Média Potência",
        efeito: "Analgesia, bioestimulação mais intensa",
        penetracao: "Média (até 3-4cm)",
        aplicacao: "Dor musculoesquelética, tendinopatias",
      };
    } else {
      return {
        tipo: "Laser de Alta Potência",
        efeito: "Analgesia profunda, efeito térmico leve",
        penetracao: "Profunda (até 5cm ou mais)",
        aplicacao: "Lesões profundas, articulações, dor crônica",
      };
    }
  };

  const getCalorInfo = () => {
    if (tempCalor < 38) {
      return {
        nivel: "Calor Suave",
        efeito: "Relaxamento leve, conforto",
        indicacao: "Aquecimento inicial, preparação",
        cuidado: "Pouco efeito terapêutico profundo",
      };
    } else if (tempCalor <= 42) {
      return {
        nivel: "Calor Terapêutico",
        efeito: "Vasodilatação, aumento de metabolismo local",
        indicacao: "Contraturas, dor crônica, rigidez",
        cuidado: "Monitorar sensibilidade do paciente",
      };
    } else {
      return {
        nivel: "Calor Intenso",
        efeito: "Vasodilatação intensa, analgesia profunda",
        indicacao: "Casos selecionados, rigidez severa",
        cuidado: "Risco de queimadura, usar com precaução",
      };
    }
  };

  const cryoInfo = getCryoInfo();
  const laserInfo = getLaserInfo();
  const calorInfo = getCalorInfo();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Simulador de Recursos Térmicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.descricao && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{config.descricao}</AlertDescription>
            </Alert>
          )}

          <Tabs value={tipoAtivo} onValueChange={(v) => setTipoAtivo(v as any)}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tipos.length}, 1fr)` }}>
              {tipos.includes("crioterapia") && (
                <TabsTrigger value="crioterapia">
                  <Snowflake className="h-4 w-4 mr-2" />
                  Crioterapia
                </TabsTrigger>
              )}
              {tipos.includes("laser") && (
                <TabsTrigger value="laser">
                  <Laser className="h-4 w-4 mr-2" />
                  Laser
                </TabsTrigger>
              )}
              {tipos.includes("calor") && (
                <TabsTrigger value="calor">
                  <Thermometer className="h-4 w-4 mr-2" />
                  Calor
                </TabsTrigger>
              )}
            </TabsList>

            {/* Crioterapia */}
            {tipos.includes("crioterapia") && (
              <TabsContent value="crioterapia" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Temperatura (°C)</Label>
                    <Badge variant="secondary">{tempCryo}°C</Badge>
                  </div>
                  <Slider
                    value={[tempCryo]}
                    onValueChange={([v]) => setTempCryo(v)}
                    min={tempMinCryo}
                    max={tempMaxCryo}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Tempo de Aplicação (min)</Label>
                    <Badge variant="secondary">{tempoCryo} min</Badge>
                  </div>
                  <Slider
                    value={[tempoCryo]}
                    onValueChange={([v]) => setTempoCryo(v)}
                    min={5}
                    max={30}
                    step={5}
                  />
                </div>

                <Card className="bg-blue-50 dark:bg-blue-950/30">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div><strong>{cryoInfo.efeito}</strong></div>
                    <div><strong>Fisiologia:</strong> {cryoInfo.fisiologia}</div>
                    <div><strong>Indicação:</strong> {cryoInfo.indicacao}</div>
                    <div><strong>Tempo sugerido:</strong> {cryoInfo.tempo}</div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Laser */}
            {tipos.includes("laser") && (
              <TabsContent value="laser" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Potência (W)</Label>
                    <Badge variant="secondary">{potenciaLaser}W</Badge>
                  </div>
                  <Slider
                    value={[potenciaLaser]}
                    onValueChange={([v]) => setPotenciaLaser(v)}
                    min={1}
                    max={potenciaMaxLaser}
                    step={0.5}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Tempo de Aplicação (min)</Label>
                    <Badge variant="secondary">{tempoLaser} min</Badge>
                  </div>
                  <Slider
                    value={[tempoLaser]}
                    onValueChange={([v]) => setTempoLaser(v)}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>

                <Card className="bg-red-50 dark:bg-red-950/30">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div><strong>{laserInfo.tipo}</strong></div>
                    <div><strong>Efeito:</strong> {laserInfo.efeito}</div>
                    <div><strong>Penetração:</strong> {laserInfo.penetracao}</div>
                    <div><strong>Aplicação:</strong> {laserInfo.aplicacao}</div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Calor */}
            {tipos.includes("calor") && (
              <TabsContent value="calor" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Temperatura (°C)</Label>
                    <Badge variant="secondary">{tempCalor}°C</Badge>
                  </div>
                  <Slider
                    value={[tempCalor]}
                    onValueChange={([v]) => setTempCalor(v)}
                    min={tempMinCalor}
                    max={tempMaxCalor}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Tempo de Aplicação (min)</Label>
                    <Badge variant="secondary">{tempoCalor} min</Badge>
                  </div>
                  <Slider
                    value={[tempoCalor]}
                    onValueChange={([v]) => setTempoCalor(v)}
                    min={5}
                    max={30}
                    step={5}
                  />
                </div>

                <Card className="bg-orange-50 dark:bg-orange-950/30">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div><strong>{calorInfo.nivel}</strong></div>
                    <div><strong>Efeito:</strong> {calorInfo.efeito}</div>
                    <div><strong>Indicação:</strong> {calorInfo.indicacao}</div>
                    <div><strong>Cuidado:</strong> {calorInfo.cuidado}</div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
