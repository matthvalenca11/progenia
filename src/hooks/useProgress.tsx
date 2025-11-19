import { useState, useEffect } from "react";
import { progressService } from "@/services/progressService";
import { useAuth } from "./useAuth";

export function useUserProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await progressService.getUserProgress(user.id);
      setProgress(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar progresso");
      console.error("Erro ao carregar progresso:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [user?.id]);

  return {
    progress,
    loading,
    error,
    refetch: loadProgress,
  };
}

export function useLessonProgress(lessonId: string | undefined) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !lessonId) {
      setLoading(false);
      return;
    }

    const loadProgress = async () => {
      try {
        setLoading(true);
        const data = await progressService.getLessonProgress(user.id, lessonId);
        setProgress(data);
      } catch (err) {
        console.error("Erro ao carregar progresso da aula:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [user?.id, lessonId]);

  const updateProgress = async () => {
    if (!user || !lessonId) return;
    const data = await progressService.getLessonProgress(user.id, lessonId);
    setProgress(data);
  };

  return { progress, loading, updateProgress };
}

export function useModuleProgress(moduleId: string | undefined) {
  const { user } = useAuth();
  const [progress, setProgress] = useState({ total: 0, completed: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !moduleId) {
      setLoading(false);
      return;
    }

    const loadProgress = async () => {
      try {
        setLoading(true);
        const data = await progressService.getModuleProgress(user.id, moduleId);
        setProgress(data);
      } catch (err) {
        console.error("Erro ao carregar progresso do módulo:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [user?.id, moduleId]);

  return { progress, loading };
}