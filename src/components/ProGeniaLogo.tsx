import type { ImgHTMLAttributes } from "react";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";
import { cn } from "@/lib/utils";

type ProGeniaLogoProps = ImgHTMLAttributes<HTMLImageElement>;

/** Logo com variante automática para dark mode (sem caixa/clipe artificial). */
export function ProGeniaLogo({ className, alt = "ProGenia", ...props }: ProGeniaLogoProps) {
  return (
    <>
      <img
        src={logo}
        alt={alt}
        className={cn("progenia-logo dark:hidden", className)}
        {...props}
      />
      <img
        src={logoDark}
        alt={alt}
        className={cn("progenia-logo hidden dark:block", className)}
        {...props}
      />
    </>
  );
}
