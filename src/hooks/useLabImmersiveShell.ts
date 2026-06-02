import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const LAB_IMMERSIVE_PREFIXES = ["/labs/", "/admin/labs/novo", "/admin/labs/editar/"];

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
