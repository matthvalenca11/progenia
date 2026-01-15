/**
 * Error Boundary for MRI Lab Preview
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MRIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MRI Lab Preview Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
              <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Erro ao carregar preview
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {this.state.error?.message || "Ocorreu um erro ao renderizar o preview do lab de MRI."}
                </p>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="text-sm text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
