import { useState, useEffect } from "react";
import { gamificationService } from "@/services/gamificationService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Award, Trophy, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const GamificationManager = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, leaderboardData] = await Promise.all([
        gamificationService.getGamificationRules(),
        gamificationService.getLeaderboard(10),
      ]);
      setRules(rulesData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async (id: string, updates: any) => {
    try {
      await gamificationService.updateGamificationRule(id, updates);
      toast.success("Regra atualizada!");
      loadData();
    } catch (error) {
      console.error("Erro ao atualizar regra:", error);
      toast.error("Erro ao atualizar regra");
    }
  };

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Regras de Pontuação */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Regras de Pontuação
        </h3>

        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium">{rule.descricao}</h4>
                <p className="text-sm text-muted-foreground">Ação: {rule.acao}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Pontos:</Label>
                  <Input
                    type="number"
                    value={rule.pontos}
                    onChange={(e) => {
                      const newRules = rules.map((r) =>
                        r.id === rule.id ? { ...r, pontos: parseInt(e.target.value) } : r
                      );
                      setRules(newRules);
                    }}
                    onBlur={() => handleUpdateRule(rule.id, { pontos: rule.pontos })}
                    className="w-20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">Ativo:</Label>
                  <Switch
                    checked={rule.ativo}
                    onCheckedChange={(checked) => handleUpdateRule(rule.id, { ativo: checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Leaderboard - Top 10
        </h3>

        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-4 p-4 rounded-lg ${
                index < 3 ? "bg-gradient-to-r from-primary/10 to-transparent" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                {index + 1}
              </div>

              <div className="flex-1">
                <h4 className="font-medium">{entry.profiles?.full_name || "Usuário"}</h4>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>⭐ {entry.total_xp} XP</span>
                  <span>📊 Nível {entry.level}</span>
                  <span>🔥 {entry.streak_days} dias</span>
                </div>
              </div>

              {index === 0 && <Badge className="bg-yellow-500">🥇 1º Lugar</Badge>}
              {index === 1 && <Badge className="bg-gray-400">🥈 2º Lugar</Badge>}
              {index === 2 && <Badge className="bg-amber-600">🥉 3º Lugar</Badge>}
            </div>
          ))}
        </div>
      </Card>

      {/* Estatísticas Gerais */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total de Badges</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Pontos Distribuídos</p>
              <p className="text-2xl font-bold">
                {leaderboard.reduce((sum, e) => sum + (e.total_xp || 0), 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Usuários Ativos</p>
              <p className="text-2xl font-bold">{leaderboard.length}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};