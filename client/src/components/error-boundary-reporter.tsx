"use client";

import React, { ReactNode } from "react";
import {
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  copied: boolean;
  showDetails: boolean;
  reported: boolean;
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
      copied: false,
      showDetails: false,
      reported: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { pathname } = window.location;
    const timestamp = new Date().toISOString();
    const componentStack = errorInfo.componentStack || null;

    console.error("[ErrorBoundary]", {
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
      copied: false,
      showDetails: false,
      reported: false,
    });
  };

  handleCopyError = async () => {
    const { error, componentStack } = this.state;
    const errorText = [
      `Error: ${error?.message || "Unknown error"}`,
      "",
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `User-Agent: ${navigator.userAgent}`,
      "",
      error?.stack ? `Stack trace:\n${error.stack}` : "",
      componentStack ? `Component stack:\n${componentStack}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(errorText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = errorText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
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
      const response = await fetch("/api/v1/system/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        this.setState({ reported: true });
      }
    } catch (err) {
      console.error("[ErrorBoundary] Failed to report error:", err);
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, componentStack, copied, showDetails, reported } = this.state;

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
              Erreur detectee
            </h2>
            <p className="text-sm text-muted-foreground">
              Une erreur inattendue s&apos;est produite. Veuillez reessayer ou
              copier les details pour le support.
            </p>
          </div>

          {/* Error Message (always visible) */}
          {error && (
            <div className="space-y-2 rounded-lg bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <code className="text-xs text-muted-foreground break-all">
                  {error.message}
                </code>
              </div>
            </div>
          )}

          {/* Collapsible details */}
          <div>
            <button
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Masquer les details
                  techniques
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Afficher les details
                  techniques
                </>
              )}
            </button>
            {showDetails && (
              <div className="mt-2 rounded-lg bg-muted/50 border p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all font-mono">
                  {error?.stack || "No stack trace available"}
                  {componentStack && `\n\nComponent stack:\n${componentStack}`}
                </pre>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button onClick={this.handleRetry} className="w-full" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reessayer
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={this.handleCopyError}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copie !
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copier l&apos;erreur
                  </>
                )}
              </Button>
              <Button
                onClick={this.handleReport}
                variant="outline"
                className="flex-1"
                size="sm"
                disabled={reported}
              >
                {reported ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Signale
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" /> Signaler
                  </>
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              size="sm"
              asChild
            >
              <a href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Retour au dashboard
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
