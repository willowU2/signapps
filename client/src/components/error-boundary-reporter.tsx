'use client';

import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundaryReporter extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { pathname } = window.location;
    const timestamp = new Date().toISOString();
    const componentStack = errorInfo.componentStack || null;

    console.error('[ErrorBoundary]', {
      message: error.message,
      pathname,
      timestamp,
      componentStack,
    });

    this.setState({
      componentStack,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
    });
  };

  handleReport = async () => {
    const { error, componentStack } = this.state;
    if (!error) return;

    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/v1/metrics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[ErrorBoundary] Error reported successfully');
      }
    } catch (err) {
      console.error('[ErrorBoundary] Failed to report error:', err);
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-destructive/20 bg-card p-6 shadow-lg">
          {/* Error Icon */}
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Erreur détectée
            </h2>
            <p className="text-sm text-muted-foreground">
              Une erreur inattendue s'est produite. Veuillez réessayer.
            </p>
          </div>

          {/* Error Message */}
          {isDev && error && (
            <div className="space-y-2 rounded-lg bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <code className="text-xs text-muted-foreground break-all">
                  {error.message}
                </code>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={this.handleRetry}
              className="w-full"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
            <Button
              onClick={this.handleReport}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Signaler
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
