import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { enrollmentService } from "@/services/enrollmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, BookOpen, GraduationCap, Pill, Loader2 } from "lucide-react";
import { AiDisclaimerPopover } from "@/components/ai/AiDisclaimerPopover";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

type ModuleItem = {
  id: string;
  title: string;
  description: string | null;
};

type LessonItem = {
  id: string;
  title: string;
  description: string | null;
  module_id: string | null;
  content_data?: { thumbnail?: string } | null;
  modules?: { title?: string } | null;
};

type CapsulaItem = {
  id: string;
  title: string;
  description: string | null;
  module_id: string | null;
  thumbnail_url?: string | null;
  modules?: { title?: string } | null;
};

type ResultItem = {
  id: string;
  kind: "module" | "lesson" | "capsula";
  title: string;
  description: string | null;
  moduleId: string | null;
  moduleTitle: string | null;
  score: number;
  requiresEnrollment: boolean;
  isEnrolled: boolean;
  thumbnailUrl: string | null;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "com",
  "por",
  "the",
  "of",
  "and",
  "in",
  "to",
  "for",
  "with",
  "on",
  "a",
  "an",
]);

const tokenize = (text: string) =>
  normalize(text)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

const buildAcronymSet = (text: string) => {
  const tokens = tokenize(text).slice(0, 80);
  const acronyms = new Set<string>();

  for (let start = 0; start < tokens.length; start++) {
    for (let size = 2; size <= 6; size++) {
      const end = start + size;
      if (end > tokens.length) break;
      const window = tokens.slice(start, end);
      const acronym = window.map((part) => part[0]).join("");
      if (acronym.length >= 2) acronyms.add(acronym);
    }
  }

  return acronyms;
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  ultrassom: ["ultrassom", "ultrasom", "ultrasound", "sonografia", "ultrason", "usg"],
  ressonancia: ["ressonancia", "resonancia", "mri", "rm", "magnetica", "magnetic resonance"],
  eletroterapia: ["eletroterapia", "electrotherapy", "tens", "corrente", "estimulacao eletrica", "electrical stimulation"],
};

const extractTopics = (text: string) => {
  const normalized = normalize(text);
  const topics = new Set<string>();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      topics.add(topic);
    }
  }
  return topics;
};

const hasTopicIntersection = (a: Set<string>, b: Set<string>) => {
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
};

const queryHash = (text: string) =>
  Array.from(text).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

