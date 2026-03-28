/** Tempo total de demonstração por laboratório (visitante não logado), por sessão do navegador. */
export const LAB_DEMO_DURATION_MS = 60 * 1000;

export function labDemoStorageKey(slug: string) {
  return `progenia_lab_demo_until_${slug}`;
}
