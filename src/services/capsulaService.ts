import { supabase } from "@/integrations/supabase/client";
import { storageService } from "./storageService";

export interface CapsulaQuizAlternativa {
  id?: string;
  texto: string;
  correta: boolean;
  ordem_base: number;
  micro_feedback?: string;
}

export interface CapsulaQuizPergunta {
  id?: string;
  enunciado: string;
  tipo: "unica" | "multipla";
  ordem: number;
  alternativas?: CapsulaQuizAlternativa[];
}

export interface Capsula {
  id?: string;
  modulo_id: string;
  categoria: string;
  titulo: string;
  pergunta_gatilho: string;
  texto_curto: string;
  takeaway: string;
  tipo_visual: "imagem" | "video" | "lab";
  visual_path?: string;
  capa_path?: string;
  tipo_lab?: "mri_viewer" | "ultrasound_simulator" | "ultrassom_avancado" | "eletroterapia_lab" | "thermal_lab";
  ultrasound_lab_config?: any; // JSON field from Supabase
  ativo: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
  perguntas?: CapsulaQuizPergunta[];
}

export interface CapsulaProgresso {
  id?: string;
  usuario_id: string;
  capsula_id: string;
  concluida: boolean;
  acertos_quiz: number;
  tentativas: number;
  updated_at?: string;
}

