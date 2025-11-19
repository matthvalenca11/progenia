import { useState, useEffect } from "react";
import { moduleService } from "@/services/moduleService";
import { Module } from "@/services/moduleService";

export function useModules(includeUnpublished = false) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = includeUnpublished
        ? await moduleService.getAllModules()
        : await moduleService.getPublishedModules();
      
      setModules(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar módulos");
      console.error("Erro ao carregar módulos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [includeUnpublished]);

  return {
    modules,
    loading,
    error,
    refetch: loadModules,
  };
}

export function useModule(moduleId: string | undefined) {
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) {
      setLoading(false);
      return;
    }

    const loadModule = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await moduleService.getModuleById(moduleId);
        setModule(data);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar módulo");
        console.error("Erro ao carregar módulo:", err);
      } finally {
        setLoading(false);
      }
    };

    loadModule();
  }, [moduleId]);

  return { module, loading, error };
}