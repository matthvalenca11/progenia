import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initNativeApp } from "@/lib/capacitor";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

void initNativeApp();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
