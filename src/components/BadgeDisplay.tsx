import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { badgeService, Badge as BadgeType, UserBadge } from "@/services/badgeService";
import { Award, Lock } from "lucide-react";
import * as Icons from "lucide-react";

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

  const renderBadgeIcon = (iconName: string, earned: boolean) => {
    const IconComponent = (Icons as any)[iconName] || Award;
    return (
      <IconComponent
        className={`h-12 w-12 ${earned ? "text-secondary" : "text-muted-foreground"}`}
      />
    );
  };

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
              className={`p-4 flex items-center gap-4 ${
                earned ? "border-secondary/50 bg-secondary/5" : "opacity-60"
              }`}
            >
              <div className={!earned ? "relative" : ""}>
                {renderBadgeIcon(badge.icon_name, earned)}
                {!earned && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{badge.name}</h4>
                <p className="text-sm text-muted-foreground">{badge.description}</p>
              </div>
              <Badge variant={earned ? "default" : "outline"}>
                {badge.points} pts
              </Badge>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {badgesToShow.map((badge) => {
        const earned = earnedBadgeIds.has(badge.id);
        return (
          <Card
            key={badge.id}
            className={`p-4 text-center ${
              earned ? "border-secondary/50 bg-secondary/5" : "opacity-60"
            }`}
          >
            <div className="mb-2 relative inline-block">
              {renderBadgeIcon(badge.icon_name, earned)}
              {!earned && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <h4 className="font-semibold text-sm">{badge.name}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {badge.description}
            </p>
            <Badge variant={earned ? "default" : "outline"} className="mt-2">
              {badge.points} pts
            </Badge>
          </Card>
        );
      })}
    </div>
  );
}
