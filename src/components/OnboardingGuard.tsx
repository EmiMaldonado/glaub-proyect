import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  // ✅ EMERGENCY FIX: Bypass onboarding checks during repair
  // This allows users to access dashboard without onboarding blocking
  console.log('🚨 OnboardingGuard: Emergency bypass active');
  
  return <>{children}</>;
};

export default OnboardingGuard;