/**
 * Medical / UI terms that machine translation routinely mangles.
 */
export const PROTECTED_ACRONYMS = [
  "NMES",
  "FES",
  "EMG",
  "EEG",
  "ECG",
  "MRI",
  "LLLT",
  "FBM",
  "PET",
  "RM",
  "TC",
  "CT",
] as const;

const ACRONYM_MISTRANSLATIONS: Record<string, string[]> = {};

const acronymWord = (acronym: string) => new RegExp(`\\b${acronym}\\b`, "i");

export const isProtectedAcronym = (text: string) => {
  const trimmed = text.trim();
  return PROTECTED_ACRONYMS.some((acronym) => acronym.toLowerCase() === trimmed.toLowerCase());
};

export const restoreProtectedAcronyms = (source: string, translated: string) => {
  let result = translated;
  for (const acronym of PROTECTED_ACRONYMS) {
    if (!acronymWord(acronym).test(source)) continue;
    if (new RegExp(`\\b${acronym}\\b`).test(result)) continue;
    const knownBads = ACRONYM_MISTRANSLATIONS[acronym] ?? [];
    for (const bad of knownBads) {
      result = result.replace(new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), acronym);
    }
    if (!acronymWord(acronym).test(result) && isProtectedAcronym(source)) {
      result = acronym;
    }
  }
  return result;
};
