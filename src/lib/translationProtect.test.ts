import { describe, expect, it } from "vitest";
import { isProtectedAcronym, restoreProtectedAcronyms } from "./translationProtect";

describe("translationProtect", () => {
  it("recognizes protected medical acronyms", () => {
    expect(isProtectedAcronym("MRI")).toBe(true);
    expect(isProtectedAcronym("NMES")).toBe(true);
    expect(isProtectedAcronym("eletroterapia")).toBe(false);
  });

  it("restores MRI when mistranslated", () => {
    expect(restoreProtectedAcronyms("MRI", "RM")).toBe("MRI");
  });
});
