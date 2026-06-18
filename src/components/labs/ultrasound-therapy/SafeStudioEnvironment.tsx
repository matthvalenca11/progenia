/**
 * IBL studio — HDR local (sem CDN) com fallback silencioso se o carregamento falhar.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Environment } from "@react-three/drei";

const STUDIO_HDR = "/hdri/studio_small_03_1k.hdr";

interface SafeStudioEnvironmentProps {
  environmentIntensity?: number;
}

interface BoundaryState {
  failed: boolean;
}

class EnvironmentErrorBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[SafeStudioEnvironment] HDR indisponível — usando só luzes da cena.", error.message, info.componentStack);
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function SafeStudioEnvironment({ environmentIntensity = 0.4 }: SafeStudioEnvironmentProps) {
  return (
    <EnvironmentErrorBoundary onFail={() => undefined}>
      <Environment
        files={STUDIO_HDR}
        background={false}
        environmentIntensity={environmentIntensity}
      />
    </EnvironmentErrorBoundary>
  );
}
