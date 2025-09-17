import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Filter out external script errors (Google Ads, browser extensions, etc.)
    const isExternalError = this.isExternalScriptError(error);
    
    if (!isExternalError) {
      console.error('Application error caught by boundary:', error, errorInfo);
      // Only report actual app errors, not external script errors
    } else {
      console.warn('External script error filtered:', error.message);
    }
  }

  private isExternalScriptError(error: Error): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStack = error.stack?.toLowerCase() || '';
    
    // Common external script error patterns
    const externalPatterns = [
      'google', 'gads', 'doubleclick', 'googleads',
      'postmessage', 'target origin', 'recipient window',
      'extension', 'chrome-extension', 'moz-extension',
      'listener indicated an asynchronous response',
      'message channel closed',
      'script error', 'non-same-origin'
    ];
    
    return externalPatterns.some(pattern => 
      errorMessage.includes(pattern) || errorStack.includes(pattern)
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
          <Card className="w-full max-w-md shadow-medium">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Oops! Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error has occurred. Our team has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <code className="text-destructive">
                    {this.state.error.message}
                  </code>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'} 
                  variant="outline"
                  className="w-full"
                >
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;