const buildLocalInsight = (
  query: string,
  isEnglish: boolean,
  counts: { capsulas: number; lessons: number; modules: number; total: number },
) => {
  const q = normalize(query);
  const hash = queryHash(q);
  const isUltrasound = /\bultrass|\bultras|\busg\b|\bultrasound\b/.test(q);
  const isMri = /\bmri\b|\brm\b|resson/.test(q);
  const isElectro = /eletro|electro|tens|corrente/.test(q);
  const isResolution = /resolu|resolution|frequen|frequency|ganho|gain|profund|depth/.test(q);
  const isRisk = /queim|burn|risco|safety|seguran|dano|lesao/.test(q);

  if (isEnglish) {
    if (counts.total === 0) {
      return `No direct match for "${query}". Try a more technical term (e.g., frequency, gain, depth, safety) to retrieve focused results.`;
    }
    if (isUltrasound && isRisk) {
      const variants = [
        `For "${query}", prioritize dose and thermal/mechanical safety parameters. Review the items below for risk control in ultrasound practice.`,
        `Query "${query}" maps to ultrasound bioeffects and exposure management. Use the results below to compare safe operating strategies.`,
      ];
      return variants[hash % variants.length];
    }
    if (isUltrasound && isResolution) {
      const variants = [
        `For "${query}", focus on the frequency–depth–resolution trade-off and interpretation impact. The results below cover this parameter balance.`,
        `Query "${query}" relates to spatial resolution versus penetration in ultrasound. Use the items below to map parameter choice to image quality.`,
      ];
      return variants[hash % variants.length];
    }
    if (isMri) {
      const variants = [
        `For "${query}", focus on contrast, SNR, and sequence parameters. The results below highlight practical MRI optimization points.`,
        `Query "${query}" maps to MRI parameterization and image formation constraints. Use the items below for technical decision guidance.`,
      ];
      return variants[hash % variants.length];
    }
    if (isElectro) {
      const variants = [
        `For "${query}", evaluate waveform, pulse width, and stimulation safety limits. The results below cover applied electrotherapy decisions.`,
        `Query "${query}" points to electrotherapy parameter tuning and clinical safety. Use the listed content for technical calibration criteria.`,
      ];
      return variants[hash % variants.length];
    }
    return `"${query}" maps to technical parameter decisions and interpretation criteria. Use the results below to compare application-focused approaches.`;
  }

  if (counts.total === 0) {
    return `Sem correspondência direta para "${query}". Tente um termo mais técnico (ex.: frequência, ganho, profundidade, segurança) para resultados mais precisos.`;
  }
  if (isUltrasound && isRisk) {
    const variants = [
      `Em "${query}", priorize dose e segurança térmica/mecânica. Os conteúdos abaixo ajudam a controlar risco na prática com ultrassom.`,
      `A busca "${query}" se conecta a bioefeitos do ultrassom e gestão de exposição. Use os resultados abaixo para comparar estratégias seguras.`,
    ];
    return variants[hash % variants.length];
  }
  if (isUltrasound && isResolution) {
    const variants = [
      `Em "${query}", o ponto central é o balanço frequência–profundidade–resolução e seu impacto na interpretação. Os resultados abaixo cobrem esse ajuste.`,
      `A busca "${query}" envolve o trade-off entre resolução espacial e penetração no ultrassom. Use os itens abaixo para mapear parâmetro e qualidade de imagem.`,
    ];
    return variants[hash % variants.length];
  }
  if (isMri) {
    const variants = [
      `Em "${query}", foque em contraste, SNR e parâmetros de sequência. Os resultados abaixo trazem pontos práticos de otimização em RM.`,
      `A busca "${query}" se relaciona à parametrização de RM e limites de formação de imagem. Use os conteúdos abaixo para decisões técnicas.`,
    ];
    return variants[hash % variants.length];
  }
  if (isElectro) {
    const variants = [
      `Em "${query}", avalie forma de onda, largura de pulso e limites de segurança da estimulação. Os resultados abaixo cobrem decisões aplicadas de eletroterapia.`,
      `A busca "${query}" aponta para ajuste de parâmetros em eletroterapia e segurança clínica. Use os itens listados para critérios de calibração.`,
    ];
    return variants[hash % variants.length];
  }
  return `"${query}" se conecta a decisões técnicas de parâmetros e critérios de interpretação. Use os resultados abaixo para comparar abordagens aplicadas.`;
};

