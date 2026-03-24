/** Conteúdo padrão e normalização para a seção Missão, Visão e Valores (about_page_sections.section_type = mvv). */

export type MvvValueItem = { title: string; description: string; icon?: string };

export type MvvContentData = {
  mission_title: string;
  mission_body: string;
  vision_title: string;
  vision_body: string;
  values_title: string;
  values: MvvValueItem[];
};

export const DEFAULT_MVV_CONTENT_DATA: MvvContentData = {
  mission_title: "Missão",
  mission_body:
    "Aprimorar a educação em saúde através do rigor científico e de simulações realistas, reduzindo o erro técnico e apoiando a tomada de decisão clínica com segurança. Nosso propósito é desmistificar equipamentos complexos, convertendo a base teórica em prática clínica segura e mensurável, em constante atualização com as novas tecnologias.",
  vision_title: "Visão",
  vision_body:
    "Ser um elo entre o conhecimento teórico e a prática segura em saúde, tornando-se uma referência institucional na formação por competências e na atualização clínica contínua. Buscamos ampliar o acesso à educação de alta tecnologia, rompendo barreiras geográficas para formar profissionais que compreendem, interpretam e decidem com base na ciência.",
  values_title: "Valores",
  values: [
    {
      title: "Segurança Clínica em Primeiro Lugar",
      description:
        "Acreditamos que o erro técnico gera risco clínico. Por isso, oferecemos um ambiente de experimentação seguro onde o erro atua como ferramenta de ensino antes do contato com o paciente real.",
      icon: "Shield",
    },
    {
      title: "Rigor Científico e Evidência",
      description:
        "Substituímos a memorização de protocolos pela compreensão real. Nosso ensino e nossos feedbacks são ancorados em princípios sólidos de física médica e literatura técnica.",
      icon: "Microscope",
    },
    {
      title: "Evolução e Atualização Contínua",
      description:
        "Mantemos uma rotina ativa de atualização de conteúdos. Exploramos e integramos o ensino de novas tecnologias, garantindo que o profissional esteja alinhado com as inovações da área.",
      icon: "RefreshCw",
    },
    {
      title: "Inteligência Pedagógica",
      description:
        "Não entregamos respostas prontas. Utilizamos a tecnologia para provocar o questionamento técnico e fortalecer a construção do raciocínio clínico autônomo do profissional.",
      icon: "Brain",
    },
    {
      title: "Acesso e Escalabilidade",
      description:
        "Trabalhamos para descentralizar o conhecimento, garantindo que a capacitação tecnológica não seja uma exclusividade dos grandes centros urbanos.",
      icon: "Globe",
    },
  ],
};

function parseValueItem(raw: unknown): MvvValueItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? "").trim();
  const description = String(o.description ?? "").trim();
  if (!title && !description) return null;
  const icon = o.icon != null ? String(o.icon) : undefined;
  return { title, description, ...(icon ? { icon } : {}) };
}

export function normalizeMvvContentData(raw: unknown): MvvContentData {
  const d = DEFAULT_MVV_CONTENT_DATA;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ...d,
      values: d.values.map((v) => ({ ...v })),
    };
  }
  const o = raw as Record<string, unknown>;
  let values: MvvValueItem[] = d.values.map((v) => ({ ...v }));
  if (Array.isArray(o.values)) {
    const parsed = o.values.map(parseValueItem).filter(Boolean) as MvvValueItem[];
    if (parsed.length > 0) values = parsed;
  }
  return {
    mission_title: String(o.mission_title ?? d.mission_title),
    mission_body: String(o.mission_body ?? d.mission_body),
    vision_title: String(o.vision_title ?? d.vision_title),
    vision_body: String(o.vision_body ?? d.vision_body),
    values_title: String(o.values_title ?? d.values_title),
    values,
  };
}

export function isMvvContentData(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      ("mission_body" in (raw as object) || "vision_body" in (raw as object))
  );
}
