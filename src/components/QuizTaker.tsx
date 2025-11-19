import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { quizService, Quiz, QuizPergunta, QuizAlternativa } from "@/services/quizService";
import { quizGamificationService } from "@/services/quizGamificationService";
import { progressService } from "@/services/progressService";
import { useAuth } from "@/hooks/useAuth";
import { Clock, CheckCircle, XCircle, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QuizTakerProps {
  quizId: string;
  moduleId?: string;
  onComplete?: () => void;
}

interface RespostaLocal {
  perguntaId: string;
  alternativaSelecionada?: string;
  alternativasSelecionadas?: string[];
  textoResposta?: string;
  tempoResposta: number;
}

export default function QuizTaker({ quizId, moduleId, onComplete }: QuizTakerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [perguntas, setPerguntas] = useState<(QuizPergunta & { alternativas: QuizAlternativa[] })[]>([]);
  const [perguntasEmbaralhadas, setPerguntasEmbaralhadas] = useState<(QuizPergunta & { alternativas: QuizAlternativa[] })[]>([]);
  const [tentativasAnteriores, setTentativasAnteriores] = useState<number>(0);
  const [podeTentar, setPodeTentar] = useState(true);
  
  const [quizIniciado, setQuizIniciado] = useState(false);
  const [perguntaAtual, setPerguntaAtual] = useState(0);
  const [respostas, setRespostas] = useState<RespostaLocal[]>([]);
  const [tempoInicio, setTempoInicio] = useState<number>(0);
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [perguntaInicioTempo, setPerguntaInicioTempo] = useState<number>(0);
  
  const [resultado, setResultado] = useState<{
    pontuacao: number;
    acertos: number;
    erros: number;
    aprovado: boolean;
    recomendacoes?: string;
  } | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz?.tempo_limite_segundos && quizIniciado && tempoRestante !== null) {
      const interval = setInterval(() => {
        setTempoRestante((prev) => {
          if (prev === null || prev <= 0) {
            finalizarQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quiz, quizIniciado, tempoRestante]);

  const loadQuiz = async () => {
    if (!user) return;

    try {
      const quizData = await quizService.getQuizById(quizId);
      if (!quizData) {
        toast({ title: "Quiz não encontrado", variant: "destructive" });
        return;
      }
      setQuiz(quizData);

      const perguntasData = await quizService.getPerguntasByQuiz(quizId);
      setPerguntas(perguntasData);

      const attempts = await quizService.getUserAttempts(user.id, quizId);
      setTentativasAnteriores(attempts.length);
      setPodeTentar(attempts.length < quizData.tentativas_maximas);
    } catch (error) {
      console.error("Erro ao carregar quiz:", error);
      toast({ title: "Erro ao carregar quiz", variant: "destructive" });
    }
  };

  const iniciarQuiz = () => {
    let perguntasParaUsar = [...perguntas];

    // Embaralhar perguntas se configurado
    if (quiz?.aleatorizar_ordem_perguntas) {
      perguntasParaUsar = perguntasParaUsar.sort(() => Math.random() - 0.5);
    }

    // Embaralhar alternativas se configurado
    if (quiz?.aleatorizar_ordem_alternativas) {
      perguntasParaUsar = perguntasParaUsar.map(p => ({
        ...p,
        alternativas: [...p.alternativas].sort(() => Math.random() - 0.5)
      }));
    }

    setPerguntasEmbaralhadas(perguntasParaUsar);
    setQuizIniciado(true);
    setTempoInicio(Date.now());
    setPerguntaInicioTempo(Date.now());
    
    if (quiz?.tempo_limite_segundos) {
      setTempoRestante(quiz.tempo_limite_segundos);
    }

    setRespostas([]);
    setPerguntaAtual(0);
  };

  const registrarResposta = (perguntaId: string, resposta: Partial<RespostaLocal>) => {
    const tempoResposta = Math.floor((Date.now() - perguntaInicioTempo) / 1000);
    
    setRespostas((prev) => {
      const existing = prev.findIndex(r => r.perguntaId === perguntaId);
      const novaResposta: RespostaLocal = {
        perguntaId,
        tempoResposta,
        ...resposta,
      };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = novaResposta;
        return updated;
      }
      return [...prev, novaResposta];
    });
  };

  const proximaPergunta = () => {
    if (perguntaAtual < perguntasEmbaralhadas.length - 1) {
      setPerguntaAtual(perguntaAtual + 1);
      setPerguntaInicioTempo(Date.now());
    } else {
      finalizarQuiz();
    }
  };

  const voltarPergunta = () => {
    if (quiz?.modo_de_navegacao === 'livre' && perguntaAtual > 0) {
      setPerguntaAtual(perguntaAtual - 1);
      setPerguntaInicioTempo(Date.now());
    }
  };

  const finalizarQuiz = async () => {
    if (!user || !quiz || finalizando) return;

    setFinalizando(true);
    try {
      const tempoTotal = Math.floor((Date.now() - tempoInicio) / 1000);
      
      // Calcular pontuação
      let acertos = 0;
      let erros = 0;
      const respostasParaSalvar: any[] = [];

      for (const resposta of respostas) {
        const pergunta = perguntasEmbaralhadas.find(p => p.id === resposta.perguntaId);
        if (!pergunta) continue;

        let correta = false;

        if (pergunta.tipo === 'unica') {
          const alternativa = pergunta.alternativas.find(a => a.id === resposta.alternativaSelecionada);
          correta = alternativa?.correta || false;
        } else if (pergunta.tipo === 'multipla') {
          const corretas = pergunta.alternativas.filter(a => a.correta).map(a => a.id);
          const selecionadas = resposta.alternativasSelecionadas || [];
          correta = corretas.length === selecionadas.length && 
                   corretas.every(c => selecionadas.includes(c));
        }
        // dissertativa-curta não é corrigida automaticamente

        respostasParaSalvar.push({
          perguntaId: resposta.perguntaId,
          alternativaId: resposta.alternativaSelecionada,
          correta,
          tempoResposta: resposta.tempoResposta
        });

        if (correta) acertos++;
        else erros++;
      }

      const totalPerguntas = perguntasEmbaralhadas.filter(p => p.tipo !== 'dissertativa-curta').length;
      const pontuacao = totalPerguntas > 0 ? (acertos / totalPerguntas) * 100 : 0;
      const aprovado = pontuacao >= quiz.nota_minima_aprovacao;

      // Salvar tentativa
      const tentativa = await quizService.createAttempt({
        quiz_id: quizId,
        usuario_id: user.id,
        numero_tentativa: tentativasAnteriores + 1,
        pontuacao_percentual: pontuacao,
        acertos,
        erros,
        aprovado,
        tempo_gasto_segundos: tempoTotal,
      });

      // Salvar respostas individuais
      for (const resposta of respostasParaSalvar) {
        await quizService.saveAttemptAnswer({
          tentativa_id: tentativa.id,
          pergunta_id: resposta.perguntaId,
          alternativa_id_escolhida: resposta.alternativaId || null,
          resposta_texto: null,
          correta: resposta.correta,
          tempo_resposta_segundos: resposta.tempoResposta,
        });
      }

      // Atualizar métricas
      await quizService.updateMetrics(user.id, quizId, tentativa, respostasParaSalvar);

      // Gerar recomendações
      const metricas = await quizService.getUserMetrics(user.id, quizId);
      if (metricas) {
        await quizService.generateRecommendations(user.id, quizId, metricas);
      }

      // Gamificação
      await quizGamificationService.awardQuizPoints(
        user.id,
        quizId,
        respostasParaSalvar.map(r => ({ pergunta_id: r.perguntaId, correta: r.correta })),
        aprovado,
        tentativasAnteriores + 1 === quiz.tentativas_maximas
      );

      await quizGamificationService.checkAndAwardQuizBadges(user.id, quizId, {
        numero_tentativa: tentativasAnteriores + 1,
        pontuacao_percentual: pontuacao,
        aprovado,
        tempo_gasto_segundos: tempoTotal
      });

      // Marcar aula como concluída se aprovado
      if (aprovado && quiz.aula_id) {
        await progressService.completeLesson(user.id, quiz.aula_id);
      }

      // Buscar recomendações
      const recomendacoes = await quizService.getUserRecommendations(user.id, quizId);
      const recomendacaoTexto = recomendacoes[0]?.recomendacao_gerada || '';

      setResultado({
        pontuacao,
        acertos,
        erros,
        aprovado,
        recomendacoes: recomendacaoTexto
      });

      toast({
        title: aprovado ? "Parabéns! Você foi aprovado!" : "Não foi dessa vez",
        description: aprovado 
          ? `Você acertou ${acertos} de ${totalPerguntas} questões` 
          : `Você precisa de ${quiz.nota_minima_aprovacao}% para passar`,
      });

    } catch (error) {
      console.error("Erro ao finalizar quiz:", error);
      toast({ title: "Erro ao finalizar quiz", variant: "destructive" });
    } finally {
      setFinalizando(false);
    }
  };

  if (!quiz || perguntas.length === 0) {
    return <div className="text-center py-8">Carregando quiz...</div>;
  }

  // Tela de resultado
  if (resultado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {resultado.aprovado ? (
              <><Trophy className="w-6 h-6 text-yellow-500" /> Parabéns!</>
            ) : (
              <><AlertCircle className="w-6 h-6 text-orange-500" /> Continue tentando!</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <div className="text-3xl font-bold text-primary">{resultado.pontuacao.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">Pontuação</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-3xl font-bold text-green-600">{resultado.acertos}</div>
              <div className="text-sm text-muted-foreground">Acertos</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-3xl font-bold text-red-600">{resultado.erros}</div>
              <div className="text-sm text-muted-foreground">Erros</div>
            </div>
          </div>

          {resultado.aprovado ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Você atingiu a nota mínima de {quiz.nota_minima_aprovacao}% e foi aprovado neste quiz!
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-orange-50 border-orange-200">
              <XCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Você precisa de {quiz.nota_minima_aprovacao}% para ser aprovado. 
                {podeTentar && tentativasAnteriores < quiz.tentativas_maximas && 
                  ` Você ainda tem ${quiz.tentativas_maximas - tentativasAnteriores - 1} tentativa(s).`
                }
              </AlertDescription>
            </Alert>
          )}

          {resultado.recomendacoes && (
            <Alert className="bg-blue-50 border-blue-200">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Recomendações:</strong> {resultado.recomendacoes}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 justify-center">
            {tentativasAnteriores < quiz.tentativas_maximas - 1 && !resultado.aprovado && (
              <Button onClick={() => {
                setResultado(null);
                setQuizIniciado(false);
                loadQuiz();
              }}>
                Tentar Novamente
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                if (moduleId) {
                  navigate(`/module/${moduleId}`);
                } else if (onComplete) {
                  onComplete();
                }
              }}
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Tela de início
  if (!quizIniciado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{quiz.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz.descricao && (
            <p className="text-muted-foreground">{quiz.descricao}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Nota Mínima</div>
              <div className="text-2xl font-bold">{quiz.nota_minima_aprovacao}%</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Tentativas</div>
              <div className="text-2xl font-bold">{tentativasAnteriores} / {quiz.tentativas_maximas}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Perguntas</div>
              <div className="text-2xl font-bold">{perguntas.length}</div>
            </div>
            {quiz.tempo_limite_segundos && (
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Tempo Limite</div>
                <div className="text-2xl font-bold">{Math.floor(quiz.tempo_limite_segundos / 60)}min</div>
              </div>
            )}
          </div>

          {!podeTentar ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você já usou todas as {quiz.tentativas_maximas} tentativas disponíveis para este quiz.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Modo: {quiz.modo_de_navegacao === 'livre' ? 'Livre' : 'Sequencial'}</Badge>
                {quiz.aleatorizar_ordem_perguntas && <Badge variant="outline">Ordem aleatória</Badge>}
                {quiz.feedback_imediato && <Badge variant="outline">Feedback imediato</Badge>}
              </div>

              <Button onClick={iniciarQuiz} className="w-full" size="lg">
                Iniciar Quiz
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Quiz em andamento
  const pergunta = perguntasEmbaralhadas[perguntaAtual];
  const progresso = ((perguntaAtual + 1) / perguntasEmbaralhadas.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Pergunta {perguntaAtual + 1} de {perguntasEmbaralhadas.length}</CardTitle>
            {tempoRestante !== null && (
              <Badge variant={tempoRestante < 60 ? "destructive" : "outline"} className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {Math.floor(tempoRestante / 60)}:{(tempoRestante % 60).toString().padStart(2, '0')}
              </Badge>
            )}
          </div>
          <Progress value={progresso} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Badge>{pergunta.nivel_dificuldade}</Badge>
            {pergunta.tags && pergunta.tags.map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
          <p className="text-lg">{pergunta.enunciado}</p>
          {pergunta.imagem_url && (
            <img src={pergunta.imagem_url} alt="Imagem da questão" className="rounded-lg max-w-full" />
          )}
        </div>

        {pergunta.tipo === 'unica' && (
          <RadioGroup
            value={respostas.find(r => r.perguntaId === pergunta.id)?.alternativaSelecionada || ''}
            onValueChange={(value) => registrarResposta(pergunta.id, { alternativaSelecionada: value })}
          >
            {pergunta.alternativas.map((alt) => (
              <div key={alt.id} className="flex items-start space-x-2 p-3 border rounded hover:bg-accent">
                <RadioGroupItem value={alt.id} id={alt.id} />
                <Label htmlFor={alt.id} className="flex-1 cursor-pointer">
                  {alt.texto}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {pergunta.tipo === 'multipla' && (
          <div className="space-y-2">
            {pergunta.alternativas.map((alt) => {
              const selecionadas = respostas.find(r => r.perguntaId === pergunta.id)?.alternativasSelecionadas || [];
              const checked = selecionadas.includes(alt.id);

              return (
                <div key={alt.id} className="flex items-start space-x-2 p-3 border rounded hover:bg-accent">
                  <Checkbox
                    id={alt.id}
                    checked={checked}
                    onCheckedChange={(checkedValue) => {
                      const novasSelecionadas = checkedValue
                        ? [...selecionadas, alt.id]
                        : selecionadas.filter(id => id !== alt.id);
                      registrarResposta(pergunta.id, { alternativasSelecionadas: novasSelecionadas });
                    }}
                  />
                  <Label htmlFor={alt.id} className="flex-1 cursor-pointer">
                    {alt.texto}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {pergunta.tipo === 'dissertativa-curta' && (
          <Textarea
            placeholder="Digite sua resposta..."
            value={respostas.find(r => r.perguntaId === pergunta.id)?.textoResposta || ''}
            onChange={(e) => registrarResposta(pergunta.id, { textoResposta: e.target.value })}
            rows={5}
          />
        )}

        <div className="flex justify-between gap-4">
          {quiz.modo_de_navegacao === 'livre' && perguntaAtual > 0 && (
            <Button variant="outline" onClick={voltarPergunta}>
              Voltar
            </Button>
          )}
          <div className="flex-1" />
          {perguntaAtual < perguntasEmbaralhadas.length - 1 ? (
            <Button onClick={proximaPergunta}>
              Próxima
            </Button>
          ) : (
            <Button onClick={finalizarQuiz} disabled={finalizando}>
              {finalizando ? "Finalizando..." : "Finalizar Quiz"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
