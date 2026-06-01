import {
  Award,
  BookMarked,
  BookOpen,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BADGE_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  BookMarked,
  Award,
  Trophy,
  Flame,
  Zap,
  Star,
  Clock,
  Compass,
  Pill: BookMarked,
};

const SIZE = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-10 w-10", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6" },
} as const;

interface BadgeIconProps {
  iconName: string;
  unlocked?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}

export function BadgeIcon({
  iconName,
  unlocked = true,
  size = "md",
  className,
}: BadgeIconProps) {
  const Icon = BADGE_ICONS[iconName] || Award;
  const dim = SIZE[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border",
        dim.box,
        unlocked
          ? "border-primary/20 bg-primary/10 text-primary dark:border-secondary/30 dark:bg-secondary/15 dark:text-secondary"
          : "border-border/70 bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      <Icon className={dim.icon} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
