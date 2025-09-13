import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Obtener parámetros de la URL
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Si hay error en los parámetros
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          
          if (error === 'access_denied' && errorDescription?.includes('expired')) {
            setMessage('El enlace ha expirado. Por favor solicita un nuevo enlace.');
          } else {
            setMessage(errorDescription || 'Error en la autenticación');
          }
          return;
        }

        // Si no hay tokens, verificar hash para confirmación de email
        if (!accessToken && !refreshToken) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashAccessToken = hashParams.get('access_token');
          const hashType = hashParams.get('type');

          if (hashAccessToken && hashType) {
            // Manejar confirmación de email desde hash
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashParams.get('refresh_token') || '',
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              setStatus('error');
              setMessage('Error al confirmar el email. El enlace puede haber expirado.');
              return;
            }

            if (data.user) {
              setStatus('success');
              setMessage('¡Email confirmado exitosamente! Bienvenido a Gläub.');
              
              toast({
                title: "Email confirmado",
                description: "Tu cuenta ha sido verificada exitosamente",
              });

              // Redirigir al dashboard después de 2 segundos
              setTimeout(() => {
                navigate('/dashboard', { replace: true });
              }, 2000);
              return;
            }
          }
        }

        // Manejar tokens de reset de password
        if (accessToken && type === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Recovery session error:', sessionError);
            setStatus('error');
            setMessage('Error al procesar el enlace de recuperación. El enlace puede haber expirado.');
            return;
          }

          setStatus('success');
          setMessage('Enlace de recuperación válido. Redirigiendo...');
          
          // Redirigir a reset password
          setTimeout(() => {
            navigate('/reset-password', { replace: true });
          }, 1000);
          return;
        }

        // Si llegamos aquí sin procesar nada, mostrar error
        setStatus('error');
        setMessage('Enlace de autenticación inválido o expirado.');

      } catch (error) {
        console.error('Unexpected callback error:', error);
        setStatus('error');
        setMessage('Error inesperado durante la autenticación.');
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    navigate('/auth', { replace: true });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            <CardTitle>Procesando autenticación</CardTitle>
            <CardDescription>
              Por favor espera mientras procesamos tu solicitud...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <LoadingSpinner size="lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            status === 'success' 
              ? 'bg-green-500/10' 
              : 'bg-red-500/10'
          }`}>
            {status === 'success' ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
          </div>
          <CardTitle>
            {status === 'success' ? '¡Éxito!' : 'Error de autenticación'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'error' && (
            <div className="space-y-4">
              <Button onClick={handleRetry} className="w-full">
                Volver al login
              </Button>
            </div>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Serás redirigido automáticamente...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;