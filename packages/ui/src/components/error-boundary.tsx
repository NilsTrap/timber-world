"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  /** Content to render when no error */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Optional error handler callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error boundary component to catch JavaScript errors in child components.
 * Prevents the entire app from crashing when a component throws.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI or default error message
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Something went wrong
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Please try refreshing the page
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
