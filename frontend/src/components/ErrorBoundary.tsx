import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors and displays
 * a user-friendly fallback instead of a blank white screen.
 *
 * WCAG 1.3.1: Uses semantic elements and proper heading hierarchy.
 * WCAG 4.1.2: Retry button has accessible label.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for monitoring (production would use Cloud Logging)
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main
          role="alert"
          className="flex items-center justify-center min-h-screen bg-slate-50 p-8"
        >
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl" role="img" aria-label="Error">⚠️</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-teal-500 text-white text-sm font-bold rounded-lg shadow-md hover:bg-teal-600 transition-colors"
              aria-label="Reload the page"
            >
              Reload Page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
