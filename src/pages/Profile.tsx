import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { gamificationService } from "@/services/gamificationService";
import { progressService } from "@/services/progressService";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { 
  User, 
  Award, 
  TrendingUp, 
  Trophy, 
  Clock,
  BookOpen,
  ArrowLeft,
  Edit,
  Lock
} from "lucide-react";

const Profile = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadProfileData();
    }
  }, [user, authLoading, navigate]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [statsData, badgesData, progressData, historyData] = await Promise.all([
        gamificationService.getUserStats(user.id),
        gamificationService.getUserBadges(user.id),
        progressService.getUserProgress(user.id),
        progressService.getPointsHistory(user.id, 20),
      ]);

      setStats(statsData);
      setBadges(badgesData);
      setProgress(progressData);
      setPointsHistory(historyData);
    } catch (error) {
      console.error("Erro ao carregar dados do perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const levelProgress = stats?.total_xp 
    ? ((stats.total_xp % 100) / 100) * 100 
    : 0;
  const currentLevel = stats?.total_xp 
    ? Math.floor(Math.sqrt(stats.total_xp / 100))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-start gap-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold">
              {profile?.full_name?.charAt(0) || "U"}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{profile?.full_name || "Usuário"}</h1>
                <Badge variant="outline">Nível {currentLevel}</Badge>
              </div>
              
              {profile?.institution && (
                <p className="text-muted-foreground mb-2">📍 {profile.institution}</p>
              )}
              
              {profile?.professional_role && (
                <p className="text-muted-foreground">{profile.professional_role}</p>
              )}

              <Button variant="outline" size="sm" className="mt-3">
                <Edit className="mr-2 h-4 w-4" />
                Editar Perfil
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Estatísticas principais */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">XP Total</p>
                <p className="text-2xl font-bold">{stats?.total_xp || 0}</p>
              </div>
            </div>
            <Progress value={levelProgress} className="mt-4" />
            <p className="text-xs text-muted-foreground mt-2">
              {100 - (stats?.total_xp % 100 || 0)} XP para o próximo nível
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats?.streak_days || 0} dias</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Módulos</p>
                <p className="text-2xl font-bold">{stats?.modules_completed || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Horas</p>
                <p className="text-2xl font-bold">
                  {Math.floor((stats?.total_time_minutes || 0) / 60)}h
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="badges" className="space-y-6">
          <TabsList>
            <TabsTrigger value="badges">
              <Award className="mr-2 h-4 w-4" />
              Badges ({badges.length})
            </TabsTrigger>
            <TabsTrigger value="progress">
              <BookOpen className="mr-2 h-4 w-4" />
              Progresso
            </TabsTrigger>
            <TabsTrigger value="history">
              <TrendingUp className="mr-2 h-4 w-4" />
              Histórico de Pontos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges">
            {badges.length === 0 ? (
              <Card className="p-12 text-center">
                <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Badge Ainda</h3>
                <p className="text-muted-foreground">
                  Complete aulas e módulos para ganhar badges!
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <Card key={badge.id} className="p-6 text-center">
                    <div className="text-4xl mb-3">{badge.badges.icon || "🏆"}</div>
                    <h4 className="font-semibold mb-1">{badge.badges.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {badge.badges.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(badge.earned_at).toLocaleDateString("pt-BR")}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress">
            {progress.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Progresso Ainda</h3>
                <p className="text-muted-foreground">
                  Comece a estudar para ver seu progresso aqui!
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {progress.map((item) => (
                  <Card key={item.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{item.lessons?.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {item.status === "concluido" ? "✅ Concluído" : "📖 Em progresso"}
                        </p>
                      </div>
                      <Badge variant={item.status === "concluido" ? "default" : "outline"}>
                        {item.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {pointsHistory.length === 0 ? (
              <Card className="p-12 text-center">
                <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Histórico</h3>
                <p className="text-muted-foreground">
                  Complete atividades para ganhar pontos!
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pointsHistory.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{entry.descricao}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Badge className="bg-green-500">+{entry.pontos} XP</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Change Password Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Separate component for Change Password form
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "A nova senha deve ser diferente da senha atual",
    path: ["newPassword"],
  });

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = changePasswordSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setLoading(true);

      // Get current user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        toast.error("Erro ao obter informações do usuário");
        return;
      }

      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: validated.currentPassword,
      });

      if (signInError) {
        toast.error("Senha atual incorreta");
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (updateError) {
        toast.error("Erro ao alterar senha", {
          description: updateError.message,
        });
      } else {
        toast.success("Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro ao alterar a senha");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="currentPassword">Senha Atual</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="newPassword">Nova Senha</Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Digite a senha novamente"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Alterando..." : "Alterar Senha"}
      </Button>
    </form>
  );
}

export default Profile;