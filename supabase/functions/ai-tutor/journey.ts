export type TutorSuggestion = {
  title: string;
  path: string;
  kind: "lesson" | "capsula" | "lab" | "module";
  reason: string;
};

export type LearnerSummary = {
  lessonsDone: number;
  capsulasDone: number;
  labsTried: number;
  enrolledCount: number;
  streakDays: number;
};

export type LearnerJourney = {
  context: string;
  suggestions: TutorSuggestion[];
  firstName: string | null;
  isGuest: boolean;
  summary: LearnerSummary;
};

export function prioritizeSuggestions(suggestions: TutorSuggestion[], intent?: string) {
  if (intent === "explore") {
    return [...suggestions].sort((a, b) => Number(b.kind === "lab") - Number(a.kind === "lab"));
  }
  if (intent === "progress") {
    return [...suggestions].sort((a, b) => Number(a.kind === "lab") - Number(b.kind === "lab"));
  }
  return suggestions;
}

type SupabaseEdgeClient = {
  from: (table: string) => any;
};

const isDone = (status: string | null | undefined, pct: number | null | undefined) =>
  status === "concluido" || (pct ?? 0) >= 100;

const firstNameFrom = (fullName: string | null | undefined) => {
  const name = (fullName || "").trim().split(/\s+/)[0];
  return name || null;
};

export function composeGuideReply(
  journey: LearnerJourney,
  language: "pt" | "en",
  intent?: string,
) {
  const en = language === "en";
  const name = journey.firstName;
  const hello = name ? (en ? `Hi ${name}.` : `Oi, ${name}.`) : en ? "Hi." : "Oi.";
  const next = journey.suggestions[0];
  const extra = journey.suggestions[1];
  const { lessonsDone, capsulasDone, labsTried, enrolledCount, streakDays } = journey.summary;

  if (journey.isGuest) {
    const guestNext = next
      ? en
        ? `A good place to start is [${next.title}](${next.path}).`
        : `Um bom começo é [${next.title}](${next.path}).`
      : "";
    return en
      ? `${hello} Sign in so I can follow your path. Meanwhile, try a short capsule or a virtual lab.\n\n${guestNext}`
      : `${hello} Entre na sua conta para eu acompanhar sua trilha. Enquanto isso, experimente uma cápsula ou um laboratório virtual.\n\n${guestNext}`;
  }

  if (!next) {
    return en
      ? `${hello} I can help you pick a module, a capsule, or a lab. What do you want to learn?`
      : `${hello} Posso te indicar um módulo, uma cápsula ou um laboratório. O que você quer aprender agora?`;
  }

  const second = extra
    ? en
      ? ` If you want something more practical, try [${extra.title}](${extra.path}).`
      : ` Se quiser algo mais prático, experimente [${extra.title}](${extra.path}).`
    : "";

  if (intent === "progress") {
    const streak = streakDays > 0
      ? en ? ` Streak: ${streakDays} day(s).` : ` Sequência: ${streakDays} dia(s).`
      : "";
    return en
      ? `${hello} You have finished ${lessonsDone} lesson(s) and ${capsulasDone} capsule(s), tried ${labsTried} lab(s), and enrolled in ${enrolledCount} module(s).${streak} Next: [${next.title}](${next.path}).${second}`
      : `${hello} Você já concluiu ${lessonsDone} aula(s) e ${capsulasDone} cápsula(s), experimentou ${labsTried} lab(s) e está em ${enrolledCount} módulo(s).${streak} Próximo passo: [${next.title}](${next.path}).${second}`;
  }

  if (intent === "explore") {
    const lab = journey.suggestions.find((item) => item.kind === "lab") || next;
    return en
      ? `${hello} To try something new, open [${lab.title}](${lab.path}). It is a practical way to keep moving on the platform.`
      : `${hello} Para experimentar algo novo, abra [${lab.title}](${lab.path}). É um jeito prático de avançar na plataforma.`;
  }

  return en
    ? `${hello} Based on what you already did, the next step is [${next.title}](${next.path}).${second}`
    : `${hello} Pelo que você já fez, o próximo passo é [${next.title}](${next.path}).${second}`;
}

export type TutorNudge = TutorSuggestion & { prompt: string };

export function composeNudge(journey: LearnerJourney, language: "pt" | "en"): TutorNudge | null {
  if (journey.isGuest) return null;
  const item = journey.suggestions[0];
  if (!item) return null;
  const en = language === "en";
  const prompt =
    item.kind === "lab"
      ? en
        ? `Want to try ${item.title}? It is a practical next step.`
        : `Que tal experimentar ${item.title}? É um próximo passo prático.`
      : item.kind === "capsula"
        ? en
          ? `A short next step: ${item.title}.`
          : `Um próximo passo curto: ${item.title}.`
        : item.kind === "module"
          ? en
            ? `A good place to continue: ${item.title}.`
            : `Um bom lugar para continuar: ${item.title}.`
          : en
            ? `Continue with ${item.title}?`
            : `Continuar com ${item.title}?`;
  return { ...item, prompt };
}

