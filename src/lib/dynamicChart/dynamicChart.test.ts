import { describe, expect, it } from "vitest";
import { evaluateCondition } from "@/lib/dynamicChart/conditionEvaluator";
import { buildPresetBlockData, applyClinicalPreset, createEmptyCustomBlock, ejectPresetToCustomFormula } from "@/lib/dynamicChart/presets";
import {
  computeChartSeries,
  resolveFormulaExpression,
  hasValidFormulaSyntax,
} from "@/lib/dynamicChart/formulaEngine";
import {
  createI18nText,
  DYNAMIC_CHART_PRESET_IDS,
  readI18nField,
  writeI18nField,
} from "@/types/dynamicChart";

describe("dynamicChart presets", () => {
  it("computes TENS strength-duration curve", () => {
    const config = buildPresetBlockData("tens_strength_duration");
    const series = computeChartSeries(config, { rheobase: 12, chronaxie: 0.35 });
    expect(series).toHaveLength(1);
    expect(series[0].points.length).toBeGreaterThan(50);
    expect(series[0].points[0].y).toBeGreaterThan(12);
  });

  it("computes Arndt-Schulz peak near optimal dose", () => {
    const config = buildPresetBlockData("pbm_arndt_schulz");
    const series = computeChartSeries(config, { optimal_dose: 4, peak_effect: 100 });
    const peak = Math.max(...series[0].points.map((p) => p.y));
    expect(peak).toBeGreaterThan(90);
  });

  it("computes hemoglobin dissociation with Bohr shift", () => {
    const config = buildPresetBlockData("hb_bohr_dissociation");
    const normal = computeChartSeries(config, { pco2: 40, ph: 7.4, temperature: 37 });
    const acidosis = computeChartSeries(config, { pco2: 50, ph: 7.2, temperature: 37 });
    const sao2At40 = normal[0].points.find((p) => p.x >= 40)?.y ?? 0;
    const sao2AcidosisAt40 = acidosis[0].points.find((p) => p.x >= 40)?.y ?? 0;
    expect(sao2At40).toBeGreaterThan(sao2AcidosisAt40);
  });

  it("computes Hill force-velocity hyperbola", () => {
    const config = buildPresetBlockData("hill_force_velocity");
    const series = computeChartSeries(config, { f0: 600, vmax: 1.2 });
    expect(series[0].points[0].y).toBeCloseTo(600, 0);
    const last = series[0].points[series[0].points.length - 1];
    expect(last.y).toBeLessThan(50);
  });

  it("computes action potential with multiple series", () => {
    const config = buildPresetBlockData("action_potential");
    const series = computeChartSeries(config, { g_na: 1, g_k: 1, v_rest: -70, v_peak: 30 });
    expect(series.length).toBeGreaterThanOrEqual(3);
    const vmPeak = Math.max(...series[0].points.map((p) => p.y));
    expect(vmPeak).toBeGreaterThan(20);
  });

  it("applyClinicalPreset resets axes and feedbacks when switching models", () => {
    const tens = buildPresetBlockData("tens_strength_duration");
    const mutated = {
      ...tens,
      axes: {
        x: { ...tens.axes.x, min: 999, max: 1000 },
        y: { ...tens.axes.y, min: -50, max: 50 },
      },
      conditionalFeedbacks: [
        {
          id: "custom",
          condition: "true",
          feedbackText: "Custom",
          type: "info" as const,
          priority: 1,
        },
      ],
    };
    const hb = applyClinicalPreset(mutated, "hb_bohr_dissociation", {
      preservePresentation: true,
    });
    expect(hb.axes.x.min).toBe(0);
    expect(hb.axes.x.max).toBe(100);
    expect(hb.conditionalFeedbacks.length).toBeGreaterThan(1);
    expect(hb.conditionalFeedbacks.some((f) => f.condition.includes("ph"))).toBe(true);
    expect(hb.parameters.some((p) => p.id === "pco2")).toBe(true);
  });

  it("applyClinicalPreset can preserve axes and feedbacks when switching models", () => {
    const tens = buildPresetBlockData("tens_strength_duration");
    const mutated = {
      ...tens,
      axes: {
        x: { ...tens.axes.x, min: 999, max: 1000 },
        y: { ...tens.axes.y, min: -50, max: 50 },
      },
      conditionalFeedbacks: [
        {
          id: "custom",
          condition: "true",
          feedbackText: "Custom",
          type: "info" as const,
          priority: 1,
        },
      ],
    };
    const hb = applyClinicalPreset(mutated, "hb_bohr_dissociation", {
      preservePresentation: true,
      preserveAxesAndFeedbacks: true,
    });
    expect(hb.axes.x.min).toBe(999);
    expect(hb.axes.x.max).toBe(1000);
    expect(hb.conditionalFeedbacks).toEqual(mutated.conditionalFeedbacks);
    expect(hb.parameters.some((p) => p.id === "pco2")).toBe(true);
    expect(hb.preset_id).toBe("hb_bohr_dissociation");
  });

  it("ejectPresetToCustomFormula imports preset content without preset_id", () => {
    const custom = createEmptyCustomBlock();
    const imported = ejectPresetToCustomFormula(custom, "tens_strength_duration");
    expect(imported.source_type).toBe("custom_formula");
    expect(imported.preset_id).toBeUndefined();
    expect(imported.parameters.some((p) => p.id === "rheobase")).toBe(true);
    expect(imported.formulas?.length).toBeGreaterThan(0);
    expect(hasValidFormulaSyntax(imported.formulas![0].equation ?? "")).toBe(true);
    const series = computeChartSeries(imported, { rheobase: 12, chronaxie: 0.35 });
    expect(series[0].points.length).toBeGreaterThan(10);
  });

  it("builds all clinical presets with non-empty series", () => {
    for (const presetId of DYNAMIC_CHART_PRESET_IDS) {
      const config = buildPresetBlockData(presetId);
      const params = Object.fromEntries(
        config.parameters.map((p) => [p.id, p.defaultValue]),
      );
      const series = computeChartSeries(config, params);
      expect(series.length).toBeGreaterThan(0);
      expect(series[0].points.length).toBeGreaterThan(10);
    }
  });
});

