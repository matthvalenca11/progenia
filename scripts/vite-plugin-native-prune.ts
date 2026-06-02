import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Remove assets da landing web que não existem no app iOS/Android. */
export function nativePrunePlugin(enabled: boolean): Plugin {
  return {
    name: "progenia-native-prune",
    apply: "build",
    closeBundle() {
      if (!enabled) return;

      const distDir = path.resolve(process.cwd(), "dist");
      const removed: string[] = [];

      const removePath = (target: string) => {
        if (!fs.existsSync(target)) return;
        fs.rmSync(target, { recursive: true, force: true });
        removed.push(path.relative(distDir, target));
      };

      removePath(path.join(distDir, "videos"));

      const assetsDir = path.join(distDir, "assets");
      if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
          if (file.includes("landing-hero-video-poster")) {
            fs.rmSync(path.join(assetsDir, file), { force: true });
            removed.push(path.join("assets", file));
          }
        }
      }

      if (removed.length > 0) {
        console.log(`[native-prune] Removido do bundle nativo: ${removed.join(", ")}`);
      }
    },
  };
}
