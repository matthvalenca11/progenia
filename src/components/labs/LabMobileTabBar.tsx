import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LabMobilePanelTab = "controls" | "metrics" | "references";

interface TabItem {
  id: LabMobilePanelTab;
  label: string;
}

interface LabMobileTabBarProps {
  active: LabMobilePanelTab;
  onChange: (tab: LabMobilePanelTab) => void;
  tabs: TabItem[];
  className?: string;
}

export function LabMobileTabBar({ active, onChange, tabs, className }: LabMobileTabBarProps) {
  return (
    <nav
      className={cn(
        "grid w-full min-w-0 max-w-full shrink-0 gap-1 border-b border-border bg-card/95 p-2",
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
