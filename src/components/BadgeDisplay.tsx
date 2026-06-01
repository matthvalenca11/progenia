import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { badgeService, Badge as BadgeType, UserBadge } from "@/services/badgeService";
import { BadgeIcon } from "@/components/gamification/BadgeIcon";
import { Lock } from "lucide-react";

interface BadgeDisplayProps {
  userId: string;
  variant?: "grid" | "list";
  showLocked?: boolean;
}

export function BadgeDisplay({ userId, variant = "grid", showLocked = true }: BadgeDisplayProps) {
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    try {
      const [all, user] = await Promise.all([
        badgeService.getAllBadges(),
        badgeService.getUserBadges(userId),
      ]);
      setAllBadges(all);
      setUserBadges(user);
    } catch (error) {
      console.error("Error loading badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));
  const badgesToShow = showLocked ? allBadges : allBadges.filter((b) => earnedBadgeIds.has(b.id));

  if (loading) {
    return <div className="text-center text-muted-foreground">Carregando conquistas...</div>;
  }

  if (variant === "list") {
    return (
      <div className="space-y-2">
        {badgesToShow.map((badge) => {
          const earned = earnedBadgeIds.has(badge.id);
          return (
            <Card
              key={badge.id}
              className={`flex items-center gap-4 p-4 ${
                earned ? "border-secondary/50 bg-secondary/5" : "opacity-70"
              }`}
            >
              <div className="relative shrink-0">
                <BadgeIcon iconName={badge.icon_name} unlocked={earned} size="lg" />
                {!earned && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold">{badge.name}</h4>
                <p className="text-sm text-muted-foreground">{badge.description}</p>
              </div>
              <Badge variant={earned ? "default" : "outline"}>{badge.points} pts</Badge>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {badgesToShow.map((badge) => {
        const earned = earnedBadgeIds.has(badge.id);
        return (
          <Card
            key={badge.id}
            className={`p-4 text-center ${earned ? "border-secondary/50 bg-secondary/5" : "opacity-70"}`}
          >
            <div className="relative mb-2 inline-flex">
              <BadgeIcon iconName={badge.icon_name} unlocked={earned} size="lg" />
              {!earned && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <h4 className="text-sm font-semibold">{badge.name}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>
            <Badge variant={earned ? "default" : "outline"} className="mt-2">
              {badge.points} pts
            </Badge>
          </Card>
        );
      })}
    </div>
  );
}
