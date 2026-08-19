/** Keep in sync with src/lib/ptEnOverrides.ts */

const stripDiacritics = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const normalizeLookupKey = (text: string) =>
  stripDiacritics(
    text
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  ).toLowerCase();

const PAIRS: readonly [string, string][] = [
  ["Entrar", "Sign In"],
  ["Começar", "Sign Up"],
  ["Acessar", "Sign In"],
  ["Sobre", "About"],
  ["Sair", "Log Out"],
  ["Voltar", "Back"],
  ["Voltar para o início", "Back to home"],
  ["Perfil", "Profile"],
  ["Buscar", "Search"],
  ["Carregando...", "Loading..."],
  ["Carregando seu painel...", "Loading your dashboard..."],
  ["Bem-vindo", "Welcome"],
  ["Aulas concluídas", "Lessons completed"],
  ["Cápsulas concluídas", "Capsules completed"],
  ["Módulos concluídos", "Modules completed"],
  ["Minutos aprendidos", "Minutes studied"],
  ["Em alta hoje", "Trending today"],
  ["Em Alta Hoje", "Trending today"],
  ["Módulos", "Modules"],
  ["Nenhum módulo disponível ainda.", "No modules available yet."],
  ["Progresso no ciclo", "Cycle progress"],
  ["Resumo rápido", "Quick summary"],
  ["Continuar de Onde Parou", "Continue where you left off"],
  ["Explorar Módulos", "Explore modules"],
  ["Nenhum Módulo Disponível Ainda", "No modules available yet"],
  ["Matricular", "Enroll"],
  ["Matrícula necessária", "Enrollment required"],
  ["Ver cápsulas", "View capsules"],
  ["Conferir", "Check out"],
  ["Todas as cápsulas", "All capsules"],
  ["Cápsula Rápida", "Quick capsule"],
  ["Cápsula em Progresso", "Capsule in progress"],
  ["Cancelar Matrícula", "Cancel enrollment"],
  ["Cápsulas", "Capsules"],
  ["Aulas", "Lessons"],
  ["Seu painel de aprendizagem", "Your learning dashboard"],
  ["Ver aulas", "View lessons"],
  ["Ver módulo", "View module"],
  ["Ver módulos", "View modules"],
  ["capsulas rapidas", "quick capsules"],
  ["capsula rapida", "quick capsule"],
  ["Cápsulas Rápidas", "Quick capsules"],
  ["Carregando módulo...", "Loading module..."],
  ["Módulo não encontrado", "Module not found"],
  ["Módulo", "Module"],
  ["Progresso do Módulo", "Module progress"],
  ["Carregando aula...", "Loading lesson..."],
  ["Aula", "Lesson"],
  ["Aulas", "Lessons"],
  ["Aula bloqueada", "Lesson locked"],
  ["Aula Completa", "Full lesson"],
  ["Carregando cápsula...", "Loading capsule..."],
  ["Carregando cápsulas...", "Loading capsules..."],
  ["Cápsula", "Capsule"],
  ["Cápsulas", "Capsules"],
  ["Laboratório Virtual", "Virtual lab"],
  ["Laboratórios Virtuais", "Virtual labs"],
  ["Diagnóstico por imagem", "Medical imaging"],
  ["Diagnóstico por Imagem", "Medical Imaging"],
  ["Imagem médica", "Medical imaging"],
  ["Ultrassom", "Ultrasound"],
  ["Ultrassom diagnóstico", "Diagnostic ultrasound"],
  ["Ultrassom terapêutico", "Therapeutic ultrasound"],
  ["Eletroterapia", "Electrotherapy"],
  ["Fotobiomodulação", "Photobiomodulation"],
  ["ressonância magnética", "magnetic resonance imaging"],
  ["cápsula", "capsule"],
  ["cápsulas", "capsules"],
  ["aula", "lesson"],
  ["aulas", "lessons"],
  ["módulo", "module"],
  ["módulos", "modules"],
  ["ultrassom", "ultrasound"],
  ["eletroterapia", "electrotherapy"],
  ["fisioterapia", "physical therapy"],
  ["parâmetros", "parameters"],
  ["laboratório", "lab"],
  ["laboratórios", "labs"],
  ["conteúdo", "content"],
  ["conteúdos", "content"],
  ["matrícula", "enrollment"],
  ["matricular", "enroll"],
  ["Matricular-se", "Enroll"],
  ["Ver Cápsulas", "View capsules"],
  ["Ver Aulas", "View lessons"],
  ["Refazer o Módulo", "Retake module"],
  ["Voltar ao Dashboard", "Back to dashboard"],
  ["Matrícula Necessária", "Enrollment required"],
  ["Cápsulas Rápidas", "Quick capsules"],
  ["Progresso do Módulo", "Module progress"],
  ["aulas concluídas", "lessons completed"],
  ["Sair", "Log Out"],
];

export const PT_EN_OVERRIDES: Record<string, string> = Object.fromEntries(
  PAIRS.map(([pt, en]) => [normalizeLookupKey(pt), en]),
);

export const PT_EN_GLOSSARY_PHRASES: readonly { source: string; target: string }[] = [...PAIRS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([source, target]) => ({ source, target }));

export function getForcedPtEnOverride(text: string): string | undefined {
  const key = normalizeLookupKey(text);
  if (!key) return undefined;
  return PT_EN_OVERRIDES[key];
}
