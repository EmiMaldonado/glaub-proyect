import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface VoiceErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface VoiceErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

class VoiceErrorBoundary extends React.Component<VoiceErrorBoundaryProps, VoiceErrorBoundaryState> {
  constructor(props: VoiceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): VoiceErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Voice component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Voice connection error</h3>
          </div>
          
          <p className="text-center text-muted-foreground max-w-md">
            A problem occurred with the voice connection. This may be due to 
            connectivity or microphone permissions.
          </p>
          
          <div className="flex flex-col space-y-2 text-sm text-muted-foreground">
            <p>• Make sure you have microphone permissions enabled</p>
            <p>• Check your internet connection</p>
            <p>• Try reloading the page if the problem persists</p>
          </div>

          <div className="flex space-x-2">
            <Button onClick={this.handleRetry} className="flex items-center space-x-2">
              <RefreshCcw className="w-4 h-4" />
              <span>Retry</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VoiceErrorBoundary;