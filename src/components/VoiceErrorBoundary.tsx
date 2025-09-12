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
            <h3 className="text-lg font-semibold">Error en la conexión de voz</h3>
          </div>
          
          <p className="text-center text-muted-foreground max-w-md">
            Ocurrió un problema con la conexión de voz. Esto puede deberse a problemas de 
            conectividad o permisos del micrófono.
          </p>
          
          <div className="flex flex-col space-y-2 text-sm text-muted-foreground">
            <p>• Asegúrate de tener permisos de micrófono habilitados</p>
            <p>• Verifica tu conexión a internet</p>
            <p>• Intenta recargar la página si el problema persiste</p>
          </div>

          <div className="flex space-x-2">
            <Button onClick={this.handleRetry} className="flex items-center space-x-2">
              <RefreshCcw className="w-4 h-4" />
              <span>Reintentar</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VoiceErrorBoundary;