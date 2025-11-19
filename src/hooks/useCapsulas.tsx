import { useState, useEffect } from "react";
import { capsulaService, Capsula } from "@/services/capsulaService";

export function useCapsulasRecomendadas(userId: string | undefined, limite = 3) {
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadCapsulas = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await capsulaService.getCapsulaRecomendadas(userId, limite);
        setCapsulas(data);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar cápsulas recomendadas");
        console.error("Erro ao carregar cápsulas recomendadas:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCapsulas();
  }, [userId, limite]);

  return { capsulas, loading, error };
}

export function useCapsulaInacabada(userId: string | undefined) {
  const [capsula, setCapsula] = useState<Capsula | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadCapsula = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await capsulaService.getCapsulaInacabada(userId);
        setCapsula(data);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar cápsula inacabada");
        console.error("Erro ao carregar cápsula inacabada:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCapsula();
  }, [userId]);

  return { capsula, loading, error };
}

export function useCapsulasByModulo(moduloId: string | undefined) {
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!moduloId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await capsulaService.getCapsulasByModulo(moduloId);
      setCapsulas(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar cápsulas");
      console.error("Erro ao carregar cápsulas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [moduloId]);

  return { capsulas, loading, error, refetch };
}