export async function fetchLearnerJourney(
  supabase: SupabaseEdgeClient,
  userId: string | null,
): Promise<LearnerJourney> {
  const [
    modulesRes,
    lessonsRes,
    capsulasRes,
    labsRes,
  ] = await Promise.all([
    supabase.from("modules").select("id, title, description, order_index").eq("is_published", true).order("order_index"),
    supabase.from("lessons").select("id, title, module_id, order_index").eq("is_published", true).order("order_index"),
    supabase.from("capsulas").select("id, title, module_id, order_index").eq("is_published", true).order("order_index"),
    supabase.from("virtual_labs").select("id, title, slug, lab_type").eq("is_published", true),
  ]);

  const modules = (modulesRes.data || []) as Array<{ id: string; title: string; description: string | null; order_index: number | null }>;
  const lessons = (lessonsRes.data || []) as Array<{ id: string; title: string; module_id: string | null; order_index: number | null }>;
  const capsulas = (capsulasRes.data || []) as Array<{ id: string; title: string; module_id: string | null; order_index: number | null }>;
  const labs = (labsRes.data || []) as Array<{ id: string; title: string; slug: string; lab_type: string }>;

  if (!userId) {
    const suggestions: TutorSuggestion[] = [];
    const firstModule = modules[0];
    if (firstModule) {
      suggestions.push({
        title: firstModule.title,
        path: `/module/${firstModule.id}`,
        kind: "module",
        reason: "primeiro módulo da trilha",
      });
    }
    if (capsulas[0]) {
      suggestions.push({
        title: capsulas[0].title,
        path: `/capsula/${capsulas[0].id}`,
        kind: "capsula",
        reason: "cápsula rápida para começar",
      });
    }
    if (labs[0]) {
      suggestions.push({
        title: labs[0].title,
        path: `/labs/${labs[0].slug}`,
        kind: "lab",
        reason: "laboratório para experimentar na prática",
      });
    }
    return {
      isGuest: true,
      firstName: null,
      suggestions: suggestions.slice(0, 3),
      summary: { lessonsDone: 0, capsulasDone: 0, labsTried: 0, enrolledCount: 0, streakDays: 0 },
      context:
        "\n\nTRILHA DO ALUNO: visitante sem login. Convide a entrar na conta. Sugira cápsulas e labs livres, e módulos para matrícula.\n",
    };
  }

  const [
    profileRes,
    enrollRes,
    lessonProgressRes,
    capsulaProgressRes,
    statsRes,
    labEventsRes,
    labLinksRes,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("module_enrollments").select("module_id, enrolled_at").eq("user_id", userId),
    supabase.from("lesson_progress").select("lesson_id, status, progress_percentage, updated_at").eq("user_id", userId),
    supabase.from("capsula_progress").select("capsula_id, status, progress_percentage, updated_at").eq("user_id", userId),
    supabase.from("user_stats").select("level, streak_days, total_lessons_completed, last_activity_date").eq("user_id", userId).maybeSingle(),
    supabase.from("lab_usage_events").select("lab_id, created_at, event_type").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("capsula_virtual_labs").select("capsula_id, lab_id, position"),
  ]);

  const firstName = firstNameFrom(profileRes.data?.full_name);
  const enrolledIds = new Set((enrollRes.data || []).map((row: { module_id: string }) => row.module_id));
  const doneLessons = new Set(
    (lessonProgressRes.data || [])
      .filter((row: { status: string | null; progress_percentage: number | null }) => isDone(row.status, row.progress_percentage))
      .map((row: { lesson_id: string }) => row.lesson_id),
  );
  const inProgressLessons = (lessonProgressRes.data || []).filter(
    (row: { status: string | null; progress_percentage: number | null; lesson_id: string }) =>
      !isDone(row.status, row.progress_percentage) && (row.progress_percentage ?? 0) > 0,
  ) as Array<{ lesson_id: string; progress_percentage: number | null }>;
  const doneCapsulas = new Set(
    (capsulaProgressRes.data || [])
      .filter((row: { status: string | null; progress_percentage: number | null }) => isDone(row.status, row.progress_percentage))
      .map((row: { capsula_id: string }) => row.capsula_id),
  );
  const usedLabIds = new Set((labEventsRes.data || []).map((row: { lab_id: string }) => row.lab_id));
  const labById = new Map(labs.map((lab) => [lab.id, lab]));
  const labsByCapsula = new Map<string, string[]>();
  for (const link of labLinksRes.data || []) {
    const list = labsByCapsula.get(link.capsula_id) || [];
    list.push(link.lab_id);
    labsByCapsula.set(link.capsula_id, list);
  }

  const suggestions: TutorSuggestion[] = [];
  const enrolledModules = modules.filter((module) => enrolledIds.has(module.id));
  const lines: string[] = [];

  lines.push(`Nome: ${firstName || "aluno"}`);
  const stats = statsRes.data;
  if (stats) {
    lines.push(
      `Estatísticas: nível ${stats.level ?? 1}, sequência ${stats.streak_days ?? 0} dia(s), aulas concluídas ${stats.total_lessons_completed ?? doneLessons.size}.`,
    );
  } else {
    lines.push(`Aulas concluídas: ${doneLessons.size}. Cápsulas concluídas: ${doneCapsulas.size}.`);
  }

  if (enrolledModules.length === 0) {
    lines.push("Matrículas: nenhuma.");
    const starter = modules[0];
    if (starter) {
      suggestions.push({
        title: starter.title,
        path: `/module/${starter.id}`,
        kind: "module",
        reason: "ainda não está matriculado; comece por um módulo",
      });
    }
  } else {
    lines.push("Matrículas:");
    for (const module of enrolledModules) {
      const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
      const moduleCapsulas = capsulas.filter((capsula) => capsula.module_id === module.id);
      const lessonDone = moduleLessons.filter((lesson) => doneLessons.has(lesson.id)).length;
      const capsulaDone = moduleCapsulas.filter((capsula) => doneCapsulas.has(capsula.id)).length;
      const total = moduleLessons.length + moduleCapsulas.length;
      const completed = lessonDone + capsulaDone;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      lines.push(`- ${module.title} (${pct}% · ${completed}/${total}) → /module/${module.id}`);

      const resumeLesson = inProgressLessons
        .map((row) => moduleLessons.find((lesson) => lesson.id === row.lesson_id))
        .find(Boolean);
      const nextLesson = resumeLesson || moduleLessons.find((lesson) => !doneLessons.has(lesson.id));
      if (nextLesson && suggestions.length < 3) {
        suggestions.push({
          title: nextLesson.title,
          path: `/lesson/${nextLesson.id}`,
          kind: "lesson",
          reason: resumeLesson
            ? `continuar aula em andamento do módulo ${module.title}`
            : `próxima aula do módulo ${module.title}`,
        });
      }

      const nextCapsula = moduleCapsulas.find((capsula) => !doneCapsulas.has(capsula.id));
      if (nextCapsula && suggestions.length < 3) {
        suggestions.push({
          title: nextCapsula.title,
          path: `/capsula/${nextCapsula.id}`,
          kind: "capsula",
          reason: `cápsula ainda não feita no módulo ${module.title}`,
        });
        const linkedLabId = (labsByCapsula.get(nextCapsula.id) || []).find((labId) => !usedLabIds.has(labId));
        const linkedLab = linkedLabId ? labById.get(linkedLabId) : undefined;
        if (linkedLab && suggestions.length < 3) {
          suggestions.push({
            title: linkedLab.title,
            path: `/labs/${linkedLab.slug}`,
            kind: "lab",
            reason: `laboratório ligado à cápsula ${nextCapsula.title}`,
          });
        }
      }
    }
  }

  const recentDoneCapsulas = (capsulaProgressRes.data || [])
    .filter((row: { status: string | null; progress_percentage: number | null }) => isDone(row.status, row.progress_percentage))
    .slice(0, 3) as Array<{ capsula_id: string }>;
  if (recentDoneCapsulas.length) {
    const titles = recentDoneCapsulas
      .map((row) => capsulas.find((capsula) => capsula.id === row.capsula_id)?.title)
      .filter(Boolean);
    if (titles.length) lines.push(`Cápsulas recentes: ${titles.join("; ")}.`);
  }

  const unusedLab = labs.find((lab) => !usedLabIds.has(lab.id));
  if (unusedLab && !suggestions.some((item) => item.path === `/labs/${unusedLab.slug}`)) {
    suggestions.push({
      title: unusedLab.title,
      path: `/labs/${unusedLab.slug}`,
      kind: "lab",
      reason: usedLabIds.size === 0
        ? "ainda não experimentou laboratórios virtuais"
        : "laboratório que ainda não experimentou",
    });
  }

  const untriedCapsula = capsulas.find((capsula) => !doneCapsulas.has(capsula.id) && (!capsula.module_id || enrolledIds.has(capsula.module_id) || !capsula.module_id));
  if (untriedCapsula && !suggestions.some((item) => item.path === `/capsula/${untriedCapsula.id}`)) {
    suggestions.push({
      title: untriedCapsula.title,
      path: `/capsula/${untriedCapsula.id}`,
      kind: "capsula",
      reason: "conteúdo novo para variar a trilha",
    });
  }

  const unique = suggestions.filter((item, index, list) => list.findIndex((other) => other.path === item.path) === index).slice(0, 4);
  lines.push("Próximos passos calculados (use EXATAMENTE estes links):");
  for (const item of unique) {
    lines.push(`- [${item.title}](${item.path}) — ${item.reason}`);
  }

  return {
    isGuest: false,
    firstName,
    suggestions: unique,
    summary: {
      lessonsDone: doneLessons.size,
      capsulasDone: doneCapsulas.size,
      labsTried: usedLabIds.size,
      enrolledCount: enrolledModules.length,
      streakDays: stats?.streak_days ?? 0,
    },
    context: `\n\nTRILHA DO ALUNO (fatos; não invente progresso):\n${lines.join("\n")}\n`,
  };
}
