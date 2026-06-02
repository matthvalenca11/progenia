import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { labMobileInsetX } from "@/components/labs/labMobileLayout";

export type LabMobilePanelTab = "controls" | "metrics" | "references";

interface TabItem {
  id: LabMobilePanelTab;
  label: string;
}

interface LabMobileTabBarProps {
  active: LabMobilePanelTab;
  onChange: (tab: LabMobilePanelTab) => void;
  tabs: TabItem[];
  embedded?: boolean;
  /** Quando true, o padding horizontal vem do wrapper pai (painel unificado). */
  disableInset?: boolean;
  className?: string;
}

export function LabMobileTabBar({
  active,
  onChange,
  tabs,
  embedded = false,
  disableInset = false,
  className,
}: LabMobileTabBarProps) {
  return (
    <nav
      className={cn(
        !disableInset && labMobileInsetX(embedded),
        "grid w-full min-w-0 max-w-full shrink-0 gap-1 border-b border-border bg-card/95 py-2",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={active === tab.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(tab.id)}
          className="h-8 min-w-0 truncate px-1 text-[11px] sm:text-xs"
        >
          {tab.label}
        </Button>
      ))}
    </nav>
  );
}