export const capsulaService = {
  /**
   * Buscar todas as cápsulas de um módulo
   */
  async getCapsulasByModulo(moduloId: string): Promise<Capsula[]> {
    const { data, error } = await supabase
      .from("capsulas")
      .select("*")
      .eq("modulo_id", moduloId)
      .order("ordem", { ascending: true });

    if (error) throw error;
    return (data || []) as Capsula[];
  },

  /**
   * Buscar uma cápsula com suas perguntas e alternativas
   */
  async getCapsulaById(capsulaId: string): Promise<Capsula | null> {
    const { data: capsula, error: capsulaError } = await supabase
      .from("capsulas")
      .select("*")
      .eq("id", capsulaId)
      .single();

    if (capsulaError) throw capsulaError;
    if (!capsula) return null;

    const capsulaTyped = capsula as Capsula;

    // Buscar perguntas
    const { data: perguntas, error: perguntasError } = await supabase
      .from("capsula_quiz_perguntas")
      .select("*")
      .eq("capsula_id", capsulaId)
      .order("ordem", { ascending: true });

    if (perguntasError) throw perguntasError;

    // Para cada pergunta, buscar alternativas
    if (perguntas && perguntas.length > 0) {
      const perguntasComAlternativas = await Promise.all(
        perguntas.map(async (pergunta) => {
          const { data: alternativas, error: altError } = await supabase
            .from("capsula_quiz_alternativas")
            .select("*")
            .eq("pergunta_id", pergunta.id)
            .order("ordem_base", { ascending: true });

          if (altError) throw altError;

          return {
            id: pergunta.id,
            enunciado: pergunta.enunciado,
            tipo: pergunta.tipo as "unica" | "multipla",
            ordem: pergunta.ordem,
            alternativas: (alternativas || []).map(alt => ({
              id: alt.id,
              texto: alt.texto,
              correta: alt.correta,
              ordem_base: alt.ordem_base,
              micro_feedback: alt.micro_feedback || undefined,
            })),
          };
        })
      );

      capsulaTyped.perguntas = perguntasComAlternativas;
    }

    return capsulaTyped;
  },

  /**
   * Criar nova cápsula
   */
  async createCapsula(capsula: Capsula): Promise<string> {
    const { perguntas, ...capsulaData } = capsula;

    const { data, error } = await supabase
      .from("capsulas")
      .insert(capsulaData)
      .select()
      .single();

    if (error) throw error;

    // Criar perguntas se houver
    if (perguntas && perguntas.length > 0) {
      await this.savePerguntas(data.id, perguntas);
    }

    return data.id;
  },

  /**
   * Atualizar cápsula
   */
  async updateCapsula(capsulaId: string, capsula: Partial<Capsula>): Promise<void> {
    const { perguntas, ...capsulaData } = capsula;

    const { error } = await supabase
      .from("capsulas")
      .update(capsulaData)
      .eq("id", capsulaId);

    if (error) throw error;

    // Atualizar perguntas se houver
    if (perguntas) {
      // Deletar perguntas antigas
      await supabase
        .from("capsula_quiz_perguntas")
        .delete()
        .eq("capsula_id", capsulaId);

      // Criar novas
      if (perguntas.length > 0) {
        await this.savePerguntas(capsulaId, perguntas);
      }
    }
  },

  /**
   * Deletar cápsula
   */
  async deleteCapsula(capsulaId: string): Promise<void> {
    const { error } = await supabase
      .from("capsulas")
      .delete()
      .eq("id", capsulaId);

    if (error) throw error;
  },

  /**
   * Salvar perguntas e alternativas
   */
  async savePerguntas(capsulaId: string, perguntas: CapsulaQuizPergunta[]): Promise<void> {
    for (const pergunta of perguntas) {
      const { alternativas, ...perguntaData } = pergunta;

      const { data: perguntaSalva, error: perguntaError } = await supabase
        .from("capsula_quiz_perguntas")
        .insert({
          ...perguntaData,
          capsula_id: capsulaId,
        })
        .select()
        .single();

      if (perguntaError) throw perguntaError;

      // Salvar alternativas
      if (alternativas && alternativas.length > 0) {
        const alternativasData = alternativas.map((alt) => ({
          ...alt,
          pergunta_id: perguntaSalva.id,
        }));

        const { error: altError } = await supabase
          .from("capsula_quiz_alternativas")
          .insert(alternativasData);

        if (altError) throw altError;
      }
    }
  },

  /**
   * Upload de arquivo visual para cápsula
   */
  async uploadVisual(
    capsulaId: string,
    file: File,
    tipo: "imagem" | "video"
  ): Promise<string> {
    const bucket = tipo === "video" ? "lesson-videos" : "lesson-assets";

    // Usar nome de arquivo seguro para evitar erros de key (espaços, acentos, etc.)
    const safeName = storageService.generateUniqueFileName(file.name);
    const path = `capsulas/${capsulaId}/${safeName}`;

    const result = await storageService.uploadFile({
      bucket: bucket as any,
      path,
      file,
    });

    return result.path;
  },

  /**
   * Upload de imagem de capa para cápsula
   */
  async uploadCapa(capsulaId: string, file: File): Promise<string> {
    const safeName = storageService.generateUniqueFileName(file.name);
    const path = `capsulas/${capsulaId}/capa_${safeName}`;

    const result = await storageService.uploadFile({
      bucket: "lesson-assets" as any,
      path,
      file,
    });

    return result.path;
  },

  /**
   * Obter URL assinada para visual
   */
  async getVisualUrl(tipo: "imagem" | "video", path: string): Promise<string> {
    const bucket = tipo === "video" ? "lesson-videos" : "lesson-assets";

    return await storageService.getSignedUrl(bucket as any, path);
  },

  /**
   * Buscar progresso do usuário em uma cápsula
   */
  async getProgresso(usuarioId: string, capsulaId: string): Promise<CapsulaProgresso | null> {
    const { data, error } = await supabase
      .from("capsula_progresso_usuario")
      .select("*")
      .eq("usuario_id", usuarioId)
      .eq("capsula_id", capsulaId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Buscar progresso do usuário em todas as cápsulas de um módulo
   */
  async getProgressoModulo(
    usuarioId: string,
    moduloId: string
  ): Promise<Map<string, CapsulaProgresso>> {
    // Buscar IDs das cápsulas do módulo
    const { data: capsulas, error: capsulasError } = await supabase
      .from("capsulas")
      .select("id")
      .eq("modulo_id", moduloId);

    if (capsulasError) throw capsulasError;

    const capsulaIds = capsulas?.map((c) => c.id) || [];

    if (capsulaIds.length === 0) {
      return new Map();
    }

    // Buscar progresso
    const { data: progressos, error: progressoError } = await supabase
      .from("capsula_progresso_usuario")
      .select("*")
      .eq("usuario_id", usuarioId)
      .in("capsula_id", capsulaIds);

    if (progressoError) throw progressoError;

    const map = new Map<string, CapsulaProgresso>();
    progressos?.forEach((p) => map.set(p.capsula_id, p));

    return map;
  },

  /**
   * Salvar resposta do quiz
   */
  async salvarRespostaQuiz(
    usuarioId: string,
    capsulaId: string,
    acertos: number,
    totalPerguntas: number
  ): Promise<void> {
    // Buscar progresso existente
    const progressoExistente = await this.getProgresso(usuarioId, capsulaId);

    const concluida = acertos === totalPerguntas;

    if (progressoExistente) {
      // Atualizar
      const { error } = await supabase
        .from("capsula_progresso_usuario")
        .update({
          concluida,
          acertos_quiz: acertos,
          tentativas: progressoExistente.tentativas + 1,
        })
        .eq("id", progressoExistente.id);

      if (error) throw error;
    } else {
      // Criar
      const { error } = await supabase
        .from("capsula_progresso_usuario")
        .insert({
          usuario_id: usuarioId,
          capsula_id: capsulaId,
          concluida,
          acertos_quiz: acertos,
          tentativas: 1,
        });

      if (error) throw error;
    }
  },

  /**
   * Marcar cápsula como concluída
   */
  async marcarConcluida(usuarioId: string, capsulaId: string): Promise<void> {
    const progressoExistente = await this.getProgresso(usuarioId, capsulaId);

    if (progressoExistente) {
      const { error } = await supabase
        .from("capsula_progresso_usuario")
        .update({ concluida: true })
        .eq("id", progressoExistente.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("capsula_progresso_usuario")
        .insert({
          usuario_id: usuarioId,
          capsula_id: capsulaId,
          concluida: true,
          acertos_quiz: 0,
          tentativas: 0,
        });

      if (error) throw error;
    }
  },

  /**
   * Calcular estatísticas de progresso do módulo
   */
  async calcularEstatisticasModulo(
    usuarioId: string,
    moduloId: string
  ): Promise<{ total: number; concluidas: number; percentual: number }> {
    const { data: capsulas, error: capsulasError } = await supabase
      .from("capsulas")
      .select("id")
      .eq("modulo_id", moduloId)
      .eq("ativo", true);

    if (capsulasError) throw capsulasError;

    const total = capsulas?.length || 0;

    if (total === 0) {
      return { total: 0, concluidas: 0, percentual: 0 };
    }

    const capsulaIds = capsulas.map((c) => c.id);

    const { data: progressos, error: progressoError } = await supabase
      .from("capsula_progresso_usuario")
      .select("*")
      .eq("usuario_id", usuarioId)
      .in("capsula_id", capsulaIds)
      .eq("concluida", true);

    if (progressoError) throw progressoError;

    const concluidas = progressos?.length || 0;
    const percentual = Math.round((concluidas / total) * 100);

    return { total, concluidas, percentual };
  },

  /**
   * Buscar cápsulas recomendadas para o usuário
   */
  async getCapsulaRecomendadas(
    usuarioId: string,
    limite: number = 3
  ): Promise<Capsula[]> {
    // Buscar cápsulas que o usuário ainda não completou
    const { data: progressoConcluido } = await supabase
      .from("capsula_progresso_usuario")
      .select("capsula_id")
      .eq("usuario_id", usuarioId)
      .eq("concluida", true);

    const capsulasConcluidas = progressoConcluido?.map((p) => p.capsula_id) || [];

    // Buscar cápsulas ativas que não foram concluídas
    let query = supabase
      .from("capsulas")
      .select("*, modules:modulo_id(id, title, published)")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(limite);

    if (capsulasConcluidas.length > 0) {
      query = query.not("id", "in", `(${capsulasConcluidas.join(",")})`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filtrar apenas cápsulas de módulos publicados
    return (data || []).filter((c: any) => c.modules?.published) as Capsula[];
  },

  /**
   * Buscar cápsula inacabada (iniciada mas não concluída)
   */
  async getCapsulaInacabada(usuarioId: string): Promise<Capsula | null> {
    const { data: progresso } = await supabase
      .from("capsula_progresso_usuario")
      .select("capsula_id, capsulas(*)")
      .eq("usuario_id", usuarioId)
      .eq("concluida", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!progresso?.capsulas) return null;

    return progresso.capsulas as any;
  },
};
