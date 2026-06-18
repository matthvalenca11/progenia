import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Evita tela branca silenciosa quando um componente filho lança erro em runtime.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    if (import.meta.env.DEV) {
      console.error("[AppErrorBoundary] stack:", error.stack);
    }
  }

  render() {
    if (this.state.error) {
      const devStack = import.meta.env.DEV ? this.state.error.stack : null;
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
          <h1 className="text-lg font-semibold">Algo deu errado ao carregar a página</h1>
          <p className="max-w-lg text-center text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          {devStack ? (
            <pre className="max-h-48 max-w-2xl overflow-auto rounded-md border bg-muted/40 p-3 text-left text-[10px] text-muted-foreground">
              {devStack}
            </pre>
          ) : null}
          <p className="max-w-lg text-center text-xs text-muted-foreground">
            Se o problema persistir, faça um recarregamento forçado (Cmd+Shift+R) para limpar o cache do
            navegador.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
