import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuizPergunta, QuizAlternativa } from "@/services/quizService";

interface QuizQuestionsEditorProps {
  perguntas: (QuizPergunta & { alternativas: QuizAlternativa[] })[];
  onChange: (perguntas: (QuizPergunta & { alternativas: QuizAlternativa[] })[]) => void;
}

export function QuizQuestionsEditor({ perguntas, onChange }: QuizQuestionsEditorProps) {
  const [editingPergunta, setEditingPergunta] = useState<string | null>(null);

  const addPergunta = () => {
    const newPergunta: any = {
      id: `temp-${Date.now()}`,
      quiz_id: 'temp',
      enunciado: "",
      tipo: "unica",
      nivel_dificuldade: "medio",
      ordem: perguntas.length + 1,
      tags: [],
      imagem_url: null,
      alternativas: [],
    };
    onChange([...perguntas, newPergunta]);
    setEditingPergunta(newPergunta.id);
  };

  const updatePergunta = (id: string, updates: Partial<QuizPergunta>) => {
    onChange(perguntas.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePergunta = (id: string) => {
    onChange(perguntas.filter(p => p.id !== id));
  };

  const addAlternativa = (perguntaId: string) => {
    const pergunta = perguntas.find(p => p.id === perguntaId);
    if (!pergunta) return;

    const newAlternativa: any = {
      id: `temp-alt-${Date.now()}`,
      pergunta_id: perguntaId,
      texto: "",
      correta: false,
      ordem_base: pergunta.alternativas.length + 1,
      explicacao_feedback: null,
    };

    onChange(perguntas.map(p => 
      p.id === perguntaId 
        ? { ...p, alternativas: [...p.alternativas, newAlternativa] }
        : p
    ));
  };

  const updateAlternativa = (perguntaId: string, altId: string, updates: Partial<QuizAlternativa>) => {
    onChange(perguntas.map(p => 
      p.id === perguntaId
        ? {
            ...p,
            alternativas: p.alternativas.map(a => 
              a.id === altId ? { ...a, ...updates } : a
            )
          }
        : p
    ));
  };

  const deleteAlternativa = (perguntaId: string, altId: string) => {
    onChange(perguntas.map(p => 
      p.id === perguntaId
        ? { ...p, alternativas: p.alternativas.filter(a => a.id !== altId) }
        : p
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Perguntas do Quiz</h3>
        <Button onClick={addPergunta} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Pergunta
        </Button>
      </div>

      {perguntas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma pergunta adicionada. Clique em "Adicionar Pergunta" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {perguntas.map((pergunta, index) => (
            <Card key={pergunta.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Pergunta {index + 1}</CardTitle>
                    <Badge variant="outline">{pergunta.nivel_dificuldade}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {editingPergunta === pergunta.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPergunta(null)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPergunta(pergunta.id)}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePergunta(pergunta.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {editingPergunta === pergunta.id ? (
                  <>
                    <div className="space-y-2">
                      <Label>Enunciado</Label>
                      <Textarea
                        value={pergunta.enunciado}
                        onChange={(e) => updatePergunta(pergunta.id, { enunciado: e.target.value })}
                        placeholder="Digite o enunciado da pergunta"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                          value={pergunta.tipo}
                          onValueChange={(value) => updatePergunta(pergunta.id, { tipo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica">Escolha Única</SelectItem>
                            <SelectItem value="multipla">Múltipla Escolha</SelectItem>
                            <SelectItem value="texto">Resposta em Texto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Dificuldade</Label>
                        <Select
                          value={pergunta.nivel_dificuldade}
                          onValueChange={(value) => updatePergunta(pergunta.id, { nivel_dificuldade: value })}
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
                    </div>

                    <div className="space-y-2">
                      <Label>Tags (separadas por vírgula)</Label>
                      <Input
                        value={pergunta.tags?.join(", ") || ""}
                        onChange={(e) => updatePergunta(pergunta.id, { 
                          tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) 
                        })}
                        placeholder="Ex: anatomia, fisiologia"
                      />
                    </div>

                    {/* Alternativas */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Alternativas</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addAlternativa(pergunta.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Alternativa
                        </Button>
                      </div>

                      {pergunta.alternativas.map((alt, altIndex) => (
                        <div key={alt.id} className="flex gap-2 items-start p-3 border rounded-lg">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {String.fromCharCode(65 + altIndex)}
                              </Badge>
                              <Input
                                value={alt.texto}
                                onChange={(e) => updateAlternativa(pergunta.id, alt.id, { texto: e.target.value })}
                                placeholder="Texto da alternativa"
                              />
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={alt.correta}
                                  onChange={(e) => updateAlternativa(pergunta.id, alt.id, { correta: e.target.checked })}
                                  className="rounded border-border"
                                />
                                Resposta correta
                              </label>
                            </div>
                            <Input
                              value={alt.explicacao_feedback || ""}
                              onChange={(e) => updateAlternativa(pergunta.id, alt.id, { explicacao_feedback: e.target.value })}
                              placeholder="Explicação (opcional)"
                              className="text-sm"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAlternativa(pergunta.id, alt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">{pergunta.enunciado}</p>
                    <div className="text-xs text-muted-foreground">
                      {pergunta.alternativas.length} alternativa(s) • {pergunta.tipo}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
