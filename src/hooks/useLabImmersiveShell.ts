import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Apenas o viewer do aluno usa o shell imersivo. O editor administrativo
// precisa manter touch-pan-y e uma viewport limitada para seus dois painéis.
const LAB_IMMERSIVE_PREFIXES = ["/labs/"];

export function useLabImmersiveShell() {
  const { pathname } = useLocation();
  const isLabImmersive = LAB_IMMERSIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    document.documentElement.classList.toggle("lab-immersive-shell", isLabImmersive);
    return () => {
      document.documentElement.classList.remove("lab-immersive-shell");
    };
  }, [isLabImmersive]);

  return isLabImmersive;
}
