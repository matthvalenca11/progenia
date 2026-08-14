import { describe, expect, it } from "vitest";
import {
  isProtectedAcronym,
  restoreProtectedAcronyms,
} from "@/lib/translationProtect";

describe("translationProtect", () => {
  it("keeps TENS as an acronym, not the verb tens", () => {
    expect(isProtectedAcronym("TENS")).toBe(true);
    expect(restoreProtectedAcronyms("TENS", "YOU HAVE")).toBe("TENS");
    expect(restoreProtectedAcronyms("Laboratório Virtual de TENS", "YOU HAVE Virtual Laboratory")).toBe(
      "TENS Virtual Laboratory",
    );
  });

  it("leaves unrelated you-have sentences alone", () => {
    expect(restoreProtectedAcronyms("Você tem acesso", "You have access")).toBe("You have access");
  });
});
