import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/utils/errorMessages';

// Tipo para el perfil basado en tu tabla profiles
interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  organization: string | null;
  created_at: string;
  updated_at: string;
  manager_id: string | null;
  team_name: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  job_position: string | null;
  onboarding_completed: boolean | null;
  job_level: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null; // ✅ NUEVO: Agregar profile
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  refreshSession: () => Promise<{ session: Session | null; error: any }>;
  fetchProfile: () => Promise<void>; // ✅ NUEVO: Función para actualizar perfil
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
  const [profile, setProfile] = useState<Profile | null>(null); // ✅ NUEVO: Estado del perfil
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ NUEVA FUNCIÓN: Obtener o crear perfil
  const fetchOrCreateProfile = async (userId: string, userEmail: string, userData?: any) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Intentar obtener perfil existente
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingProfile) {
        console.log('Profile found:', existingProfile);
        setProfile(existingProfile);
        return existingProfile;
      }

      // Si no existe perfil y no hay error crítico, crear uno
      if (fetchError && fetchError.code === 'PGRST116') {
        console.log('Profile not found, creating new one...');
        
        const newProfile = {
          user_id: userId,
          email: userEmail,
          full_name: userData?.full_name || '',
          display_name: userData?.display_name || userData?.full_name?.split(' ')[0] || '',
          role: 'employee',
          onboarding_completed: false,
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          toast({
            title: "Profile creation failed",
            description: "Could not create user profile. Some features may not work properly.",
            variant: "destructive",
          });
          return null;
        }

        console.log('Profile created successfully:', createdProfile);
        setProfile(createdProfile);
        return createdProfile;
      }

      // Si hay otro tipo de error
      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
      }

      return null;
    } catch (error) {
      console.error('Unexpected error in fetchOrCreateProfile:', error);
      return null;
    }
  };

  // ✅ NUEVA FUNCIÓN: Actualizar perfil manualmente
  const fetchProfile = async () => {
    if (!user?.id) return;
    await fetchOrCreateProfile(user.id, user.email || '', user.user_metadata);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => { // ✅ CAMBIO: hacer async para manejar perfil
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);

        // ✅ NUEVO: Manejar perfil según el estado de auth
        if (session?.user) {
          // Obtener o crear perfil cuando el usuario se autentica
          await fetchOrCreateProfile(
            session.user.id, 
            session.user.email || '', 
            session.user.user_metadata
          );
        } else {
          // Limpiar perfil cuando se desautentica
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // ✅ NUEVO: También obtener perfil para sesión existente
      if (session?.user) {
        await fetchOrCreateProfile(
          session.user.id, 
          session.user.email || '', 
          session.user.user_metadata
        );
      }
      
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
        // Better handling of specific errors
        if (error.message.includes('Email not confirmed')) {
          toast({
            ...ERROR_MESSAGES.AUTH.EMAIL_CONFIRMATION_ERROR,
            description: "Please confirm your email. Check your inbox and spam folder.",
            variant: "destructive",
          });
        } else if (error.message.includes('Invalid login credentials')) {
          toast({
            ...ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
            variant: "destructive",
          });
        } else {
          toast({
            ...ERROR_MESSAGES.AUTH.LOGIN_ERROR,
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast(SUCCESS_MESSAGES.AUTH.LOGIN_SUCCESS);
        // ✅ El perfil se cargará automáticamente por el onAuthStateChange
      }
      
      return { error };
    } catch (error) {
      toast(ERROR_MESSAGES.GENERAL.UNEXPECTED_ERROR);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      console.log('Attempting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
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
      
      console.log('Signup response:', { data: !!data, error });
      
      if (error) {
        console.error('Signup error:', error);
        
        if (error.message.includes('User already registered')) {
          toast({
            title: "Account already exists",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
        } else if (error.message.includes('Password should be at least')) {
          toast({
            title: "Password too weak",
            description: "Password should be at least 6 characters long.",
            variant: "destructive",
          });
        } else if (error.message.includes('Unable to validate email address')) {
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
        } else {
        toast({
          ...ERROR_MESSAGES.AUTH.REGISTRATION_ERROR,
          description: error.message,
          variant: "destructive",
        });
        }
      } else {
        console.log('Signup successful, user created:', data.user?.id);
        
        // ✅ El perfil se creará automáticamente por el onAuthStateChange
        // cuando el usuario confirme el email y se autentique
        
        // Check if email confirmation is required
        if (data.user && !data.user.email_confirmed_at) {
          toast({
            title: "Registration successful!",
            description: "Please check your email and click the confirmation link to complete registration. Check your spam folder if you don't see the email.",
            duration: 10000, // Show for 10 seconds
          });
        } else {
          toast({
            title: "Registration successful!",
            description: "Welcome to Gläub! You can now start using the app.",
          });
        }
      }
      
      return { error };
    } catch (error: any) {
      console.error('Unexpected signup error:', error);
      toast({
        ...ERROR_MESSAGES.GENERAL.UNEXPECTED_ERROR, 
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
      setProfile(null); // ✅ NUEVO: Limpiar perfil también
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
      setProfile(null); // ✅ NUEVO: Limpiar perfil también
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
      const { data, error } = await supabase.functions.invoke('forgot-password', {
        body: { email }
      });
      
      if (error) {
        console.error('Forgot password error:', error);
        toast({
          title: "Error",
          description: "Failed to send reset email. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email sent",
          description: "If an account with that email exists, a reset link has been sent.",
        });
      }
      
      return { error };
    } catch (error) {
      console.error('Forgot password error:', error);
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
      console.log('Attempting to resend confirmation for:', email);
      
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      console.log('Resend confirmation response:', { data, error });
      
      if (error) {
        console.error('Resend confirmation error:', error);
        
        if (error.message.includes('Email rate limit exceeded')) {
          toast({
            title: "Too many requests",
            description: "Please wait a few minutes before requesting another confirmation email.",
            variant: "destructive",
          });
        } else if (error.message.includes('User not found')) {
          toast({
            title: "Account not found",
            description: "No account found with this email address. Please sign up first.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Confirmation email sent",
          description: "A new confirmation email has been sent. Please check your inbox and spam folder.",
          duration: 8000,
        });
      }
      
      return { error };
    } catch (error: any) {
      console.error('Unexpected resend confirmation error:', error);
      toast({
        title: "Unexpected error",
        description: "Could not resend confirmation email. Please try again.",
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
        
        // ✅ NUEVO: También actualizar perfil cuando se refresca la sesión
        if (data.session.user) {
          await fetchOrCreateProfile(
            data.session.user.id, 
            data.session.user.email || '', 
            data.session.user.user_metadata
          );
        }
      }
      return { session: data.session, error };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return { session: null, error };
    }
  };

  const value = {
    user,
    profile, // ✅ NUEVO: Exponer perfil
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    resendConfirmation,
    refreshSession,
    fetchProfile, // ✅ NUEVO: Exponer función para actualizar perfil
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
