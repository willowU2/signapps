"use client";

import { Component, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  RefreshCw,
} from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string | null;
}

function ErrorDetails({
  error,
  componentStack,
}: {
  error?: Error;
  componentStack?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const errorText = [
    `Error: ${error?.message || "Unknown error"}`,
    "",
    `URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
    `Time: ${new Date().toISOString()}`,
    "",
    error?.stack ? `Stack trace:\n${error.stack}` : "",
    componentStack ? `Component stack:\n${componentStack}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = errorText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copie !
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copier l&apos;erreur
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="gap-1.5 text-muted-foreground"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Masquer les details
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Afficher les details
            </>
          )}
        </Button>
      </div>

      {showDetails && (
        <div className="rounded-lg bg-muted/50 border p-3 max-h-48 overflow-y-auto">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all font-mono">
            {errorText}
          </pre>
        </div>
      )}
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ componentStack: errorInfo.componentStack });
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Card className="m-4 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Une erreur est survenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ||
                "Une erreur inattendue s'est produite."}
            </p>

            <ErrorDetails
              error={this.state.error}
              componentStack={this.state.componentStack}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  this.setState({
                    hasError: false,
                    error: undefined,
                    componentStack: null,
                  })
                }
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Reessayer
              </Button>
              <Button variant="ghost" asChild className="gap-1.5">
                <a href="/dashboard">
                  <Home className="h-4 w-4" />
                  Retour au dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
