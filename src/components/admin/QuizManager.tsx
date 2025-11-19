import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { quizService, Quiz, QuizPergunta, QuizAlternativa } from "@/services/quizService";
import { lessonService } from "@/services/lessonService";
import { Plus, Trash2, Edit, Save, X, Image as ImageIcon, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Lesson {
  id: string;
  title: string;
  module_id: string;
}

export default function QuizManager() {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editing, setEditing] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<Partial<Quiz> | null>(null);
  const [perguntas, setPerguntas] = useState<(QuizPergunta & { alternativas: QuizAlternativa[] })[]>([]);
  const [editingPergunta, setEditingPergunta] = useState<string | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (selectedLessonId) {
      loadQuizzes();
    }
  }, [selectedLessonId]);

  const loadLessons = async () => {
    try {
      const data = await lessonService.getAllLessons();
      setLessons(data);
    } catch (error) {
      console.error("Erro ao carregar aulas:", error);
    }
  };

  const loadQuizzes = async () => {
    try {
      const data = await quizService.getQuizzesByLesson(selectedLessonId);
      setQuizzes(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os quizzes",
        variant: "destructive",
      });
    }
  };

  const startEdit = async (quiz?: Quiz) => {
    if (quiz) {
      setCurrentQuiz(quiz);
      const perguntasData = await quizService.getPerguntasByQuiz(quiz.id);
      setPerguntas(perguntasData);
    } else {
      setCurrentQuiz({
        aula_id: selectedLessonId,
        titulo: "",
        descricao: "",
        nota_minima_aprovacao: 70,
        tentativas_maximas: 3,
        tempo_limite_segundos: null,
        modo_de_navegacao: 'livre',
        aleatorizar_ordem_perguntas: false,
        aleatorizar_ordem_alternativas: true,
        feedback_imediato: false,
        ativo: true,
      });
      setPerguntas([]);
    }
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setCurrentQuiz(null);
    setPerguntas([]);
    setEditingPergunta(null);
  };

  const handleSaveQuiz = async () => {
    if (!currentQuiz) return;

    try {
      let quizId: string;

      if (currentQuiz.id) {
        await quizService.updateQuiz(currentQuiz.id, currentQuiz as any);
        quizId = currentQuiz.id;
        toast({ title: "Quiz atualizado com sucesso!" });
      } else {
        const { id, created_at, updated_at, ...insertData } = currentQuiz as any;
        const newQuiz = await quizService.createQuiz(insertData);
        quizId = newQuiz.id;
        toast({ title: "Quiz criado com sucesso!" });
      }

      // Salvar perguntas e alternativas
      for (const pergunta of perguntas) {
        if (pergunta.id && pergunta.id.startsWith('temp-')) {
          // Nova pergunta
          const { id, alternativas, created_at, ...perguntaData } = pergunta;
          const newPergunta = await quizService.createPergunta({
            ...perguntaData as any,
            quiz_id: quizId,
          });

          // Criar alternativas
          for (const alt of alternativas) {
            const { id: altId, created_at: altCreatedAt, ...altData } = alt;
            await quizService.createAlternativa({
              ...altData as any,
              pergunta_id: newPergunta.id,
            });
          }
        } else if (pergunta.id) {
          // Atualizar pergunta existente
          const { alternativas, created_at, id, quiz_id, ...perguntaData } = pergunta;
          await quizService.updatePergunta(pergunta.id, perguntaData as any);

          // Atualizar alternativas
          for (const alt of alternativas) {
            const { created_at: altCreatedAt, pergunta_id, ...altData } = alt;
            if (alt.id.startsWith('temp-')) {
              await quizService.createAlternativa({
                ...altData as any,
                pergunta_id: pergunta.id,
              });
            } else {
              await quizService.updateAlternativa(alt.id, altData as any);
            }
          }
        }
      }

      loadQuizzes();
      cancelEdit();
    } catch (error) {
      console.error("Erro ao salvar quiz:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o quiz",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Tem certeza que deseja excluir este quiz?")) return;

    try {
      await quizService.deleteQuiz(quizId);
      toast({ title: "Quiz excluído com sucesso!" });
      loadQuizzes();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o quiz",
        variant: "destructive",
      });
    }
  };

  const addPergunta = () => {
    const newPergunta: QuizPergunta & { alternativas: QuizAlternativa[] } = {
      id: `temp-${Date.now()}`,
      quiz_id: currentQuiz?.id || '',
      enunciado: '',
      tipo: 'unica',
      nivel_dificuldade: 'medio',
      tags: [],
      ordem: perguntas.length + 1,
      imagem_url: null,
      created_at: new Date().toISOString(),
      alternativas: [
        { id: `temp-alt-1`, pergunta_id: '', texto: '', correta: false, explicacao_feedback: null, ordem_base: 1, created_at: '' },
        { id: `temp-alt-2`, pergunta_id: '', texto: '', correta: false, explicacao_feedback: null, ordem_base: 2, created_at: '' },
      ],
    };
    setPerguntas([...perguntas, newPergunta]);
    setEditingPergunta(newPergunta.id);
  };

  const updatePergunta = (index: number, updates: Partial<QuizPergunta>) => {
    const updated = [...perguntas];
    updated[index] = { ...updated[index], ...updates };
    setPerguntas(updated);
  };

  const updateAlternativa = (perguntaIndex: number, altIndex: number, updates: Partial<QuizAlternativa>) => {
    const updated = [...perguntas];
    updated[perguntaIndex].alternativas[altIndex] = {
      ...updated[perguntaIndex].alternativas[altIndex],
      ...updates,
    };
    setPerguntas(updated);
  };

  const addAlternativa = (perguntaIndex: number) => {
    const updated = [...perguntas];
    const ordem = updated[perguntaIndex].alternativas.length + 1;
    updated[perguntaIndex].alternativas.push({
      id: `temp-alt-${Date.now()}`,
      pergunta_id: updated[perguntaIndex].id,
      texto: '',
      correta: false,
      explicacao_feedback: null,
      ordem_base: ordem,
      created_at: '',
    });
    setPerguntas(updated);
  };

  const removePergunta = async (index: number) => {
    const pergunta = perguntas[index];
    if (!pergunta.id.startsWith('temp-')) {
      if (!confirm("Tem certeza que deseja excluir esta pergunta?")) return;
      try {
        await quizService.deletePergunta(pergunta.id);
        toast({ title: "Pergunta excluída com sucesso!" });
      } catch (error) {
        toast({ title: "Erro", description: "Não foi possível excluir a pergunta", variant: "destructive" });
        return;
      }
    }
    const updated = perguntas.filter((_, i) => i !== index);
    setPerguntas(updated);
  };

  const removeAlternativa = async (perguntaIndex: number, altIndex: number) => {
    const alternativa = perguntas[perguntaIndex].alternativas[altIndex];
    if (!alternativa.id.startsWith('temp-')) {
      try {
        await quizService.deleteAlternativa(alternativa.id);
      } catch (error) {
        toast({ title: "Erro", description: "Não foi possível excluir a alternativa", variant: "destructive" });
        return;
      }
    }
    const updated = [...perguntas];
    updated[perguntaIndex].alternativas = updated[perguntaIndex].alternativas.filter((_, i) => i !== altIndex);
    setPerguntas(updated);
  };

  if (!selectedLessonId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Editor de Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Selecione uma Aula</Label>
              <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma aula" />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{currentQuiz?.id ? 'Editar Quiz' : 'Novo Quiz'}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleSaveQuiz} size="sm">
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
              <Button onClick={cancelEdit} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {/* Configurações do Quiz */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Configurações do Quiz</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Título</Label>
                    <Input
                      value={currentQuiz?.titulo || ''}
                      onChange={(e) => setCurrentQuiz({ ...currentQuiz, titulo: e.target.value })}
                      placeholder="Ex: Quiz de Eletroterapia - Módulo 1"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={currentQuiz?.descricao || ''}
                      onChange={(e) => setCurrentQuiz({ ...currentQuiz, descricao: e.target.value })}
                      placeholder="Descreva o objetivo deste quiz"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Nota Mínima para Aprovação (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={currentQuiz?.nota_minima_aprovacao || 70}
                      onChange={(e) => setCurrentQuiz({ ...currentQuiz, nota_minima_aprovacao: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label>Tentativas Máximas</Label>
                    <Input
                      type="number"
                      min="1"
                      value={currentQuiz?.tentativas_maximas || 3}
                      onChange={(e) => setCurrentQuiz({ ...currentQuiz, tentativas_maximas: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label>Tempo Limite (segundos)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Deixe vazio para sem limite"
                      value={currentQuiz?.tempo_limite_segundos || ''}
                      onChange={(e) => setCurrentQuiz({ 
                        ...currentQuiz, 
                        tempo_limite_segundos: e.target.value ? parseInt(e.target.value) : null 
                      })}
                    />
                  </div>

                  <div>
                    <Label>Modo de Navegação</Label>
                    <Select
                      value={currentQuiz?.modo_de_navegacao || 'livre'}
                      onValueChange={(value: 'livre' | 'sequencial') => 
                        setCurrentQuiz({ ...currentQuiz, modo_de_navegacao: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="livre">Livre (pode voltar)</SelectItem>
                        <SelectItem value="sequencial">Sequencial (sem volta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between col-span-2">
                    <Label>Aleatorizar ordem das perguntas</Label>
                    <Switch
                      checked={currentQuiz?.aleatorizar_ordem_perguntas || false}
                      onCheckedChange={(checked) => 
                        setCurrentQuiz({ ...currentQuiz, aleatorizar_ordem_perguntas: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-2">
                    <Label>Aleatorizar ordem das alternativas</Label>
                    <Switch
                      checked={currentQuiz?.aleatorizar_ordem_alternativas !== false}
                      onCheckedChange={(checked) => 
                        setCurrentQuiz({ ...currentQuiz, aleatorizar_ordem_alternativas: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-2">
                    <Label>Feedback imediato (após cada pergunta)</Label>
                    <Switch
                      checked={currentQuiz?.feedback_imediato || false}
                      onCheckedChange={(checked) => 
                        setCurrentQuiz({ ...currentQuiz, feedback_imediato: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-2">
                    <Label>Quiz ativo</Label>
                    <Switch
                      checked={currentQuiz?.ativo !== false}
                      onCheckedChange={(checked) => 
                        setCurrentQuiz({ ...currentQuiz, ativo: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Perguntas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Perguntas ({perguntas.length})</h3>
                  <Button onClick={addPergunta} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Pergunta
                  </Button>
                </div>

                {perguntas.map((pergunta, pIndex) => (
                  <Card key={pergunta.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="outline">Pergunta {pIndex + 1}</Badge>
                          <Badge>{pergunta.nivel_dificuldade}</Badge>
                          {pergunta.tipo === 'multipla' && <Badge variant="secondary">Múltipla escolha</Badge>}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePergunta(pIndex)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Enunciado</Label>
                          <Textarea
                            value={pergunta.enunciado}
                            onChange={(e) => updatePergunta(pIndex, { enunciado: e.target.value })}
                            placeholder="Digite a pergunta"
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label>Tipo</Label>
                          <Select
                            value={pergunta.tipo}
                            onValueChange={(value: 'unica' | 'multipla' | 'dissertativa-curta') => 
                              updatePergunta(pIndex, { tipo: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unica">Única escolha</SelectItem>
                              <SelectItem value="multipla">Múltipla escolha</SelectItem>
                              <SelectItem value="dissertativa-curta">Dissertativa curta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Dificuldade</Label>
                          <Select
                            value={pergunta.nivel_dificuldade}
                            onValueChange={(value: 'facil' | 'medio' | 'dificil') => 
                              updatePergunta(pIndex, { nivel_dificuldade: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="facil">Fácil</SelectItem>
                              <SelectItem value="medio">Médio</SelectItem>
                              <SelectItem value="dificil">Difícil</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Label>Tags (separadas por vírgula)</Label>
                          <Input
                            value={pergunta.tags?.join(', ') || ''}
                            onChange={(e) => {
                              const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                              updatePergunta(pIndex, { tags });
                            }}
                            placeholder="Ex: eletroterapia, TENS, frequência"
                          />
                        </div>
                      </div>

                      {pergunta.tipo !== 'dissertativa-curta' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Alternativas</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addAlternativa(pIndex)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Adicionar
                            </Button>
                          </div>

                          {pergunta.alternativas.map((alt, aIndex) => (
                            <div key={alt.id} className="flex gap-2 items-start p-2 border rounded">
                              <Switch
                                checked={alt.correta}
                                onCheckedChange={(checked) => 
                                  updateAlternativa(pIndex, aIndex, { correta: checked })
                                }
                              />
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={alt.texto}
                                  onChange={(e) => updateAlternativa(pIndex, aIndex, { texto: e.target.value })}
                                  placeholder={`Alternativa ${aIndex + 1}`}
                                />
                                <Input
                                  value={alt.explicacao_feedback || ''}
                                  onChange={(e) => 
                                    updateAlternativa(pIndex, aIndex, { explicacao_feedback: e.target.value })
                                  }
                                  placeholder="Feedback ao selecionar esta alternativa (opcional)"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAlternativa(pIndex, aIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Quizzes da Aula</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setSelectedLessonId("")} variant="outline" size="sm">
              Trocar Aula
            </Button>
            <Button onClick={() => startEdit()} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Quiz
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum quiz criado para esta aula ainda.
            </div>
          ) : (
            quizzes.map((quiz) => (
              <Card key={quiz.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{quiz.titulo}</h4>
                      {quiz.ativo ? (
                        <Badge>Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{quiz.descricao}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Nota mínima: {quiz.nota_minima_aprovacao}%</span>
                      <span>Tentativas: {quiz.tentativas_maximas}</span>
                      {quiz.tempo_limite_segundos && (
                        <span>Tempo: {Math.floor(quiz.tempo_limite_segundos / 60)}min</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(quiz)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
