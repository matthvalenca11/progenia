import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EletroterapiaConfig {
  frequencia_min?: number;
  frequencia_max?: number;
  largura_pulso_min?: number;
  largura_pulso_max?: number;
  intensidade_max?: number;
  descricao?: string;
  indicacoes?: string[];
  contraindicacoes?: string[];
}

interface EletroterapiaLabProps {
  config: EletroterapiaConfig;
}

export function EletroterapiaLab({ config }: EletroterapiaLabProps) {
  const [frequencia, setFrequencia] = useState(50);
  const [larguraPulso, setLarguraPulso] = useState(200);
  const [intensidade, setIntensidade] = useState(10);

  const frequenciaMin = config.frequencia_min || 1;
  const frequenciaMax = config.frequencia_max || 200;
  const larguraPulsoMin = config.largura_pulso_min || 50;
  const larguraPulsoMax = config.largura_pulso_max || 500;
  const intensidadeMax = config.intensidade_max || 50;

  const getFrequenciaInfo = () => {
    if (frequencia < 10) {
      return {
        tipo: "Baixa Frequência (< 10 Hz)",
        efeito: "Estimulação motora, fortalecimento muscular",
        sensacao: "Contração muscular visível e forte",
        aplicacao: "Reabilitação de músculos enfraquecidos",
      };
    } else if (frequencia <= 50) {
      return {
        tipo: "Média Frequência (10-50 Hz)",
        efeito: "Efeito misto: motor e sensorial",
        sensacao: "Contração muscular com formigamento",
        aplicacao: "Treino de resistência, condicionamento",
      };
    } else if (frequencia <= 100) {
      return {
        tipo: "Alta Frequência (50-100 Hz)",
        efeito: "Predominantemente analgésico",
        sensacao: "Formigamento intenso, pouca contração",
        aplicacao: "Controle de dor aguda e crônica",
      };
    } else {
      return {
        tipo: "Muito Alta Frequência (> 100 Hz)",
        efeito: "Bloqueio de dor, efeito sensorial intenso",
        sensacao: "Vibração/formigamento muito rápido",
        aplicacao: "Analgesia rápida, modulação de dor",
      };
    }
  };

  const getLarguraPulsoInfo = () => {
    if (larguraPulso < 100) {
      return {
        caracteristica: "Pulso Curto",
        recrutamento: "Fibras nervosas superficiais (Aα)",
        conforto: "Mais confortável, menos penetração",
      };
    } else if (larguraPulso <= 300) {
      return {
        caracteristica: "Pulso Médio",
        recrutamento: "Recrutamento balanceado",
        conforto: "Boa relação conforto/eficácia",
      };
    } else {
      return {
        caracteristica: "Pulso Longo",
        recrutamento: "Fibras profundas, maior recrutamento motor",
        conforto: "Pode ser menos confortável, mais efetivo",
      };
    }
  };

  const getIntensidadeInfo = () => {
    if (intensidade < 15) {
      return {
        nivel: "Intensidade Baixa",
        percepcao: "Formigamento leve, sem contração visível",
        uso: "Início de tratamento, sensibilização",
      };
    } else if (intensidade <= 30) {
      return {
        nivel: "Intensidade Moderada",
        percepcao: "Contração muscular leve a moderada",
        uso: "Fortalecimento, manutenção",
      };
    } else {
      return {
        nivel: "Intensidade Alta",
        percepcao: "Contração muscular forte e visível",
        uso: "Fortalecimento intensivo, atletas",
      };
    }
  };

  const frequenciaInfo = getFrequenciaInfo();
  const larguraPulsoInfo = getLarguraPulsoInfo();
  const intensidadeInfo = getIntensidadeInfo();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Simulador de Eletroterapia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.descricao && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{config.descricao}</AlertDescription>
            </Alert>
          )}

          {/* Frequência */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Frequência (Hz)</Label>
              <Badge variant="secondary">{frequencia} Hz</Badge>
            </div>
            <Slider
              value={[frequencia]}
              onValueChange={([v]) => setFrequencia(v)}
              min={frequenciaMin}
              max={frequenciaMax}
              step={1}
            />
            <Card className="bg-accent/50">
              <CardContent className="p-4 space-y-2 text-sm">
                <div>
                  <strong>{frequenciaInfo.tipo}</strong>
                </div>
                <div><strong>Efeito:</strong> {frequenciaInfo.efeito}</div>
                <div><strong>Sensação:</strong> {frequenciaInfo.sensacao}</div>
                <div><strong>Aplicação:</strong> {frequenciaInfo.aplicacao}</div>
              </CardContent>
            </Card>
          </div>

          {/* Largura de Pulso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Largura de Pulso (μs)</Label>
              <Badge variant="secondary">{larguraPulso} μs</Badge>
            </div>
            <Slider
              value={[larguraPulso]}
              onValueChange={([v]) => setLarguraPulso(v)}
              min={larguraPulsoMin}
              max={larguraPulsoMax}
              step={10}
            />
            <Card className="bg-accent/50">
              <CardContent className="p-4 space-y-2 text-sm">
                <div>
                  <strong>{larguraPulsoInfo.caracteristica}</strong>
                </div>
                <div><strong>Recrutamento:</strong> {larguraPulsoInfo.recrutamento}</div>
                <div><strong>Conforto:</strong> {larguraPulsoInfo.conforto}</div>
              </CardContent>
            </Card>
          </div>

          {/* Intensidade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Intensidade (mA)</Label>
              <Badge variant="secondary">{intensidade} mA</Badge>
            </div>
            <Slider
              value={[intensidade]}
              onValueChange={([v]) => setIntensidade(v)}
              min={1}
              max={intensidadeMax}
              step={1}
            />
            <Card className="bg-accent/50">
              <CardContent className="p-4 space-y-2 text-sm">
                <div>
                  <strong>{intensidadeInfo.nivel}</strong>
                </div>
                <div><strong>Percepção:</strong> {intensidadeInfo.percepcao}</div>
                <div><strong>Uso:</strong> {intensidadeInfo.uso}</div>
              </CardContent>
            </Card>
          </div>

          {/* Indicações e Contraindicações */}
          {(config.indicacoes || config.contraindicacoes) && (
            <div className="grid md:grid-cols-2 gap-4">
              {config.indicacoes && config.indicacoes.length > 0 && (
                <Card className="border-green-500/50">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2 text-green-600">Indicações</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {config.indicacoes.map((ind, i) => (
                        <li key={i}>{ind}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {config.contraindicacoes && config.contraindicacoes.length > 0 && (
                <Card className="border-red-500/50">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2 text-red-600">Contraindicações</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {config.contraindicacoes.map((contra, i) => (
                        <li key={i}>{contra}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
