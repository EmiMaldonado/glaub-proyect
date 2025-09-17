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
        // Get URL parameters
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('Auth callback triggered:', { 
          accessToken: !!accessToken, 
          refreshToken: !!refreshToken, 
          type, 
          error, 
          errorDescription 
        });

        // Handle errors in URL parameters
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          
          if (error === 'access_denied' && errorDescription?.includes('expired')) {
            setMessage('The confirmation link has expired. Please request a new one.');
          } else if (error === 'invalid_request') {
            setMessage('Invalid confirmation link. Please try requesting a new confirmation email.');
          } else {
            setMessage(errorDescription || 'Authentication error occurred');
          }
          return;
        }

        // Handle hash-based tokens (email confirmation)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        const hashError = hashParams.get('error');

        console.log('Hash parameters:', { 
          hashAccessToken: !!hashAccessToken, 
          hashRefreshToken: !!hashRefreshToken, 
          hashType, 
          hashError 
        });

        // Handle hash errors
        if (hashError) {
          console.error('Hash auth error:', hashError);
          setStatus('error');
          setMessage('Authentication link error. The link may be invalid or expired.');
          return;
        }

        // Process email confirmation from hash
        if (hashAccessToken && hashType === 'signup') {
          console.log('Processing email confirmation...');
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken || '',
          });

          if (sessionError) {
            console.error('Session error during confirmation:', sessionError);
            setStatus('error');
            setMessage('Failed to confirm email. The link may have expired.');
            return;
          }

          if (data.user) {
            console.log('Email confirmation successful for user:', data.user.id);
            setStatus('success');
            setMessage('Email confirmed successfully! Welcome to Gläub.');
            
            toast({
              title: "Email confirmed",
              description: "Your account has been verified successfully",
            });

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 2000);
            return;
          }
        }

        // Process query parameter tokens (password recovery)
        if (accessToken && type === 'recovery') {
          console.log('Processing password recovery...');
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Recovery session error:', sessionError);
            setStatus('error');
            setMessage('Password recovery link error. The link may have expired.');
            return;
          }

          setStatus('success');
          setMessage('Recovery link valid. Redirecting to password reset...');
          
          // Redirect to reset password
          setTimeout(() => {
            navigate('/reset-password', { replace: true });
          }, 1000);
          return;
        }

        // If we get here without processing anything, show error
        console.log('No valid auth tokens found');
        setStatus('error');
        setMessage('Invalid or expired authentication link.');

      } catch (error) {
        console.error('Unexpected callback error:', error);
        setStatus('error');
        setMessage('Unexpected error during authentication.');
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
            <CardTitle>Processing Authentication</CardTitle>
            <CardDescription>
              Please wait while we process your request...
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
            {status === 'success' ? 'Success!' : 'Authentication Error'}
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