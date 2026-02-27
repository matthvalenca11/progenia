import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AiDisclaimerPopoverProps {
  language?: "pt" | "en";
  buttonClassName?: string;
  iconClassName?: string;
}

export function AiDisclaimerPopover({
  language = "pt",
  buttonClassName,
  iconClassName,
}: AiDisclaimerPopoverProps) {
  const isEnglish = language === "en";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-6 w-6 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 ${buttonClassName ?? ""}`}
          aria-label={isEnglish ? "AI content warning" : "Aviso sobre conteúdo de IA"}
        >
          <AlertTriangle className={`h-4 w-4 fill-orange-500/20 ${iconClassName ?? ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <p className="text-sm leading-5">
          {isEnglish
            ? "AI-generated suggestions may contain inaccuracies. ProGenia is not responsible for decisions made solely based on AI-generated content."
            : "Conteúdos sugeridos por IA podem conter imprecisões. A ProGenia não se responsabiliza por decisões tomadas exclusivamente com base em conteúdo gerado por IA."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
