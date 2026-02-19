"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component.
 *
 * Note: Error boundaries must be class components.
 * The useI18n hook cannot be used directly inside a class component,
 * so the fallback UI uses a nested functional component for translations.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Functional fallback component that can use hooks                    */
/* ------------------------------------------------------------------ */

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

const ErrorFallback: FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <div className="card w-full max-w-md rounded-xl border border-red-500/20 bg-navy-800/80 p-6 text-center">
        {/* Error icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h3 className="mb-2 text-lg font-semibold text-white">
          {t("common.error")}
        </h3>
        {error?.message && (
          <p className="mb-4 text-sm text-gray-400">
            {error.message}
          </p>
        )}

        {/* Retry button */}
        <button
          onClick={onRetry}
          className="rounded-lg bg-gold-500/20 px-4 py-2 text-sm font-medium text-gold-400 transition-colors hover:bg-gold-500/30"
        >
          {t("common.retry")}
        </button>
      </div>
    </div>
  );
};
