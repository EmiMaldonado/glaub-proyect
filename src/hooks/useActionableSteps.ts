import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActionableSteps {
  summary: string;
  steps: string[];
}

export const useActionableSteps = () => {
  const { user } = useAuth();
  const [actionableSteps, setActionableSteps] = useState<ActionableSteps | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateActionableSteps = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'generate-actionable-steps',
        {
          body: {
            userId: user.id
          }
        }
      );

      if (functionError) {
        console.error('Error calling generate-actionable-steps function:', functionError);
        setError('Failed to generate actionable steps');
        return;
      }

      if (data?.actionableSteps) {
        setActionableSteps(data.actionableSteps);
      }
    } catch (err) {
      console.error('Error generating actionable steps:', err);
      setError('Failed to generate actionable steps');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      generateActionableSteps();
    }
  }, [user]);

  return {
    actionableSteps,
    isLoading,
    error,
    regenerate: generateActionableSteps
  };
};