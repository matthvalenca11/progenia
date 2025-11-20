import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { leaderboardService, LeaderboardEntry } from "@/services/leaderboardService";
import { Trophy, Medal, Award, Flame, BookOpen } from "lucide-react";

interface LeaderboardProps {
  currentUserId?: string;
  limit?: number;
}

export function Leaderboard({ currentUserId, limit = 10 }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [currentUserId, limit]);

  const loadLeaderboard = async () => {
    try {
      const topUsers = await leaderboardService.getTopUsers(limit);
      setEntries(topUsers);

      if (currentUserId) {
        const rank = await leaderboardService.getUserRank(currentUserId);
        setUserRank(rank);
      }
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Carregando ranking...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Current User Rank (if not in top) */}
      {currentUserId && userRank && userRank.rank > limit && (
        <Card className="p-4 bg-accent/10 border-accent">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sua Posição</span>
            <Badge variant="outline">
              #{userRank.rank} de {userRank.total}
            </Badge>
          </div>
        </Card>
      )}

      {/* Top Users */}
      <div className="space-y-2">
        {entries.map((entry) => {
          const isCurrentUser = entry.user_id === currentUserId;
          return (
            <Card
              key={entry.user_id}
              className={`p-4 ${
                isCurrentUser ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>

                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(entry.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{entry.full_name}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      <span>{entry.total_lessons_completed}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      <span>{entry.streak_days} dias</span>
                    </div>
                  </div>
                </div>

                <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                  {entry.total_points} pts
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Ainda não há usuários no ranking.</p>
          <p className="text-sm mt-2">Seja o primeiro a ganhar pontos!</p>
        </div>
      )}
    </div>
  );
}
