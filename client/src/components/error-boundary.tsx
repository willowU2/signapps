'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Card className="m-4 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Une erreur est survenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
            <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
