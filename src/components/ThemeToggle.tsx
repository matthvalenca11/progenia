/**
 * ThemeToggle - Switch para alternar entre Light e Dark Mode
 */

import { Moon, Sun } from "lucide-react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const isDark = theme === "dark";
  const isEnglish = language === "en";

  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Aparência</span>
        <SwitchPrimitives.Root
          checked={isDark}
          onCheckedChange={toggleTheme}
          aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 relative"
          )}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 flex items-center justify-center"
            )}
          >
            {isDark ? (
              <Moon className="h-3 w-3 text-foreground" />
            ) : (
              <Sun className="h-3 w-3 text-foreground" />
            )}
          </SwitchPrimitives.Thumb>
        </SwitchPrimitives.Root>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Idioma</span>
        <SwitchPrimitives.Root
          checked={isEnglish}
          onCheckedChange={toggleLanguage}
          aria-label={isEnglish ? "Switch to Portuguese" : "Switch to English"}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-border/60 transition-all duration-200 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 relative bg-input/40 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-500/70"
          )}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-1 ring-black/5 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 flex items-center justify-center text-[10px] font-extrabold tracking-wide"
            )}
          >
            {isEnglish ? "EN" : "PT"}
          </SwitchPrimitives.Thumb>
        </SwitchPrimitives.Root>
      </div>
    </div>
  );
}
