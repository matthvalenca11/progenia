import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import glsl from "vite-plugin-glsl";
import { nativePrunePlugin } from "./scripts/vite-plugin-native-prune";

const isNativeBuild = process.env.NATIVE_BUILD === "true";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    esbuildOptions: {
      loader: {
        ".glsl": "text",
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          cornerstone: ["@cornerstonejs/core", "@cornerstonejs/tools"],
          vtk: ["vtk.js"],
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
