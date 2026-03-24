/** Seção "Justificativa" / Por que o ProGenia existe? — alinhada ao ProGenia.html */

export type JustificationCard = { label: string; title: string; description: string };

export type JustificationContentData = {
  kicker: string;
  cards: JustificationCard[];
};

export const DEFAULT_JUSTIFICATION_CONTENT: JustificationContentData = {
  kicker: "Justificativa",
  cards: [
    {
      label: "A dor",
      title: "Equipamentos complexos tratados como “caixas pretas”",
      description:
        "Muitos profissionais operam sem dominar o impacto clínico de cada parâmetro.",
    },
    {
      label: "A consequência",
      title: "Erro técnico vira risco clínico",
      description:
        "Resultado: artefatos, pior qualidade diagnóstica e mais risco terapêutico.",
    },
    {
      label: "A lacuna formativa",
      title: "Graduação insuficiente e acesso desigual à atualização",
      description:
        "Muitas graduações não aprofundam o ensino de novas tecnologias, e a formação continuada é escassa fora dos grandes centros.",
    },
    {
      label: "A solução ProGenia",
      title: "Simulação visual para prática clínica segura",
      description: "Transformamos teoria em prática segura: testar, interpretar e corrigir condutas.",
    },
  ],
};

function parseCard(raw: unknown): JustificationCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? "").trim();
  const title = String(o.title ?? "").trim();
  const description = String(o.description ?? "").trim();
  if (!title && !description && !label) return null;
  return { label, title, description };
}

export function normalizeJustificationContentData(raw: unknown): JustificationContentData {
  const d = DEFAULT_JUSTIFICATION_CONTENT;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kicker: d.kicker, cards: d.cards.map((c) => ({ ...c })) };
  }
  const o = raw as Record<string, unknown>;
  let cards: JustificationCard[] = d.cards.map((c) => ({ ...c }));
  if (Array.isArray(o.cards)) {
    const parsed = o.cards.map(parseCard).filter(Boolean) as JustificationCard[];
    if (parsed.length > 0) cards = parsed;
  }
  return {
    kicker: String(o.kicker ?? d.kicker),
    cards,
  };
}

export function isJustificationContentData(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      ("cards" in (raw as object) || "kicker" in (raw as object))
  );
}
