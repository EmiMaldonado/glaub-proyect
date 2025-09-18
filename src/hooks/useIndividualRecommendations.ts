import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IndividualRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'communication' | 'development' | 'motivation' | 'performance';
}

interface LeadershipTip {
  situation: string;
  approach: string;
  avoid: string;
}

interface MemberAnalysis {
  strengths: string[];
  growthAreas: string[];
  communicationStyle: string;
  motivationFactors: string[];
}

interface IndividualRecommendationsData {
  recommendations: IndividualRecommendation[];
  leadershipTips: LeadershipTip[];
  memberAnalysis: MemberAnalysis;
  cached: boolean;
  generatedAt: string;
}

export const useIndividualRecommendations = () => {
  const [data, setData] = useState<IndividualRecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = useCallback(async (managerId: string, member: any) => {
    if (!managerId || !member) {
      setError('Manager ID and member data are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Generating individual recommendations for:', member.display_name || member.full_name);
      
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'generate-individual-recommendations',
        {
          body: {
            managerId,
            member
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

      console.log('Individual recommendations generated:', result?.cached ? 'from cache' : 'fresh');
      setData(result);
      
    } catch (err) {
      console.error('Error generating individual recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate individual recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(async (managerId: string, memberId: string) => {
    try {
      // Delete cached recommendations to force refresh
      const { error } = await supabase
        .from('individual_recommendations')
        .delete()
        .eq('manager_id', managerId)
        .eq('member_id', memberId);

      if (error) {
        console.error('Error clearing individual recommendations cache:', error);
      } else {
        console.log('Individual recommendations cache cleared');
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