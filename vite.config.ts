import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import glsl from "vite-plugin-glsl";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // vtk.js importa shaders .glsl; precisamos tratar como texto tanto no dev (esbuild) quanto no build.
  assetsInclude: ["**/*.glsl"],
  plugins: [
    glsl({
      include: ["**/*.glsl"],
    }),
    react(),
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
          'cornerstone': ['@cornerstonejs/core', '@cornerstonejs/tools'],
          'vtk': ['vtk.js'],
        },
      },
    },
  },
}));
