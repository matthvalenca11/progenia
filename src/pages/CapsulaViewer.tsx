import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { capsulaService, Capsula } from "@/services/capsulaService";
import { gamificationService } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { MRIViewer } from "@/components/labs/MRIViewer";
import { UltrasoundSimulator } from "@/components/labs/UltrasoundSimulator";
import { UltrasoundSimulatorAdvanced } from "@/components/labs/UltrasoundSimulatorAdvanced";
import { EletroterapiaLab } from "@/components/labs/EletroterapiaLab";
import { ThermalLab } from "@/components/labs/ThermalLab";

export default function CapsulaViewer() {
  const { capsulaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [capsula, setCapsula] = useState<Capsula | null>(null);
  const [visualUrl, setVisualUrl] = useState<string>("");
  const [respostas, setRespostas] = useState<Map<string, string[]>>(new Map());
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [concluida, setConcluida] = useState(false);
  const [tentativas, setTentativas] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (capsulaId) {
      loadCapsula();
    }
  }, [capsulaId, user]);

  const loadCapsula = async () => {
    try {
      setLoading(true);
      const data = await capsulaService.getCapsulaById(capsulaId!);
      
      if (!data) {
        toast({ title: "Cápsula não encontrada", variant: "destructive" });
        return;
      }

      setCapsula(data);

      // Carregar visual se não for lab
      if (data.visual_path && data.tipo_visual !== "lab") {
        const url = await capsulaService.getVisualUrl(
          data.tipo_visual as "imagem" | "video",
          data.visual_path
        );
        setVisualUrl(url);
      }

      // Verificar se já foi concluída
      if (user) {
        const progresso = await capsulaService.getProgresso(user.id, capsulaId!);
        setConcluida(progresso?.concluida || false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar cápsula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRespostaChange = (perguntaId: string, alternativaId: string, checked: boolean) => {
    const novasRespostas = new Map(respostas);
    const respostasPergunta = novasRespostas.get(perguntaId) || [];
    
    const pergunta = capsula?.perguntas?.find(p => p.id === perguntaId);
    
    if (pergunta?.tipo === "multipla") {
      if (checked) {
        respostasPergunta.push(alternativaId);
      } else {
        const index = respostasPergunta.indexOf(alternativaId);
        if (index > -1) respostasPergunta.splice(index, 1);
      }
      novasRespostas.set(perguntaId, respostasPergunta);
    } else {
      novasRespostas.set(perguntaId, [alternativaId]);
    }
    
    setRespostas(novasRespostas);
  };

  const handleSubmitQuiz = async () => {
    if (!capsula?.perguntas || !user) return;

    let totalAcertos = 0;
    
    for (const pergunta of capsula.perguntas) {
      const respostasPergunta = respostas.get(pergunta.id!) || [];
      const alternativasCorretas = pergunta.alternativas?.filter(a => a.correta).map(a => a.id!) || [];
      
      const acertou = 
        respostasPergunta.length === alternativasCorretas.length &&
        respostasPergunta.every(r => alternativasCorretas.includes(r));
      
      if (acertou) totalAcertos++;
    }

    setAcertos(totalAcertos);
    setMostrarResultados(true);
    setTentativas(prev => prev + 1);

    // Salvar resultado
    try {
      await capsulaService.salvarRespostaQuiz(
        user.id,
        capsulaId!,
        totalAcertos,
        capsula.perguntas.length
      );

      // Marcar como concluída se acertou tudo
      if (totalAcertos === capsula.perguntas.length) {
        await capsulaService.marcarConcluida(user.id, capsulaId!);
        setConcluida(true);
        
        // Conceder pontos de gamificação
        const acertouNaPrimeira = tentativas === 0;
        await gamificationService.rewardCapsulaCompletion(
          user.id,
          capsulaId!,
          acertouNaPrimeira
        );
        
        toast({
          title: "🎉 Parabéns!",
          description: acertouNaPrimeira 
            ? "Cápsula concluída com sucesso! +10 XP (acertou na primeira!)" 
            : "Cápsula concluída com sucesso! +5 XP",
        });
      }
    } catch (error: any) {
      console.error("Erro ao salvar resultado:", error);
    }
  };

  const handleProximaCapsula = async () => {
    if (!capsula) return;

    // Buscar próxima cápsula do módulo
    try {
      const capsulas = await capsulaService.getCapsulasByModulo(capsula.modulo_id);
      const currentIndex = capsulas.findIndex(c => c.id === capsulaId);
      
      if (currentIndex < capsulas.length - 1) {
        const proximaCapsula = capsulas[currentIndex + 1];
        navigate(`/capsula/${proximaCapsula.id}`);
        // Reset state
        setRespostas(new Map());
        setMostrarResultados(false);
        setAcertos(0);
        setConcluida(false);
      } else {
        toast({
          title: "Fim do módulo",
          description: "Você completou todas as cápsulas!",
        });
        navigate(`/modulo/${capsula.modulo_id}/capsulas`);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar próxima cápsula",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderLab = () => {
    if (!capsula?.tipo_lab) return null;

    const defaultConfig = {};

    switch (capsula.tipo_lab) {
      case "mri_viewer":
        return <MRIViewer config={defaultConfig} />;
      case "ultrasound_simulator":
        return <UltrasoundSimulator config={capsula.ultrasound_lab_config || defaultConfig} />;
      case "ultrassom_avancado":
        return <UltrasoundSimulatorAdvanced config={capsula.ultrasound_lab_config as any} />;
      case "eletroterapia_lab":
        return <EletroterapiaLab config={defaultConfig} />;
      case "thermal_lab":
        return <ThermalLab config={defaultConfig} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando cápsula...</p>
      </div>
    );
  }

  if (!capsula) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cápsula não encontrada</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/modulo/${capsula.modulo_id}/capsulas`)}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar ao módulo
      </Button>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary">{capsula.categoria}</Badge>
            {concluida && (
              <Badge className="bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Concluída
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-3">{capsula.titulo}</h1>
          <div className="p-4 bg-primary/10 border-l-4 border-primary rounded-r">
            <p className="text-lg font-medium text-primary">{capsula.pergunta_gatilho}</p>
          </div>
        </div>

        {/* Texto Explicativo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Explicação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed whitespace-pre-wrap">{capsula.texto_curto}</p>
          </CardContent>
        </Card>

        {/* Elemento Visual */}
        {capsula.tipo_visual === "lab" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Laboratório Virtual
              </CardTitle>
            </CardHeader>
            <CardContent>{renderLab()}</CardContent>
          </Card>
        ) : visualUrl ? (
          <Card>
            <CardContent className="p-0">
              {capsula.tipo_visual === "video" ? (
                <video src={visualUrl} controls className="w-full rounded-lg" />
              ) : (
                <img src={visualUrl} alt={capsula.titulo} className="w-full rounded-lg" />
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Micro-Quiz */}
        {capsula.perguntas && capsula.perguntas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {mostrarResultados
                  ? `Resultado: ${acertos}/${capsula.perguntas.length} acertos`
                  : "Micro-Quiz"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {capsula.perguntas.map((pergunta, pIndex) => {
                const respostasPergunta = respostas.get(pergunta.id!) || [];
                const alternativasCorretas = pergunta.alternativas?.filter(a => a.correta) || [];
                const acertouPergunta = mostrarResultados && (
                  respostasPergunta.length === alternativasCorretas.length &&
                  respostasPergunta.every(r => alternativasCorretas.some(a => a.id === r))
                );

                return (
                  <div key={pergunta.id} className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">{pIndex + 1}.</span>
                      <p className="flex-1 font-medium">{pergunta.enunciado}</p>
                      {mostrarResultados && (
                        <Badge variant={acertouPergunta ? "default" : "destructive"}>
                          {acertouPergunta ? "Correto" : "Incorreto"}
                        </Badge>
                      )}
                    </div>

                    {pergunta.tipo === "multipla" ? (
                      <div className="space-y-2 pl-6">
                        {pergunta.alternativas?.map((alternativa) => {
                          const selecionada = respostasPergunta.includes(alternativa.id!);
                          const correta = alternativa.correta;

                          return (
                            <div
                              key={alternativa.id}
                              className={`flex items-start gap-3 p-3 rounded ${
                                mostrarResultados
                                  ? correta
                                    ? "bg-green-50 dark:bg-green-900/20"
                                    : selecionada
                                    ? "bg-red-50 dark:bg-red-900/20"
                                    : ""
                                  : "hover:bg-accent"
                              }`}
                            >
                              <Checkbox
                                checked={selecionada}
                                onCheckedChange={(checked) =>
                                  handleRespostaChange(pergunta.id!, alternativa.id!, !!checked)
                                }
                                disabled={mostrarResultados}
                              />
                              <div className="flex-1">
                                <Label className="cursor-pointer">{alternativa.texto}</Label>
                                {mostrarResultados && alternativa.micro_feedback && (selecionada || correta) && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {alternativa.micro_feedback}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <RadioGroup
                        value={respostasPergunta[0] || ""}
                        onValueChange={(value) => handleRespostaChange(pergunta.id!, value, true)}
                        disabled={mostrarResultados}
                        className="pl-6 space-y-2"
                      >
                        {pergunta.alternativas?.map((alternativa) => {
                          const selecionada = respostasPergunta.includes(alternativa.id!);
                          const correta = alternativa.correta;

                          return (
                            <div
                              key={alternativa.id}
                              className={`flex items-start gap-3 p-3 rounded ${
                                mostrarResultados
                                  ? correta
                                    ? "bg-green-50 dark:bg-green-900/20"
                                    : selecionada
                                    ? "bg-red-50 dark:bg-red-900/20"
                                    : ""
                                  : "hover:bg-accent"
                              }`}
                            >
                              <RadioGroupItem value={alternativa.id!} disabled={mostrarResultados} />
                              <div className="flex-1">
                                <Label className="cursor-pointer">{alternativa.texto}</Label>
                                {mostrarResultados && alternativa.micro_feedback && (selecionada || correta) && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {alternativa.micro_feedback}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    )}
                  </div>
                );
              })}

              {!mostrarResultados && (
                <Button onClick={handleSubmitQuiz} className="w-full" size="lg">
                  Enviar Respostas
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Takeaway */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lightbulb className="w-5 h-5" />
              Resumo de Bolso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">{capsula.takeaway}</p>
          </CardContent>
        </Card>

        {/* Navegação */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/modulo/${capsula.modulo_id}/capsulas`)}
            className="flex-1"
          >
            Voltar ao Módulo
          </Button>
          <Button onClick={handleProximaCapsula} className="flex-1">
            Próxima Cápsula
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
