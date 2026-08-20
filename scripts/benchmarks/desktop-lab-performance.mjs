import { cpus, platform, release } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8080";
const routes = [
  { id: "therapeutic_ultrasound", path: "/dev/lab-smoke/ultrasound-therapy" },
  { id: "photobiomodulation", path: "/dev/lab-smoke/photobio" },
];
const frameWindows = 3;
const updatesPerWindow = 40;
const sampleDurationMs = 5000;

async function samplePage(page) {
  return page.evaluate(async ({ sampleDurationMs, frameWindows, updatesPerWindow }) => {
    const oneSample = async () => {
      const frameIntervals = [];
      let previous = performance.now();
      const until = previous + sampleDurationMs;
      await new Promise((resolve) => {
        const tick = (now) => {
          frameIntervals.push(now - previous);
          previous = now;
          if (now >= until) {
            resolve();
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      });

      const control =
        document.querySelector('input[type="range"]') ??
        document.querySelector('[role="slider"]');
      const latencyMs = [];
      if (control instanceof HTMLElement) {
        for (let index = 0; index < updatesPerWindow; index += 1) {
          const startedAt = performance.now();
          control.focus();
          control.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
          );
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          latencyMs.push(performance.now() - startedAt);
        }
      }
      return { frameIntervals, latencyMs };
    };

    const samples = [];
    for (let index = 0; index < frameWindows; index += 1) {
      samples.push(await oneSample());
    }
    return samples;
  }, { sampleDurationMs, frameWindows, updatesPerWindow });
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(samples) {
  const frameIntervals = samples.flatMap((sample) => sample.frameIntervals).filter((value) => value > 0);
  const fps = frameIntervals.map((interval) => 1000 / interval);
  const latency = samples.flatMap((sample) => sample.latencyMs);
  return {
    frameSamples: frameIntervals.length,
    controlSamples: latency.length,
    updateLatencyMs: {
      median: percentile(latency, 0.5),
      p95: percentile(latency, 0.95),
    },
    fps: {
      mean: fps.reduce((sum, value) => sum + value, 0) / fps.length,
      p5: percentile(fps, 0.05),
    },
  };
}

const headed = process.env.BENCHMARK_HEADED === "true";
const browser = await chromium.launch({
  headless: !headed,
  args: ["--enable-gpu", "--use-angle=metal"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  for (const route of routes) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const samples = await samplePage(page);
    results.push({ lab: route.id, ...summarize(samples) });
  }
} finally {
  await browser.close();
}

const output = {
  generatedAt: new Date().toISOString(),
  environment: {
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    browser: `Playwright Chromium ${headed ? "headed" : "headless"}`,
    viewport: "1440x1000",
    warmupMs: 2000,
    frameWindows,
    updatesPerWindow,
    sampleDurationMs,
  },
  results,
};

await mkdir(resolve("results"), { recursive: true });
await writeFile(resolve("results/desktop-lab-performance.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
