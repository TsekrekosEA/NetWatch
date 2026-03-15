import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full items-center justify-center rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-sm text-red-400">
            <div className="text-center">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-1 text-xs text-red-500">
                {this.state.error?.message}
              </p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
