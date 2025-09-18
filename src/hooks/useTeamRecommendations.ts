import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'communication' | 'productivity' | 'development' | 'wellbeing';
}

interface TeamAnalysis {
  strengths: string[];
  challenges: string[];
  dynamics: string;
  diversity: string;
}

interface TeamRecommendationsData {
  recommendations: TeamRecommendation[];
  teamAnalysis: TeamAnalysis;
  oceanDescription?: string;
  cached: boolean;
  generatedAt: string;
}

export const useTeamRecommendations = () => {
  const [data, setData] = useState<TeamRecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = useCallback(async (managerId: string, teamMembers: any[]) => {
    if (!managerId || teamMembers.length === 0) {
      setError('Manager ID and team members are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Generating team recommendations for:', managerId);
      
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'generate-team-recommendations',
        {
          body: {
            managerId,
            teamMembers
          }
        }
      );

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to generate recommendations');
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      console.log('Team recommendations generated:', result?.cached ? 'from cache' : 'fresh');
      setData(result);
      
    } catch (err) {
      console.error('Error generating team recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate team recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(async (managerId: string) => {
    try {
      // Delete cached recommendations to force refresh
      const { error } = await supabase
        .from('manager_recommendations')
        .delete()
        .eq('manager_id', managerId);

      if (error) {
        console.error('Error clearing recommendations cache:', error);
      } else {
        console.log('Team recommendations cache cleared');
        setData(null);
      }
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  }, []);

  return {
    data,
    loading,
    error,
    generateRecommendations,
    clearCache
  };
};