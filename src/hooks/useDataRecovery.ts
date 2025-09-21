import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useDataRecovery = () => {
  const { user } = useAuth();

  // Find completed conversations without insights
  const findConversationsNeedingAnalysis = useCallback(async () => {
    if (!user) return [];

    try {
      // Get completed conversations that don't have corresponding key_insights records
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          id, 
          title, 
          status, 
          duration_minutes, 
          ended_at,
          created_at
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('duration_minutes', 1); // Only conversations that met minimum duration

      if (!conversations) return [];

      // Check which conversations have insights
      const conversationIds = conversations.map(c => c.id);
      const { data: existingInsights } = await supabase
        .from('key_insights')
        .select('conversation_id')
        .in('conversation_id', conversationIds);

      const insightConversationIds = new Set(existingInsights?.map(i => i.conversation_id) || []);
      
      // Return conversations without insights
      return conversations.filter(c => !insightConversationIds.has(c.id));
    } catch (error) {
      console.error('Error finding conversations needing analysis:', error);
      return [];
    }
  }, [user]);

  // Recover analysis for a single conversation
  const recoverConversationAnalysis = useCallback(async (conversationId: string) => {
    if (!user) return false;

    try {
      console.log(`🔄 Recovering analysis for conversation: ${conversationId}`);
      
      const response = await supabase.functions.invoke('session-analysis', {
        body: {
          conversationId,
          userId: user.id
        }
      });

      if (response.error) {
        console.error('❌ Recovery analysis failed:', response.error);
        return false;
      }

      console.log('✅ Recovery analysis completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Recovery analysis failed:', error);
      return false;
    }
  }, [user]);

  // Recover analysis for all conversations missing insights
  const recoverAllMissingAnalyses = useCallback(async () => {
    if (!user) return { success: 0, failed: 0, total: 0 };

    try {
      const conversationsNeedingAnalysis = await findConversationsNeedingAnalysis();
      
      if (conversationsNeedingAnalysis.length === 0) {
        toast({
          title: "✅ All Up to Date",
          description: "All your conversations already have personality insights generated.",
        });
        return { success: 0, failed: 0, total: 0 };
      }

      console.log(`🔄 Starting recovery for ${conversationsNeedingAnalysis.length} conversations`);
      
      let success = 0;
      let failed = 0;
      
      // Process conversations one by one to avoid overwhelming the system
      for (const conversation of conversationsNeedingAnalysis) {
        try {
          const recovered = await recoverConversationAnalysis(conversation.id);
          if (recovered) {
            success++;
            console.log(`✅ Recovered analysis for: ${conversation.title}`);
          } else {
            failed++;
            console.log(`❌ Failed to recover analysis for: ${conversation.title}`);
          }
          
          // Small delay between requests to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failed++;
          console.error(`❌ Error recovering ${conversation.title}:`, error);
        }
      }

      const total = conversationsNeedingAnalysis.length;
      
      if (success > 0) {
        toast({
          title: "🎉 Analysis Recovery Complete",
          description: `Successfully recovered ${success} of ${total} conversations. ${failed > 0 ? `${failed} failed.` : ''}`,
        });
      } else {
        toast({
          title: "⚠️ Recovery Issues",
          description: `Could not recover analysis for ${total} conversations. Check console for details.`,
          variant: "destructive",
        });
      }

      return { success, failed, total };
    } catch (error) {
      console.error('❌ Error in batch recovery:', error);
      toast({
        title: "❌ Recovery Failed",
        description: "Could not complete analysis recovery. Please try again.",
        variant: "destructive",
      });
      return { success: 0, failed: 0, total: 0 };
    }
  }, [user, findConversationsNeedingAnalysis, recoverConversationAnalysis]);

  return {
    findConversationsNeedingAnalysis,
    recoverConversationAnalysis,
    recoverAllMissingAnalyses
  };
};