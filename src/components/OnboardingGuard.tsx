import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Skip onboarding check for certain routes
      const skipOnboardingRoutes = ['/auth', '/post-registration', '/auth-callback', '/reset-password'];
      if (skipOnboardingRoutes.some(route => location.pathname.startsWith(route))) {
        setLoading(false);
        return;
      }

      try {
        // Use the safe function to check onboarding status
        const { data, error } = await supabase.rpc('get_user_onboarding_status', {
          target_user_id: user.id
        });

        if (error) {
          console.error('Error checking onboarding status:', error);
          setLoading(false);
          return;
        }

        const completed = data || false;
        setOnboardingCompleted(completed);

        // If onboarding not completed and user is trying to access protected routes
        if (!completed && location.pathname !== '/post-registration') {
          navigate('/post-registration');
          return;
        }

        // If onboarding is completed and user is on post-registration page
        if (completed && location.pathname === '/post-registration') {
          navigate('/dashboard');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in checkOnboardingStatus:', error);
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
};

export default OnboardingGuard;