export default function ContentSearch() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const [draftQuery, setDraftQuery] = useState(query);

  const [loading, setLoading] = useState(true);
  const [enrollingModuleId, setEnrollingModuleId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [capsulas, setCapsulas] = useState<CapsulaItem[]>([]);
  const [enrolledModuleIds, setEnrolledModuleIds] = useState<Set<string>>(new Set());
  const [searchAlternatives, setSearchAlternatives] = useState<string[]>([]);
  const [englishSearchIndex, setEnglishSearchIndex] = useState<Record<string, string>>({});
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const [modulesRes, lessonsRes, capsulasRes, enrollments] = await Promise.all([
          supabase.from("modules").select("id, title, description").eq("is_published", true).order("order_index"),
          supabase
            .from("lessons")
            .select("id, title, description, module_id, content_data, modules:modules!lessons_module_id_fkey(title)")
            .eq("is_published", true),
          supabase
            .from("capsulas")
            .select("id, title, description, module_id, thumbnail_url, modules:modules!capsulas_module_id_fkey(title)")
            .eq("is_published", true),
          enrollmentService.getUserEnrollments(user.id),
        ]);

        if (modulesRes.error) throw modulesRes.error;
        if (lessonsRes.error) throw lessonsRes.error;
        if (capsulasRes.error) throw capsulasRes.error;

        setModules((modulesRes.data || []) as ModuleItem[]);
        setLessons((lessonsRes.data || []) as LessonItem[]);
        setCapsulas((capsulasRes.data || []) as CapsulaItem[]);
        setEnrolledModuleIds(new Set(enrollments.map((item) => item.module_id)));
      } catch (error: any) {
        console.error("Erro ao carregar dados da busca:", error);
        toast.error("Erro ao carregar busca de conteúdo", {
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const allItems: Array<{ key: string; title: string; description: string }> = [
      ...modules.map((item) => ({ key: `module:${item.id}`, title: item.title || "", description: item.description || "" })),
      ...lessons.map((item) => ({ key: `lesson:${item.id}`, title: item.title || "", description: item.description || "" })),
      ...capsulas.map((item) => ({ key: `capsula:${item.id}`, title: item.title || "", description: item.description || "" })),
    ];

    if (allItems.length === 0) {
      setEnglishSearchIndex({});
      return;
    }

    const buildIndex = async () => {
      try {
        const uniqueTexts = Array.from(
          new Set(
            allItems.flatMap((item) => [item.title, item.description]).map((item) => item.trim()).filter(Boolean),
          ),
        );

        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: {
            source: "pt",
            target: "en",
            texts: uniqueTexts,
          },
        });

        if (error || !data?.translations) {
          setEnglishSearchIndex({});
          return;
        }

        const translations = data.translations as Record<string, string>;
        const index: Record<string, string> = {};

        for (const item of allItems) {
          const titleEn = (translations[item.title] || item.title || "").toLowerCase();
          const descEn = (translations[item.description] || item.description || "").toLowerCase();
          index[item.key] = `${titleEn} ${descEn}`.trim();
        }

        setEnglishSearchIndex(index);
      } catch {
        setEnglishSearchIndex({});
      }
    };

    void buildIndex();
  }, [modules, lessons, capsulas]);

  useEffect(() => {
    if (!query) {
      setSearchAlternatives([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const [ptRes, enRes] = await Promise.all([
          supabase.functions.invoke("translate-text", { body: { source: "en", target: "pt", texts: [query] } }),
          supabase.functions.invoke("translate-text", { body: { source: "pt", target: "en", texts: [query] } }),
        ]);

        const alternatives = new Set<string>();
        const queryNorm = normalize(query);

        const collect = (payload: unknown) => {
          if (!payload || typeof payload !== "object" || !("translations" in payload)) return;
          const map = (payload as { translations?: Record<string, string> }).translations;
          if (!map) return;
          const alt = normalize(map[query] || "");
          if (alt && alt !== queryNorm) alternatives.add(alt);
        };

        if (!ptRes.error) collect(ptRes.data);
        if (!enRes.error) collect(enRes.data);

        setSearchAlternatives(Array.from(alternatives));
      } catch {
        setSearchAlternatives([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo<ResultItem[]>(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];
    const queryTopics = extractTopics(normalizedQuery);

    const terms = Array.from(new Set([normalizedQuery, ...searchAlternatives]));
    const tokenTerms = Array.from(
      new Set(
        terms
          .flatMap((term) => tokenize(term))
          .filter((token) => token.length >= 2),
      ),
    );

    const semanticHints = new Set<string>();
    if (tokenTerms.some((token) => token.startsWith("queim") || token.startsWith("burn"))) {
      ["termic", "calor", "aquec", "risco", "segur", "lesao", "dano"].forEach((hint) => semanticHints.add(hint));
    }
    if (tokenTerms.some((token) => token.startsWith("ultras") || token === "us")) {
      ["ultrass", "ultras", "sonografia", "diagnost", "terapeut"].forEach((hint) => semanticHints.add(hint));
    }

    const scoreText = (
      title: string,
      description: string,
      englishBlob: string,
      moduleTitle = "",
      acronymSet: Set<string> = new Set(),
    ) => {
      let score = 0;
      for (const term of terms) {
        if (!term) continue;
        if (title.startsWith(term)) score += 14;
        if (title.includes(term)) score += 9;
        if (description.includes(term)) score += 4;
        if (moduleTitle.includes(term)) score += 3;
        if (englishBlob.includes(term)) score += 6;
        // fallback mais permissivo para termos longos (ex.: ultrassonografia vs ultrassom)
        if (term.length >= 6) {
          const root = term.slice(0, 6);
          if (title.includes(root)) score += 2;
          if (description.includes(root)) score += 1;
          if (englishBlob.includes(root)) score += 2;
        }
        // Busca por siglas/acrônimos (ex.: PRF)
        if (term.length >= 2 && term.length <= 6 && /^[a-z0-9]+$/.test(term)) {
          if (acronymSet.has(term)) {
            score += 12;
          } else {
            for (const acronym of acronymSet) {
              if (acronym.startsWith(term)) {
                score += 5;
                break;
              }
            }
          }
        }
      }

      // Correspondência por palavras-chave da frase (não só frase completa).
      for (const token of tokenTerms) {
        if (title.includes(token)) score += 4;
        if (description.includes(token)) score += 3;
        if (moduleTitle.includes(token)) score += 2;
        if (englishBlob.includes(token)) score += 4;

        if (token.length >= 5) {
          const root = token.slice(0, 5);
          if (title.includes(root)) score += 2;
          if (description.includes(root)) score += 1;
          if (englishBlob.includes(root)) score += 2;
        }
      }

      // Hints semânticos simples para evitar "zero resultados" em consultas comuns.
      for (const hint of semanticHints) {
        if (title.includes(hint)) score += 2;
        if (description.includes(hint)) score += 2;
        if (englishBlob.includes(hint)) score += 2;
      }

      return score;
    };

    let moduleResults: ResultItem[] = modules
      .map((module) => {
        const title = normalize(module.title || "");
        const description = normalize(module.description || "");
        const englishBlob = englishSearchIndex[`module:${module.id}`] || "";
        const itemTopics = extractTopics(`${title} ${description} ${englishBlob}`);
        if (queryTopics.size > 0 && !hasTopicIntersection(queryTopics, itemTopics)) {
          return null;
        }
        const acronymSet = buildAcronymSet(`${title} ${description} ${englishBlob}`);
        const score = scoreText(title, description, englishBlob, "", acronymSet);
        return {
          id: module.id,
          kind: "module" as const,
          title: module.title,
          description: module.description,
          moduleId: module.id,
          moduleTitle: module.title,
          score,
          requiresEnrollment: true,
          isEnrolled: enrolledModuleIds.has(module.id),
          thumbnailUrl: null,
        };
      })
      .filter((item): item is ResultItem => Boolean(item && item.score > 0));

    const lessonResults: ResultItem[] = lessons
      .map((lesson) => {
        const title = normalize(lesson.title || "");
        const description = normalize(lesson.description || "");
        const moduleTitle = normalize(lesson.modules?.title || "");
        const englishBlob = englishSearchIndex[`lesson:${lesson.id}`] || "";
        const itemTopics = extractTopics(`${title} ${description} ${moduleTitle} ${englishBlob}`);
        if (queryTopics.size > 0 && !hasTopicIntersection(queryTopics, itemTopics)) {
          return null;
        }
        const acronymSet = buildAcronymSet(`${title} ${description} ${moduleTitle} ${englishBlob}`);
        const score = scoreText(title, description, englishBlob, moduleTitle, acronymSet);
        const moduleId = lesson.module_id;
        return {
          id: lesson.id,
          kind: "lesson" as const,
          title: lesson.title,
          description: lesson.description,
          moduleId,
          moduleTitle: lesson.modules?.title || null,
          score,
          requiresEnrollment: Boolean(moduleId),
          isEnrolled: moduleId ? enrolledModuleIds.has(moduleId) : true,
          thumbnailUrl: (lesson.content_data as { thumbnail?: string } | null | undefined)?.thumbnail ?? null,
        };
      })
      .filter((item): item is ResultItem => Boolean(item && item.score > 0));

    const capsulaResults: ResultItem[] = capsulas
      .map((capsula) => {
        const title = normalize(capsula.title || "");
        const description = normalize(capsula.description || "");
        const moduleTitle = normalize(capsula.modules?.title || "");
        const englishBlob = englishSearchIndex[`capsula:${capsula.id}`] || "";
        const itemTopics = extractTopics(`${title} ${description} ${moduleTitle} ${englishBlob}`);
        if (queryTopics.size > 0 && !hasTopicIntersection(queryTopics, itemTopics)) {
          return null;
        }
        const acronymSet = buildAcronymSet(`${title} ${description} ${moduleTitle} ${englishBlob}`);
        const score = scoreText(title, description, englishBlob, moduleTitle, acronymSet);
        const moduleId = capsula.module_id;
        return {
          id: capsula.id,
          kind: "capsula" as const,
          title: capsula.title,
          description: capsula.description,
          moduleId,
          moduleTitle: capsula.modules?.title || null,
          score,
          requiresEnrollment: Boolean(moduleId),
          isEnrolled: moduleId ? enrolledModuleIds.has(moduleId) : true,
          thumbnailUrl: capsula.thumbnail_url ?? null,
        };
      })
      .filter((item): item is ResultItem => Boolean(item && item.score > 0));

    // Regra de consistência: se uma cápsula/aula foi sugerida e pertence a um módulo,
    // o módulo correspondente também deve aparecer na seção de módulos.
    const requiredModuleIds = new Set<string>();
    for (const item of [...capsulaResults, ...lessonResults]) {
      if (item.moduleId) requiredModuleIds.add(item.moduleId);
    }

    const moduleResultById = new Map(moduleResults.map((item) => [item.id, item]));
    for (const moduleId of requiredModuleIds) {
      if (moduleResultById.has(moduleId)) continue;
      const moduleData = modules.find((module) => module.id === moduleId);
      if (!moduleData) continue;

      const relatedScores = [...capsulaResults, ...lessonResults]
        .filter((item) => item.moduleId === moduleId)
        .map((item) => item.score);
      const derivedScore = Math.max(...relatedScores, 1) - 0.01;

      const forcedModuleResult: ResultItem = {
        id: moduleData.id,
        kind: "module",
        title: moduleData.title,
        description: moduleData.description,
        moduleId: moduleData.id,
        moduleTitle: moduleData.title,
        score: derivedScore,
        requiresEnrollment: true,
        isEnrolled: enrolledModuleIds.has(moduleData.id),
        thumbnailUrl: null,
      };

      moduleResults.push(forcedModuleResult);
      moduleResultById.set(moduleId, forcedModuleResult);
    }

    return [...lessonResults, ...capsulaResults, ...moduleResults].sort((a, b) => b.score - a.score);
  }, [query, searchAlternatives, modules, lessons, capsulas, englishSearchIndex, enrolledModuleIds]);

  const groupedResults = useMemo(
    () => ({
      capsulas: results.filter((item) => item.kind === "capsula"),
      lessons: results.filter((item) => item.kind === "lesson"),
      modules: results.filter((item) => item.kind === "module"),
    }),
    [results],
  );

  useEffect(() => {
    if (!query) {
      setInsight("");
      return;
    }

    const timer = window.setTimeout(async () => {
      const counts = {
        capsulas: groupedResults.capsulas.length,
        lessons: groupedResults.lessons.length,
        modules: groupedResults.modules.length,
        total: results.length,
      };
      const localInsight = buildLocalInsight(query, isEnglish, counts);

      try {
        setInsight(localInsight);
        setInsightLoading(true);
        const topTitles = results.slice(0, 6).map((item) => item.title);

        const invokePromise = supabase.functions.invoke("search-insight", {
          body: {
            query,
            language: isEnglish ? "en" : "pt",
            counts,
            topTitles,
          },
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          window.setTimeout(() => resolve(null), 2500),
        );

        const invokeResult = await Promise.race([invokePromise, timeoutPromise]);

        if (invokeResult === null) {
          setInsight(localInsight);
          return;
        }

        const message = invokeResult.data && typeof invokeResult.data === "object" && "insight" in invokeResult.data
          ? String((invokeResult.data as { insight?: string }).insight || "")
          : "";
        setInsight(message || localInsight);
      } catch {
        setInsight(localInsight);
      } finally {
        setInsightLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query, isEnglish, groupedResults.capsulas.length, groupedResults.lessons.length, groupedResults.modules.length, results]);

  const handleSubmitSearch = (e: FormEvent) => {
    e.preventDefault();
    const next = draftQuery.trim();
    setSearchParams(next ? { q: next } : {});
  };

  const handleEnroll = async (moduleId: string | null) => {
    if (!user || !moduleId) return;
    try {
      setEnrollingModuleId(moduleId);
      await enrollmentService.enrollInModule(user.id, moduleId);
      setEnrolledModuleIds((prev) => new Set([...prev, moduleId]));
      toast.success(isEnglish ? "Enrollment completed!" : "Matrícula realizada!", {
        description: isEnglish
          ? "Now you can access lessons and capsules in this module."
          : "Agora você pode acessar aulas e cápsulas deste módulo.",
      });
    } catch (error: any) {
      toast.error(isEnglish ? "Enrollment error" : "Erro ao matricular", {
        description: error.message,
      });
    } finally {
      setEnrollingModuleId(null);
    }
  };

  const openResult = (item: ResultItem) => {
    if (item.kind === "module") {
      navigate(`/module/${item.id}/capsulas`);
      return;
    }
    if (item.kind === "lesson") {
      navigate(`/lesson/${item.id}`);
      return;
    }
    navigate(`/capsula/${item.id}`);
  };

  const renderResultCard = (item: ResultItem) => {
    const notEnrolled = item.requiresEnrollment && !item.isEnrolled;
    return (
      <Card key={`${item.kind}-${item.id}`}>
        <CardContent className="p-5">
          <div className="flex gap-4">
            {item.thumbnailUrl && (
              <div className="w-32 h-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
                <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  {item.kind === "lesson" ? (
                    <GraduationCap className="h-3 w-3" />
                  ) : item.kind === "capsula" ? (
                    <Pill className="h-3 w-3" />
                  ) : (
                    <BookOpen className="h-3 w-3" />
                  )}
                  {item.kind === "lesson" ? (isEnglish ? "Lesson" : "Aula") : item.kind === "capsula" ? (isEnglish ? "Capsule" : "Cápsula") : (isEnglish ? "Module" : "Módulo")}
                </Badge>
                {item.moduleTitle && (
                  <Badge variant="secondary">
                    {isEnglish ? "Module:" : "Módulo:"} {item.moduleTitle}
                  </Badge>
                )}
                {notEnrolled && (
                  <Badge variant="destructive">
                    {isEnglish ? "Enrollment required" : "Matrícula necessária"}
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                )}
                {item.kind === "lesson" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {isEnglish
                      ? "This lesson may require prerequisites from the module sequence."
                      : "Esta aula pode exigir pré-requisitos na sequência do módulo."}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {notEnrolled ? (
                  <>
                    <Button
                      onClick={() => void handleEnroll(item.moduleId)}
                      disabled={!item.moduleId || enrollingModuleId === item.moduleId}
                    >
                      {enrollingModuleId === item.moduleId
                        ? isEnglish
                          ? "Enrolling..."
                          : "Matriculando..."
                        : isEnglish
                          ? "Enroll in module"
                          : "Matricular no módulo"}
                    </Button>
                    <Button variant="outline" onClick={() => item.moduleId && navigate(`/module/${item.moduleId}`)}>
                      {isEnglish ? "View module" : "Ver módulo"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => openResult(item)}>
                    {isEnglish ? "Open content" : "Abrir conteúdo"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">{isEnglish ? "Loading search..." : "Carregando busca..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="ProGenia" className="h-8 w-auto progenia-logo shrink-0" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEnglish ? "Back" : "Voltar"}
          </Button>
          <form onSubmit={handleSubmitSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder={isEnglish ? "Search lessons, capsules or modules..." : "Buscar aulas, cápsulas ou módulos..."}
                className="pl-9"
              />
            </div>
            <Button type="submit">{isEnglish ? "Search" : "Buscar"}</Button>
          </form>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <Card className="mb-6 relative">
          <CardHeader className="pb-3">
            <AiDisclaimerPopover
              language={isEnglish ? "en" : "pt"}
              buttonClassName="absolute right-3 top-3 h-9 w-9"
              iconClassName="h-8 w-8"
            />
            <div className="flex items-center gap-2 pr-10">
              <CardTitle className="text-orange-700 dark:text-orange-300">
                {isEnglish ? "AI-suggested content" : "Conteúdos sugeridos pela IA"}
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {query
                ? isEnglish
                  ? `${results.length} result(s) for "${query}".`
                  : `${results.length} resultado(s) para "${query}".`
                : isEnglish
                  ? "Type a keyword or phrase to find related content."
                  : "Digite uma palavra ou frase para encontrar conteúdos relacionados."}
            </p>
            {query && (
              <p className="text-sm text-orange-700/90 dark:text-orange-300/90 leading-6 italic">
                {insight}
              </p>
            )}
          </CardHeader>
        </Card>

        {!query ? null : results.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {isEnglish
                ? "No related content found. Try another term."
                : "Nenhum conteúdo relacionado encontrado. Tente outro termo."}
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">{isEnglish ? "Capsules" : "Cápsulas"}</h3>
                <Badge variant="secondary">{groupedResults.capsulas.length}</Badge>
              </div>
              {groupedResults.capsulas.length > 0 ? (
                <div className="grid gap-4">
                  {groupedResults.capsulas.map(renderResultCard)}
                </div>
              ) : (
                <Card className="p-4 text-sm text-muted-foreground">
                  {isEnglish ? "No capsule results for this search." : "Nenhum resultado de cápsulas para esta busca."}
                </Card>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">{isEnglish ? "Lessons" : "Aulas"}</h3>
                <Badge variant="secondary">{groupedResults.lessons.length}</Badge>
              </div>
              {groupedResults.lessons.length > 0 ? (
                <div className="grid gap-4">
                  {groupedResults.lessons.map(renderResultCard)}
                </div>
              ) : (
                <Card className="p-4 text-sm text-muted-foreground">
                  {isEnglish ? "No lesson results for this search." : "Nenhum resultado de aulas para esta busca."}
                </Card>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">{isEnglish ? "Modules" : "Módulos"}</h3>
                <Badge variant="secondary">{groupedResults.modules.length}</Badge>
              </div>
              {groupedResults.modules.length > 0 ? (
                <div className="grid gap-4">
                  {groupedResults.modules.map(renderResultCard)}
                </div>
              ) : (
                <Card className="p-4 text-sm text-muted-foreground">
                  {isEnglish ? "No module results for this search." : "Nenhum resultado de módulos para esta busca."}
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
