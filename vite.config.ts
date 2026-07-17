import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import glsl from "vite-plugin-glsl";
import { nativePrunePlugin } from "./scripts/vite-plugin-native-prune";

const isNativeBuild = process.env.NATIVE_BUILD === "true";

function vendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("@cornerstonejs") || id.includes("dicom-parser")) return "cornerstone";
  if (id.includes("vtk.js") || id.includes("@kitware/vtk.js")) return "vtk";
  if (id.includes("@react-three") || id.includes("/three/")) return "three";
  if (id.includes("@radix-ui")) return "radix-ui";
  if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
  if (id.includes("@supabase")) return "supabase";
  if (id.includes("recharts") || id.includes("d3-")) return "charts";
  if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-") || id.includes("unified")) {
    return "markdown";
  }
  if (id.includes("lucide-react") || id.includes("@tanstack") || id.includes("date-fns") || id.includes("zod")) {
    return "app-vendor";
  }
  return "vendor";
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Caminhos relativos são obrigatórios para o WebView do Capacitor (iOS/Android).
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  // vtk.js importa shaders .glsl; precisamos tratar como texto tanto no dev (esbuild) quanto no build.
  // .wasm is emitted as a plain asset so ?url imports resolve correctly in workers.
  assetsInclude: ["**/*.glsl", "**/*.wasm"],
  plugins: [
    glsl({
      include: ["**/*.glsl"],
    }),
    react(),
    nativePrunePlugin(isNativeBuild),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
    exclude: ["@cornerstonejs/dicom-image-loader"],
  },
  build: {
    chunkSizeWarningLimit: 1800,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
}));
