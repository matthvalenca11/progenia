/**
 * ThemeToggle - Switch para alternar entre Light e Dark Mode
 */

import { Moon, Sun } from "lucide-react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
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
  );
}
