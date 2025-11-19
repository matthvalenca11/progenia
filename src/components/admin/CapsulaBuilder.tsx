import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { capsulaService, Capsula, CapsulaQuizPergunta, CapsulaQuizAlternativa } from "@/services/capsulaService";
import { ArrowLeft, Save, Plus, Trash2, Eye, Upload } from "lucide-react";
import { FileUploadField } from "@/components/ui/FileUploadField";

export default function CapsulaBuilder() {
  const navigate = useNavigate();
  const { moduleId, capsulaId } = useParams();
  const isEdit = !!capsulaId;

  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [capsula, setCapsula] = useState<Capsula>({
    modulo_id: moduleId || "",
    categoria: "",
    titulo: "",
    pergunta_gatilho: "",
    texto_curto: "",
    takeaway: "",
    tipo_visual: "imagem",
    ativo: true,
    ordem: 0,
    perguntas: [],
  });

  const [visualFile, setVisualFile] = useState<File | null>(null);
  const [visualPreview, setVisualPreview] = useState<string>("");
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreview, setCapaPreview] = useState<string>("");

  useEffect(() => {
    if (isEdit && capsulaId) {
      loadCapsula();
    }
  }, [capsulaId]);

  const loadCapsula = async () => {
    try {
      setLoading(true);
      const data = await capsulaService.getCapsulaById(capsulaId!);
      if (data) {
        setCapsula(data);
        // Carregar preview do visual se existir
        if (data.visual_path && data.tipo_visual !== "lab") {
          const url = await capsulaService.getVisualUrl(data.tipo_visual as "imagem" | "video", data.visual_path);
          setVisualPreview(url);
        }
        // Carregar preview da capa se existir
        if (data.capa_path) {
          const capaUrl = await capsulaService.getVisualUrl("imagem", data.capa_path);
          setCapaPreview(capaUrl);
        }
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

  const handleSave = async () => {
    try {
      // Validações
      if (!capsula.titulo || !capsula.pergunta_gatilho || !capsula.texto_curto || !capsula.takeaway || !capsula.categoria) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      let capsulaIdFinal = capsulaId;

      // Salvar cápsula
      if (isEdit) {
        await capsulaService.updateCapsula(capsulaId!, capsula);
        toast({ title: "Cápsula atualizada com sucesso!" });
      } else {
        capsulaIdFinal = await capsulaService.createCapsula(capsula);
        toast({ title: "Cápsula criada com sucesso!" });
      }

      // Upload de arquivo visual se houver
      if (visualFile && capsulaIdFinal && capsula.tipo_visual !== "lab") {
        setUploadingFile(true);
        const path = await capsulaService.uploadVisual(
          capsulaIdFinal,
          visualFile,
          capsula.tipo_visual as "imagem" | "video"
        );
        await capsulaService.updateCapsula(capsulaIdFinal, { visual_path: path });
        toast({ title: "Arquivo enviado com sucesso!" });
      }

      // Upload de imagem de capa se houver
      if (capaFile && capsulaIdFinal) {
        const capaPath = await capsulaService.uploadCapa(capsulaIdFinal, capaFile);
        await capsulaService.updateCapsula(capsulaIdFinal, { capa_path: capaPath });
        toast({ title: "Capa enviada com sucesso!" });
      }

      navigate(`/admin`);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar cápsula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  };

  const addPergunta = () => {
    const novaPergunta: CapsulaQuizPergunta = {
      enunciado: "",
      tipo: "unica",
      ordem: capsula.perguntas?.length || 0,
      alternativas: [
        { texto: "", correta: false, ordem_base: 0 },
        { texto: "", correta: false, ordem_base: 1 },
      ],
    };
    setCapsula({ ...capsula, perguntas: [...(capsula.perguntas || []), novaPergunta] });
  };

  const removePergunta = (index: number) => {
    const novasPerguntas = capsula.perguntas?.filter((_, i) => i !== index) || [];
    setCapsula({ ...capsula, perguntas: novasPerguntas });
  };

  const updatePergunta = (index: number, field: string, value: any) => {
    const novasPerguntas = [...(capsula.perguntas || [])];
    novasPerguntas[index] = { ...novasPerguntas[index], [field]: value };
    setCapsula({ ...capsula, perguntas: novasPerguntas });
  };

  const addAlternativa = (perguntaIndex: number) => {
    const novasPerguntas = [...(capsula.perguntas || [])];
    const alternativas = novasPerguntas[perguntaIndex].alternativas || [];
    alternativas.push({ texto: "", correta: false, ordem_base: alternativas.length });
    novasPerguntas[perguntaIndex].alternativas = alternativas;
    setCapsula({ ...capsula, perguntas: novasPerguntas });
  };

  const removeAlternativa = (perguntaIndex: number, altIndex: number) => {
    const novasPerguntas = [...(capsula.perguntas || [])];
    novasPerguntas[perguntaIndex].alternativas = novasPerguntas[perguntaIndex].alternativas?.filter(
      (_, i) => i !== altIndex
    );
    setCapsula({ ...capsula, perguntas: novasPerguntas });
  };

  const updateAlternativa = (perguntaIndex: number, altIndex: number, field: string, value: any) => {
    const novasPerguntas = [...(capsula.perguntas || [])];
    const alternativas = [...(novasPerguntas[perguntaIndex].alternativas || [])];
    alternativas[altIndex] = { ...alternativas[altIndex], [field]: value };
    novasPerguntas[perguntaIndex].alternativas = alternativas;
    setCapsula({ ...capsula, perguntas: novasPerguntas });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Editar Cápsula" : "Nova Cápsula"}</CardTitle>
          <CardDescription>
            Crie cápsulas de aprendizado curtas, interativas e impactantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Básicas</h3>
            
            <div>
              <Label htmlFor="titulo">Título da Cápsula *</Label>
              <Input
                id="titulo"
                value={capsula.titulo}
                onChange={(e) => setCapsula({ ...capsula, titulo: e.target.value })}
                placeholder="Ex: Correntes Interferênciais - Conceito"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capa">Imagem de Capa (opcional)</Label>
              <p className="text-sm text-muted-foreground">
                Use GIF animado para efeito hover ou imagem estática
              </p>
              <FileUploadField
                accept="image/*"
                onFilesSelected={(files) => {
                  if (files.length > 0) {
                    setCapaFile(files[0]);
                    const reader = new FileReader();
                    reader.onload = (e) => setCapaPreview(e.target?.result as string);
                    reader.readAsDataURL(files[0]);
                  }
                }}
              />
              {capaPreview && (
                <div className="mt-2 rounded-md overflow-hidden border">
                  <img 
                    src={capaPreview} 
                    alt="Preview da capa" 
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="categoria">Categoria *</Label>
              <Input
                id="categoria"
                value={capsula.categoria}
                onChange={(e) => setCapsula({ ...capsula, categoria: e.target.value })}
                placeholder="Ex: Parâmetros, Física, Aplicações Clínicas"
              />
            </div>

            <div>
              <Label htmlFor="ordem">Ordem</Label>
              <Input
                id="ordem"
                type="number"
                value={capsula.ordem}
                onChange={(e) => setCapsula({ ...capsula, ordem: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={capsula.ativo}
                onCheckedChange={(checked) => setCapsula({ ...capsula, ativo: checked })}
              />
              <Label>Cápsula ativa</Label>
            </div>
          </div>

          <Separator />

          {/* Conteúdo da Cápsula */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Conteúdo</h3>

            <div>
              <Label htmlFor="pergunta_gatilho">Pergunta Gatilho *</Label>
              <Input
                id="pergunta_gatilho"
                value={capsula.pergunta_gatilho}
                onChange={(e) => setCapsula({ ...capsula, pergunta_gatilho: e.target.value })}
                placeholder="Ex: Como funcionam as correntes interferênciais?"
              />
            </div>

            <div>
              <Label htmlFor="texto_curto">Texto Explicativo (2-5 frases) *</Label>
              <Textarea
                id="texto_curto"
                value={capsula.texto_curto}
                onChange={(e) => setCapsula({ ...capsula, texto_curto: e.target.value })}
                placeholder="Explique o conceito de forma clara e objetiva..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="takeaway">Resumo de Bolso (Takeaway) *</Label>
              <Textarea
                id="takeaway"
                value={capsula.takeaway}
                onChange={(e) => setCapsula({ ...capsula, takeaway: e.target.value })}
                placeholder="Um resumo curto que o aluno pode guardar..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Elemento Visual */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Elemento Visual</h3>

            <div>
              <Label>Tipo de Visual</Label>
              <Select
                value={capsula.tipo_visual}
                onValueChange={(value: any) => setCapsula({ ...capsula, tipo_visual: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imagem">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="lab">Laboratório Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {capsula.tipo_visual === "lab" ? (
              <>
                <div>
                  <Label>Tipo de Laboratório</Label>
                  <Select
                    value={capsula.tipo_lab || ""}
                    onValueChange={(value: any) => setCapsula({ ...capsula, tipo_lab: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o laboratório" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mri_viewer">Visualizador de MRI</SelectItem>
                      <SelectItem value="ultrasound_simulator">Simulador de Ultrassom (básico)</SelectItem>
                      <SelectItem value="ultrassom_avancado">Simulador de Ultrassom (avançado)</SelectItem>
                      <SelectItem value="eletroterapia_lab">Lab de Eletroterapia</SelectItem>
                      <SelectItem value="thermal_lab">Lab Termal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ultrasound Lab Configuration */}
                {capsula.tipo_lab === "ultrasound_simulator" && (
                  <Card className="p-4 bg-slate-50 dark:bg-slate-900">
                    <h4 className="text-sm font-semibold mb-3">Configuração dos Controles do Simulador</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Escolha quais controles serão exibidos para o aluno nesta cápsula
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showGain" className="text-sm">Exibir controle de Ganho / Brilho</Label>
                        <Switch
                          id="showGain"
                          checked={capsula.ultrasound_lab_config?.showGain ?? true}
                          onCheckedChange={(checked) =>
                            setCapsula({
                              ...capsula,
                              ultrasound_lab_config: {
                                enabled: true,
                                showGain: checked,
                                showDepth: capsula.ultrasound_lab_config?.showDepth ?? true,
                                showFrequency: capsula.ultrasound_lab_config?.showFrequency ?? true,
                                showFocus: capsula.ultrasound_lab_config?.showFocus ?? true,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showDepth" className="text-sm">Exibir controle de Profundidade</Label>
                        <Switch
                          id="showDepth"
                          checked={capsula.ultrasound_lab_config?.showDepth ?? true}
                          onCheckedChange={(checked) =>
                            setCapsula({
                              ...capsula,
                              ultrasound_lab_config: {
                                enabled: true,
                                showGain: capsula.ultrasound_lab_config?.showGain ?? true,
                                showDepth: checked,
                                showFrequency: capsula.ultrasound_lab_config?.showFrequency ?? true,
                                showFocus: capsula.ultrasound_lab_config?.showFocus ?? true,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showFrequency" className="text-sm">Exibir controle de Frequência (MHz)</Label>
                        <Switch
                          id="showFrequency"
                          checked={capsula.ultrasound_lab_config?.showFrequency ?? true}
                          onCheckedChange={(checked) =>
                            setCapsula({
                              ...capsula,
                              ultrasound_lab_config: {
                                enabled: true,
                                showGain: capsula.ultrasound_lab_config?.showGain ?? true,
                                showDepth: capsula.ultrasound_lab_config?.showDepth ?? true,
                                showFrequency: checked,
                                showFocus: capsula.ultrasound_lab_config?.showFocus ?? true,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showFocus" className="text-sm">Exibir controle de Foco</Label>
                        <Switch
                          id="showFocus"
                          checked={capsula.ultrasound_lab_config?.showFocus ?? true}
                          onCheckedChange={(checked) =>
                            setCapsula({
                              ...capsula,
                              ultrasound_lab_config: {
                                enabled: true,
                                showGain: capsula.ultrasound_lab_config?.showGain ?? true,
                                showDepth: capsula.ultrasound_lab_config?.showDepth ?? true,
                                showFrequency: capsula.ultrasound_lab_config?.showFrequency ?? true,
                                showFocus: checked,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </Card>
                )}
                {/* Advanced Ultrasound Configuration */}
                {capsula.tipo_lab === "ultrassom_avancado" && (
                  <Card className="p-4 bg-slate-50 dark:bg-slate-900">
                    <h4 className="text-sm font-semibold mb-3">Configuração do Ultrassom Avançado</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Anatomia Simulada</Label>
                        <Select 
                          value={capsula.ultrasound_lab_config?.presetAnatomy || 'generic'}
                          onValueChange={(value) => {
                            setCapsula({
                              ...capsula,
                              ultrasound_lab_config: {
                                ...capsula.ultrasound_lab_config,
                                enabled: true,
                                presetAnatomy: value,
                                showGain: true,
                                showDepth: true,
                                showFrequency: true,
                                showFocus: true,
                                showTGC: true,
                                showDynamicRange: true,
                                showTransducerSelector: true,
                                showModeSelector: true,
                                showCompoundToggle: true,
                                showHarmonicToggle: true,
                                showZoom: true,
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="text-xs w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="generic">Genérico</SelectItem>
                            <SelectItem value="muscle">Músculo</SelectItem>
                            <SelectItem value="vascular">Vascular</SelectItem>
                            <SelectItem value="tendon">Tendão</SelectItem>
                            <SelectItem value="bone">Osso</SelectItem>
                            <SelectItem value="liver">Fígado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div>
                <Label>Upload de {capsula.tipo_visual === "video" ? "Vídeo" : "Imagem"}</Label>
                <FileUploadField
                  accept={capsula.tipo_visual === "video" ? "video/*" : "image/*"}
                  onFilesSelected={(files) => {
                    const file = files[0];
                    if (file) {
                      setVisualFile(file);
                      // Preview
                      const reader = new FileReader();
                      reader.onload = (e) => setVisualPreview(e.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {visualPreview && (
                  <div className="mt-2">
                    {capsula.tipo_visual === "video" ? (
                      <video src={visualPreview} controls className="max-w-full h-auto rounded" />
                    ) : (
                      <img src={visualPreview} alt="Preview" className="max-w-full h-auto rounded" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Micro-Quiz */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Micro-Quiz (1-2 perguntas)</h3>
              <Button onClick={addPergunta} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Pergunta
              </Button>
            </div>

            {capsula.perguntas?.map((pergunta, pIndex) => (
              <Card key={pIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge>Pergunta {pIndex + 1}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePergunta(pIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Enunciado</Label>
                    <Textarea
                      value={pergunta.enunciado}
                      onChange={(e) => updatePergunta(pIndex, "enunciado", e.target.value)}
                      placeholder="Digite a pergunta..."
                    />
                  </div>

                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={pergunta.tipo}
                      onValueChange={(value) => updatePergunta(pIndex, "tipo", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unica">Escolha única</SelectItem>
                        <SelectItem value="multipla">Múltipla escolha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Alternativas</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addAlternativa(pIndex)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>

                    {pergunta.alternativas?.map((alt, aIndex) => (
                      <div key={aIndex} className="flex items-start gap-2">
                        <div className="flex-1">
                          <Input
                            value={alt.texto}
                            onChange={(e) =>
                              updateAlternativa(pIndex, aIndex, "texto", e.target.value)
                            }
                            placeholder={`Alternativa ${aIndex + 1}`}
                          />
                          <Input
                            className="mt-1 text-sm"
                            value={alt.micro_feedback || ""}
                            onChange={(e) =>
                              updateAlternativa(pIndex, aIndex, "micro_feedback", e.target.value)
                            }
                            placeholder="Micro-feedback (opcional)"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Switch
                            checked={alt.correta}
                            onCheckedChange={(checked) =>
                              updateAlternativa(pIndex, aIndex, "correta", checked)
                            }
                          />
                          <span className="text-xs">Correta</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAlternativa(pIndex, aIndex)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={loading || uploadingFile} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : uploadingFile ? "Enviando arquivo..." : "Salvar Cápsula"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