describe("i18n helpers", () => {
  it("reads and writes bilingual fields", () => {
    const initial = createI18nText("Olá", "Hello");
    expect(readI18nField(initial, "en")).toBe("Hello");
    const updated = writeI18nField(initial, "en", "Hi there");
    expect(updated).toEqual({ pt: "Olá", en: "Hi there" });
  });

  it("migrates legacy string to bilingual on write", () => {
    const updated = writeI18nField("Legado", "en", "Legacy EN");
    expect(updated).toEqual({ pt: "Legado", en: "Legacy EN" });
  });
});

describe("custom formulas", () => {
  it("does not crash while an expression is incomplete", () => {
    const config = {
      ...buildPresetBlockData("tens_strength_duration"),
      source_type: "custom_formula" as const,
      preset_id: undefined,
      formulas: [
        {
          id: "series1",
          label: "Série 1",
          expression: "a * (x +",
        },
      ],
    };

    expect(() => computeChartSeries(config, { a: 2 })).not.toThrow();
    expect(computeChartSeries(config, { a: 2 })[0].points).toEqual([]);
  });

  it("renders multiple custom formula series", () => {
    const config = {
      ...buildPresetBlockData("tens_strength_duration"),
      source_type: "custom_formula" as const,
      preset_id: undefined,
      formulas: [
        {
          id: "s1",
          name: "Linear",
          equation: "x",
          color: "#000",
          thickness: 2,
        },
        {
          id: "s2",
          name: "Quadratic",
          equation: "x^2",
          color: "#f00",
          thickness: 3,
        },
      ],
    };

    const series = computeChartSeries(config, {});
    expect(series).toHaveLength(2);
    expect(series[0].strokeWidth).toBe(2);
    expect(series[1].strokeWidth).toBe(3);
    expect(resolveFormulaExpression(config.formulas![1])).toBe("x^2");
  });
});

describe("conditional feedback", () => {
  it("evaluates compound conditions", () => {
    expect(evaluateCondition("a > 5 && b < 3", { a: 6, b: 2 })).toBe(true);
    expect(evaluateCondition("a > 5 && b < 3", { a: 4, b: 2 })).toBe(false);
  });
});
