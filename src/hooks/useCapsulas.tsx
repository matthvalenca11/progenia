// Capsulas functionality disabled - table doesn't exist in database
export function useCapsulasRecomendadas(userId: string | undefined, limite = 3) {
  return { capsulas: [], loading: false, error: null };
}

export function useCapsulaInacabada(userId: string | undefined) {
  return { capsula: null, loading: false, error: null };
}

export function useCapsulasByModulo(moduloId: string | undefined) {
  const refetch = async () => {
    console.log("Capsulas table not configured");
  };

  return { capsulas: [], loading: false, error: null, refetch };
}
