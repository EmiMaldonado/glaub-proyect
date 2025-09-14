import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  refreshSession: () => Promise<{ session: Session | null; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Mejor manejo de errores específicos
        if (error.message.includes('Email not confirmed')) {
          toast({
            title: "Email no confirmado",
            description: "Por favor confirma tu email. Revisa tu bandeja de entrada y carpeta de spam.",
            variant: "destructive",
          });
        } else if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Credenciales incorrectas",
            description: "Email o contraseña incorrectos. Verifica tus datos.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error de login",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "¡Bienvenido!",
          description: "You have successfully signed in",
        });
      }
      
      return { error };
    } catch (error) {
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            display_name: fullName?.split(' ')[0],
          }
        }
      });
      
      if (error) {
        toast({
          title: "Registration error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration successful!",
          description: "Please verify your email to complete registration",
        });
      }
      
      return { error };
    } catch (error) {
        toast({
          title: "Unexpected error", 
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Logout completo que limpia TODO
      await supabase.auth.signOut();
      
      // Limpiar localStorage y sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Resetear estados de React
      setUser(null);
      setSession(null);
      
      toast({
        title: "Session Closed",
        description: "You have successfully signed out",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      
      // Aunque haya error, forzar limpieza local
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
      setSession(null);
      
      toast({
        title: "Error",
        description: "There was a problem signing out, but it has been cleared locally",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email sent",
          description: "Check your email to reset your password",
        });
      }
      
      return { error };
    } catch (error) {
        toast({
          title: "Unexpected error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      return { error };
    }
  };

  const resendConfirmation = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email reenviado",
          description: "Se ha enviado un nuevo email de confirmación. Revisa tu bandeja de entrada.",
        });
      }
      
      return { error };
    } catch (error) {
      toast({
        title: "Error inesperado",
        description: "No se pudo reenviar el email de confirmación",
        variant: "destructive",
      });
      return { error };
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return { session: data.session, error };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return { session: null, error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    resendConfirmation,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};