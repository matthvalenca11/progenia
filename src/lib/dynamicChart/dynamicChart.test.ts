import { describe, expect, it } from "vitest";
import { evaluateCondition } from "@/lib/dynamicChart/conditionEvaluator";
import { computeChartSeries } from "@/lib/dynamicChart/formulaEngine";
import { buildPresetBlockData } from "@/lib/dynamicChart/presets";

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
});

describe("conditional feedback", () => {
  it("evaluates compound conditions", () => {
    expect(evaluateCondition("a > 5 && b < 3", { a: 6, b: 2 })).toBe(true);
    expect(evaluateCondition("a > 5 && b < 3", { a: 4, b: 2 })).toBe(false);
  });
});
