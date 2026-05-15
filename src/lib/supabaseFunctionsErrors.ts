/** Lê o JSON retornado por uma Edge Function quando `invoke` falha com status não-2xx. */
export async function readEdgeFunctionErrorBody(
  error: unknown,
): Promise<{ error?: string; hint?: string; code?: string } | null> {
  if (!error || typeof error !== "object") return null;
  const ctx = (error as { context?: Response }).context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    return (await ctx.json()) as { error?: string; hint?: string; code?: string };
  } catch {
    return null;
  }
}
