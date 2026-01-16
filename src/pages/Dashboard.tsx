import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, Trophy, Clock, BookOpen, LogOut, Zap, Award, TrendingUp, UserPlus, UserMinus, Sparkles, ArrowRight, Activity, FlaskConical, ChevronLeft, ChevronRight, Pill, FileText, CheckCircle2, RotateCcw } from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { enrollmentService } from "@/services/enrollmentService";
import { useCapsulasRecomendadas, useCapsulaInacabada } from "@/hooks/useCapsulas";
import VirtualLabsSection from "@/components/dashboard/VirtualLabsSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  full_name: string;
  institution?: string;
}
interface UserStats {
  streak_days: number;
  total_lessons_completed: number;
  total_time_spent: number;
}
interface Module {
  id: string;
  title: string;
  description: string;
}
const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulesCompleted, setModulesCompleted] = useState<number>(0);
  const [enrolledModules, setEnrolledModules] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  const { capsulas: capsulaRecomendadas, loading: loadingRecomendadas } = useCapsulasRecomendadas(userId, 15);
  const [currentCapsulaIndex, setCurrentCapsulaIndex] = useState(0);
  const { capsula: capsulaInacabada, loading: loadingInacabada } = useCapsulaInacabada(userId);
  const [capaUrls, setCapaUrls] = useState<Record<string, string>>({});
  const [capsulasConcluidas, setCapsulasConcluidas] = useState<number>(0);
  const [minutosEstudo, setMinutosEstudo] = useState<number>(0);

  // Resetar índice quando as cápsulas mudarem (ex: quando uma for concluída)
  useEffect(() => {
    if (capsulaRecomendadas.length > 0) {
      const maxIndex = Math.max(0, capsulaRecomendadas.length - 3);
      setCurrentCapsulaIndex((prevIndex) => {
        if (prevIndex > maxIndex) {
          return maxIndex;
        }
        return prevIndex;
      });
    } else {
      setCurrentCapsulaIndex(0);
    }
  }, [capsulaRecomendadas.length]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Fetch user profile
      const {
        data: profileData
      } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData) {
        setProfile(profileData);
      }

      // Fetch user stats
      const {
        data: statsData
      } = await supabase.from("user_stats").select("*").eq("user_id", session.user.id).single();
      if (statsData) {
        setStats(statsData);
      }

      // Fetch available modules
      const {
        data: modulesData
      } = await supabase
        .from("modules")
        .select("*")
        .eq("is_published", true)
        .order("order_index");
      if (modulesData) {
        setModules(modulesData);
        
        // Fetch user enrollments
        const enrollments = await enrollmentService.getUserEnrollments(session.user.id);
        const enrolledModuleIds = new Set(enrollments.map(e => e.module_id));
        setEnrolledModules(enrolledModuleIds);

        // Compute modules completed based on lesson and capsule progress (only enrolled modules)
        if (enrolledModuleIds.size > 0) {
          const enrolledModuleIdsArray = Array.from(enrolledModuleIds);
          
          // Buscar aulas e cápsulas publicadas
          const { data: lessonsData } = await supabase
            .from("lessons")
            .select("id,module_id,is_published")
            .in("module_id", enrolledModuleIdsArray)
            .eq("is_published", true);

          const { data: capsulesData } = await supabase
            .from("capsulas")
            .select("id,module_id,is_published")
            .in("module_id", enrolledModuleIdsArray)
            .eq("is_published", true);

          const lessonIds = (lessonsData || []).map((l: any) => l.id);
          const capsuleIds = (capsulesData || []).map((c: any) => c.id);

          // Buscar progresso
          let lessonProgressData: any[] = [];
          if (lessonIds.length > 0) {
            const { data } = await supabase
              .from("lesson_progress")
              .select("lesson_id,status")
              .eq("user_id", session.user.id)
              .in("lesson_id", lessonIds);
            lessonProgressData = data || [];
          }

          let capsuleProgressData: any[] = [];
          if (capsuleIds.length > 0) {
            const { data } = await supabase
              .from("capsula_progress")
              .select("capsula_id,status")
              .eq("user_id", session.user.id)
              .in("capsula_id", capsuleIds);
            capsuleProgressData = data || [];
          }

          // Calcular totais e concluídos
          const lessonTotals = new Map<string, number>();
          const lessonCompleted = new Map<string, number>();
          const capsuleTotals = new Map<string, number>();
          const capsuleCompleted = new Map<string, number>();

          (lessonsData || []).forEach((l: any) => {
            lessonTotals.set(l.module_id, (lessonTotals.get(l.module_id) || 0) + 1);
          });

          lessonProgressData.forEach((p: any) => {
            const lesson = (lessonsData || []).find((l: any) => l.id === p.lesson_id);
            if (lesson && p.status === "concluido") {
              lessonCompleted.set(lesson.module_id, (lessonCompleted.get(lesson.module_id) || 0) + 1);
            }
          });

          (capsulesData || []).forEach((c: any) => {
            capsuleTotals.set(c.module_id, (capsuleTotals.get(c.module_id) || 0) + 1);
          });

          capsuleProgressData.forEach((p: any) => {
            const capsule = (capsulesData || []).find((c: any) => c.id === p.capsula_id);
            if (capsule && p.status === "concluido") {
              capsuleCompleted.set(capsule.module_id, (capsuleCompleted.get(capsule.module_id) || 0) + 1);
            }
          });

          // Verificar módulos completos
          const completedModuleIds = new Set<string>();
          let count = 0;

          enrolledModuleIdsArray.forEach((moduleId) => {
            const totalLessons = lessonTotals.get(moduleId) || 0;
            const completedLessons = lessonCompleted.get(moduleId) || 0;
            const totalCapsules = capsuleTotals.get(moduleId) || 0;
            const completedCapsules = capsuleCompleted.get(moduleId) || 0;

            const totalContent = totalLessons + totalCapsules;
            const completedContent = completedLessons + completedCapsules;

            // Módulo completo se tem conteúdo E tudo está concluído
            if (totalContent > 0 && completedContent >= totalContent) {
              completedModuleIds.add(moduleId);
              count++;
            }
          });

          setCompletedModules(completedModuleIds);
          setModulesCompleted(count);
        } else {
          setCompletedModules(new Set());
          setModulesCompleted(0);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // Buscar contagem de cápsulas concluídas e calcular minutos de estudo
  useEffect(() => {
    const loadCapsulasConcluidas = async () => {
      if (!userId) {
        setCapsulasConcluidas(0);
        setMinutosEstudo(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from("capsula_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "concluido");

        if (error) throw error;
        setCapsulasConcluidas(count || 0);
      } catch (error) {
        console.error("Erro ao carregar cápsulas concluídas:", error);
        setCapsulasConcluidas(0);
      }
    };

    const loadMinutosEstudo = async () => {
      if (!userId) {
        setMinutosEstudo(0);
        return;
      }

      try {
        // Buscar aulas concluídas com seus minutos
        const { data: lessonProgress, error: lessonError } = await supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", userId)
          .eq("status", "concluido");

        if (lessonError) throw lessonError;

        const lessonIds = (lessonProgress || []).map((lp: any) => lp.lesson_id);
        let totalMinutos = 0;

        if (lessonIds.length > 0) {
          const { data: lessons, error: lessonsError } = await supabase
            .from("lessons")
            .select("id, duration_minutes")
            .in("id", lessonIds);

          if (lessonsError) throw lessonsError;

          totalMinutos += (lessons || []).reduce((sum: number, lesson: any) => {
            return sum + (lesson.duration_minutes || 0);
          }, 0);
        }

        // Buscar cápsulas concluídas com seus minutos
        const { data: capsuleProgress, error: capsuleError } = await supabase
          .from("capsula_progress")
          .select("capsula_id, status")
          .eq("user_id", userId)
          .eq("status", "concluido");

        if (capsuleError) throw capsuleError;

        const capsuleIds = (capsuleProgress || []).map((cp: any) => cp.capsula_id);

        if (capsuleIds.length > 0) {
          const { data: capsules, error: capsulesError } = await supabase
            .from("capsulas")
            .select("id, duration_minutes")
            .in("id", capsuleIds);

          if (capsulesError) throw capsulesError;

          totalMinutos += (capsules || []).reduce((sum: number, capsule: any) => {
            return sum + (capsule.duration_minutes || 0);
          }, 0);
        }

        setMinutosEstudo(totalMinutos);
      } catch (error) {
        console.error("Erro ao carregar minutos de estudo:", error);
        setMinutosEstudo(0);
      }
    };

    loadCapsulasConcluidas();
    loadMinutosEstudo();
  }, [userId]);

  // Load cover images for capsules
  useEffect(() => {
    const loadCapaUrls = async () => {
      const urls: Record<string, string> = {};
      
      // Load recommended capsules covers
      for (const capsula of capsulaRecomendadas) {
        if (capsula.thumbnail_url) {
          urls[capsula.id!] = capsula.thumbnail_url;
        }
      }

      // Load unfinished capsule cover
      if (capsulaInacabada?.thumbnail_url) {
        urls[capsulaInacabada.id!] = capsulaInacabada.thumbnail_url;
      }

      setCapaUrls(urls);
    };

    if (capsulaRecomendadas.length > 0 || capsulaInacabada) {
      loadCapaUrls();
    }
  }, [capsulaRecomendadas, capsulaInacabada]);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Saiu com sucesso");
    navigate("/");
  };
  const handleStartModule = async (moduleId: string) => {
    if (!enrolledModules.has(moduleId)) {
      toast.error("Matrícula necessária", {
        description: "Você precisa se matricular neste módulo antes de começar.",
      });
      return;
    }
    navigate(`/module/${moduleId}`);
  };

  const handleEnroll = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await enrollmentService.enrollInModule(session.user.id, moduleId);
      setEnrolledModules(prev => new Set([...prev, moduleId]));
      
      toast.success("Matrícula realizada!", {
        description: "Você foi matriculado neste módulo com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao matricular:", error);
      toast.error("Erro", {
        description: "Não foi possível realizar a matrícula.",
      });
    }
  };

  const handleUnenroll = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await enrollmentService.unenrollFromModule(session.user.id, moduleId);
      setEnrolledModules(prev => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        return newSet;
      });
      
      toast.success("Matrícula cancelada", {
        description: "Você foi desmatriculado deste módulo. Seu progresso foi mantido.",
      });
    } catch (error) {
      console.error("Erro ao desmatricular:", error);
      toast.error("Erro", {
        description: "Não foi possível cancelar a matrícula.",
      });
    }
  };

  const handleRefazerModulo = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Erro", { description: "Sessão não encontrada." });
        return;
      }

      // Buscar aulas e cápsulas do módulo (sem filtro de is_published para pegar todas)
      const { data: lessonsData, error: lessonsError } = await supabase
        .from("lessons")
        .select("id")
        .eq("module_id", moduleId);

      if (lessonsError) {
        console.error("Erro ao buscar aulas:", lessonsError);
        throw lessonsError;
      }

      const { data: capsulesData, error: capsulesError } = await supabase
        .from("capsulas")
        .select("id")
        .eq("module_id", moduleId);

      if (capsulesError) {
        console.error("Erro ao buscar cápsulas:", capsulesError);
        throw capsulesError;
      }

      const lessonIds = (lessonsData || []).map((l: any) => l.id);
      const capsuleIds = (capsulesData || []).map((c: any) => c.id);

      console.log("[Refazer Módulo] Aulas encontradas:", lessonIds.length, lessonIds);
      console.log("[Refazer Módulo] Cápsulas encontradas:", capsuleIds.length, capsuleIds);

      // Deletar progresso das aulas
      if (lessonIds.length > 0) {
        const { data: deletedLessons, error: lessonError } = await supabase
          .from("lesson_progress")
          .delete()
          .eq("user_id", session.user.id)
          .in("lesson_id", lessonIds)
          .select();
        
        if (lessonError) {
          console.error("[Refazer Módulo] Erro ao deletar progresso de aulas:", lessonError);
          // Se falhar, tentar atualizar para resetar
          const { error: updateError } = await supabase
            .from("lesson_progress")
            .update({ 
              status: 'nao_iniciado',
              progress_percentage: 0,
              data_conclusao: null
            })
            .eq("user_id", session.user.id)
            .in("lesson_id", lessonIds);
          
          if (updateError) {
            console.error("[Refazer Módulo] Erro ao atualizar progresso de aulas:", updateError);
            throw new Error("Não foi possível resetar o progresso das aulas");
          }
        } else {
          console.log("[Refazer Módulo] Progresso de aulas deletado:", deletedLessons?.length || 0);
        }
      }

      // Deletar progresso das cápsulas
      if (capsuleIds.length > 0) {
        const { data: deletedCapsules, error: capsuleError } = await supabase
          .from("capsula_progress")
          .delete()
          .eq("user_id", session.user.id)
          .in("capsula_id", capsuleIds)
          .select();
        
        if (capsuleError) {
          console.error("[Refazer Módulo] Erro ao deletar progresso de cápsulas:", capsuleError);
          // Se falhar, tentar atualizar para resetar
          const { error: updateError } = await supabase
            .from("capsula_progress")
            .update({ 
              status: 'nao_iniciado',
              progress_percentage: 0,
              data_conclusao: null
            })
            .eq("user_id", session.user.id)
            .in("capsula_id", capsuleIds);
          
          if (updateError) {
            console.error("[Refazer Módulo] Erro ao atualizar progresso de cápsulas:", updateError);
            throw new Error("Não foi possível resetar o progresso das cápsulas");
          }
        } else {
          console.log("[Refazer Módulo] Progresso de cápsulas deletado:", deletedCapsules?.length || 0);
        }
      }

      // Atualizar estado local IMEDIATAMENTE para remover o check
      setCompletedModules(prev => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        console.log("[Refazer Módulo] Estado atualizado, módulo removido do completedModules");
        return newSet;
      });

      // Recarregar cálculo de módulos concluídos
      const enrolledModuleIdsArray = Array.from(enrolledModules);
      if (enrolledModuleIdsArray.length > 0) {
        const { data: lessonsDataReload } = await supabase
          .from("lessons")
          .select("id,module_id,is_published")
          .in("module_id", enrolledModuleIdsArray)
          .eq("is_published", true);

        const { data: capsulesDataReload } = await supabase
          .from("capsulas")
          .select("id,module_id,is_published")
          .in("module_id", enrolledModuleIdsArray)
          .eq("is_published", true);

        const lessonIdsReload = (lessonsDataReload || []).map((l: any) => l.id);
        const capsuleIdsReload = (capsulesDataReload || []).map((c: any) => c.id);

        let lessonProgressData: any[] = [];
        if (lessonIdsReload.length > 0) {
          const { data } = await supabase
            .from("lesson_progress")
            .select("lesson_id,status")
            .eq("user_id", session.user.id)
            .in("lesson_id", lessonIdsReload);
          lessonProgressData = data || [];
        }

        let capsuleProgressData: any[] = [];
        if (capsuleIdsReload.length > 0) {
          const { data } = await supabase
            .from("capsula_progress")
            .select("capsula_id,status")
            .eq("user_id", session.user.id)
            .in("capsula_id", capsuleIdsReload);
          capsuleProgressData = data || [];
        }

        const lessonTotals = new Map<string, number>();
        const lessonCompleted = new Map<string, number>();
        const capsuleTotals = new Map<string, number>();
        const capsuleCompleted = new Map<string, number>();

        (lessonsDataReload || []).forEach((l: any) => {
          lessonTotals.set(l.module_id, (lessonTotals.get(l.module_id) || 0) + 1);
        });

        lessonProgressData.forEach((p: any) => {
          const lesson = (lessonsDataReload || []).find((l: any) => l.id === p.lesson_id);
          if (lesson && p.status === "concluido") {
            lessonCompleted.set(lesson.module_id, (lessonCompleted.get(lesson.module_id) || 0) + 1);
          }
        });

        (capsulesDataReload || []).forEach((c: any) => {
          capsuleTotals.set(c.module_id, (capsuleTotals.get(c.module_id) || 0) + 1);
        });

        capsuleProgressData.forEach((p: any) => {
          const capsule = (capsulesDataReload || []).find((c: any) => c.id === p.capsula_id);
          if (capsule && p.status === "concluido") {
            capsuleCompleted.set(capsule.module_id, (capsuleCompleted.get(capsule.module_id) || 0) + 1);
          }
        });

        const completedModuleIds = new Set<string>();
        let count = 0;

        enrolledModuleIdsArray.forEach((modId) => {
          const totalLessons = lessonTotals.get(modId) || 0;
          const completedLessons = lessonCompleted.get(modId) || 0;
          const totalCapsules = capsuleTotals.get(modId) || 0;
          const completedCapsules = capsuleCompleted.get(modId) || 0;

          const totalContent = totalLessons + totalCapsules;
          const completedContent = completedLessons + completedCapsules;

          if (totalContent > 0 && completedContent >= totalContent) {
            completedModuleIds.add(modId);
            count++;
          }
        });

        setCompletedModules(completedModuleIds);
        setModulesCompleted(count);
        
        console.log("[Refazer Módulo] Cálculo atualizado:", {
          completedModules: Array.from(completedModuleIds),
          count
        });
      }

      // Garantir que o módulo seja removido do estado de concluídos
      setCompletedModules(prev => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        console.log("[Refazer Módulo] Estado final - módulo removido:", !newSet.has(moduleId));
        return newSet;
      });

      // Recalcular estatísticas de cápsulas concluídas
      const { count: newCapsulasCount } = await supabase
        .from("capsula_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "concluido");
      
      setCapsulasConcluidas(newCapsulasCount || 0);

      // Recalcular minutos de estudo
      const { data: newLessonProgress } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("user_id", session.user.id)
        .eq("status", "concluido");

      const newLessonIds = (newLessonProgress || []).map((lp: any) => lp.lesson_id);
      let newTotalMinutos = 0;

      if (newLessonIds.length > 0) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, duration_minutes")
          .in("id", newLessonIds);

        newTotalMinutos += (lessons || []).reduce((sum: number, lesson: any) => {
          return sum + (lesson.duration_minutes || 0);
        }, 0);
      }

      const { data: newCapsuleProgress } = await supabase
        .from("capsula_progress")
        .select("capsula_id, status")
        .eq("user_id", session.user.id)
        .eq("status", "concluido");

      const newCapsuleIds = (newCapsuleProgress || []).map((cp: any) => cp.capsula_id);

      if (newCapsuleIds.length > 0) {
        const { data: capsules } = await supabase
          .from("capsulas")
          .select("id, duration_minutes")
          .in("id", newCapsuleIds);

        newTotalMinutos += (capsules || []).reduce((sum: number, capsule: any) => {
          return sum + (capsule.duration_minutes || 0);
        }, 0);
      }

      setMinutosEstudo(newTotalMinutos);

      // Atualizar user_stats no banco de dados
      const totalLessonsCompleted = newLessonIds.length;
      await supabase
        .from("user_stats")
        .upsert({
          user_id: session.user.id,
          total_lessons_completed: totalLessonsCompleted,
          total_time_spent: newTotalMinutos,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      toast.success("Módulo reiniciado", {
        description: "Seu progresso neste módulo foi apagado. Você pode começar novamente.",
      });
    } catch (error: any) {
      console.error("Erro ao refazer módulo:", error);
      toast.error("Erro", {
        description: error.message || "Não foi possível reiniciar o módulo.",
      });
    }
  };
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando seu painel...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="ProGenia" className="h-10 progenia-logo" />
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isAdmin && (
              <Button variant="ghost" onClick={() => navigate("/admin")}>
                Admin
              </Button>
            )}
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile ? getInitials(profile.full_name) : "U"}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Bem-vindo de volta, {profile?.full_name}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Continue sua jornada de aprendizado
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8 text-secondary" />
              <span className="text-2xl font-bold">{stats?.total_lessons_completed || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground">Aulas Concluídas</p>
            <p className="text-xs text-muted-foreground mt-1">Continue aprendendo!</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Pill className="h-8 w-8 text-accent" />
              <span className="text-2xl font-bold">{capsulasConcluidas}</span>
            </div>
            <p className="text-sm text-muted-foreground">Cápsulas Concluídas</p>
            <p className="text-xs text-muted-foreground mt-1">Continue assim!</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">{modulesCompleted}</span>
            </div>
            <p className="text-sm text-muted-foreground">Módulos Concluídos</p>
            <p className="text-xs text-muted-foreground mt-1">De {enrolledModules.size} matriculados</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-secondary" />
              <span className="text-2xl font-bold">{minutosEstudo}</span>
            </div>
            <p className="text-sm text-muted-foreground">Minutos de Estudo</p>
            <p className="text-xs text-muted-foreground mt-1">Continue assim!</p>
          </Card>
        </div>

        {/* Learning Progress */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Seu Progresso</h2>
              <p className="text-muted-foreground">
                {modulesCompleted} de {enrolledModules.size} módulos matriculados
              </p>
            </div>
            <Award className="h-10 w-10 text-secondary" />
          </div>
          <Progress value={enrolledModules.size > 0 ? (modulesCompleted / enrolledModules.size) * 100 : 0} className="h-3" />
        </Card>

        {/* Laboratórios Virtuais Destaque */}
        <VirtualLabsSection />

        {/* Cápsulas Recomendadas */}
        {!loadingRecomendadas && capsulaRecomendadas.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Pill className="h-6 w-6 text-accent" />
              <h2 className="text-3xl font-bold">Em Alta Hoje</h2>
            </div>
            <div className="relative">
              {/* Seta esquerda - só aparece se não estiver no início */}
              {currentCapsulaIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentCapsulaIndex(Math.max(0, currentCapsulaIndex - 1));
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-background/80 hover:bg-background border border-border rounded-full p-2 shadow-lg transition-all hover:scale-110"
                  aria-label="Cápsula anterior"
                >
                  <ChevronLeft className="h-8 w-8 text-foreground" />
                </button>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {capsulaRecomendadas
                  .slice(currentCapsulaIndex, currentCapsulaIndex + 3)
                  .map((capsula) => (
                    <Card 
                      key={capsula.id}
                      className="cursor-pointer hover:shadow-lg transition-smooth border-border bg-card hover:border-accent overflow-hidden group flex flex-col"
                      onClick={() => navigate(`/capsula/${capsula.id}`)}
                    >
                      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
                        {capaUrls[capsula.id!] ? (
                          <img 
                            src={capaUrls[capsula.id!]} 
                            alt={capsula.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <Sparkles className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <div className="inline-block px-2 py-1 bg-accent/10 text-accent text-xs rounded-full mb-2 w-fit">
                          Cápsula Rápida
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{capsula.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{capsula.description}</p>
                        <Button size="sm" className="w-full mt-auto">
                          Conferir <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
              
              {/* Seta direita - só aparece se houver mais cápsulas */}
              {currentCapsulaIndex + 3 < capsulaRecomendadas.length && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentCapsulaIndex(Math.min(capsulaRecomendadas.length - 3, currentCapsulaIndex + 1));
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-background/80 hover:bg-background border border-border rounded-full p-2 shadow-lg transition-all hover:scale-110"
                  aria-label="Próxima cápsula"
                >
                  <ChevronRight className="h-8 w-8 text-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Continuar de Onde Parou */}
        {!loadingInacabada && capsulaInacabada && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Continuar de Onde Parou</h2>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-smooth border-accent bg-card overflow-hidden group"
              onClick={() => navigate(`/capsula/${capsulaInacabada.id}`)}
            >
              <div className="flex flex-col md:flex-row">
                <div className="aspect-video md:w-48 bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {capaUrls[capsulaInacabada.id!] ? (
                    <img 
                      src={capaUrls[capsulaInacabada.id!]} 
                      alt={capsulaInacabada.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <BookOpen className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="p-6 flex-1">
                  <div className="inline-block px-2 py-1 bg-accent/10 text-accent text-xs rounded-full mb-2">
                    Cápsula em Progresso
                  </div>
                  <h3 className="font-semibold text-xl mb-2">{capsulaInacabada.title}</h3>
                  <p className="text-muted-foreground mb-4">{capsulaInacabada.description}</p>
                  <Button>
                    Continuar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Available Modules */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-accent" />
              <h2 className="text-3xl font-bold">Explorar Módulos</h2>
            </div>
          </div>

          {modules.length === 0 ? <Card className="p-12 text-center">
              <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum Módulo Disponível Ainda</h3>
              <p className="text-muted-foreground">
                Volte em breve! Os administradores estão preparando conteúdo de aprendizado para você.
              </p>
            </Card> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {modules.map(module => <Card key={module.id} className="overflow-hidden hover:shadow-xl transition-smooth group cursor-pointer flex flex-col">
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-smooth flex items-center gap-2">
                      {completedModules.has(module.id) && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                      {module.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                      {module.description}
                    </p>
                    <div className="mt-auto">
                      {enrolledModules.has(module.id) ? (
                        <div className="space-y-2">
                          <Button 
                            className="w-full" 
                            variant="default" 
                            onClick={() => navigate(`/module/${module.id}/capsulas`)}
                          >
                            <Pill className="mr-2 h-4 w-4" />
                            Ver Cápsulas
                          </Button>
                          <Button 
                            className="w-full" 
                            variant="outline" 
                            onClick={() => handleStartModule(module.id)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver Aulas
                          </Button>
                          {completedModules.has(module.id) ? (
                            <Button 
                              className="w-full" 
                              variant="ghost" 
                              onClick={(e) => handleRefazerModulo(module.id, e)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Refazer o Módulo
                            </Button>
                          ) : (
                            <Button 
                              className="w-full" 
                              variant="ghost" 
                              onClick={(e) => handleUnenroll(module.id, e)}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Cancelar Matrícula
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button 
                          className="w-full" 
                          onClick={(e) => handleEnroll(module.id, e)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Matricular-se
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>)}
            </div>}
        </div>
      </div>
    </div>;
};
export default Dashboard;