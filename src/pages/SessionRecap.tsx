import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Hash, Lightbulb, ClipboardList, Check, Loader2, Target, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecapSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
  isSelected: boolean;
}

const SessionRecap = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<RecapSection[]>([]);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    if (conversationId && user) {
      loadSessionData();
    }
  }, [conversationId, user]);

  const loadSessionData = async () => {
    try {
      setIsLoading(true);

      // Fetch conversation data
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convError) throw convError;

      // Fetch insights data
      const { data: insights, error: insightsError } = await supabase
        .from('key_insights')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (insightsError && insightsError.code !== 'PGSQL_P0002') {
        console.error('Insights error:', insightsError);
      }

      setSessionData({ conversation, insights });

      // Build sections with real data
      const sessionSections: RecapSection[] = [
        {
          id: 'interaction-summary',
          title: 'Interaction Summary',
          icon: MessageCircle,
          content: (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">
                {conversation.title || 'Therapeutic conversation session'}
              </p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Duration: {conversation.duration_minutes || 0} minutes</span>
                <span>Type: Text & Voice</span>
                <span>Status: {conversation.status}</span>
              </div>
            </div>
          ),
          isSelected: false,
        },
        {
          id: 'core-insights',
          title: 'Core Insights',
          icon: Lightbulb,
          content: insights?.insights ? (
            <ul className="space-y-2 text-sm">
              {(insights.insights as string[]).slice(0, 5).map((insight: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No insights available for this session.</p>
          ),
          isSelected: false,
        },
        {
          id: 'recommended-actions',
          title: 'Growth Opportunities',
          icon: ClipboardList,
          content: insights?.next_steps ? (
            <ul className="space-y-2 text-sm">
              {(insights.next_steps as string[]).slice(0, 5).map((step: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recommendations available for this session.</p>
          ),
          isSelected: false,
        }
      ];

      // Add OCEAN Profile section if available
      if (insights?.personality_notes) {
        const oceanData = insights.personality_notes as any;
        sessionSections.push({
          id: 'ocean-profile',
          title: 'OCEAN Personality Profile',
          icon: User,
          content: (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{oceanData?.openness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Openness</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{oceanData?.conscientiousness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Conscientiousness</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{oceanData?.extraversion || 0}%</div>
                  <div className="text-xs text-muted-foreground">Extraversion</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{oceanData?.agreeableness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Agreeableness</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{100 - (oceanData?.neuroticism || 0)}%</div>
                  <div className="text-xs text-muted-foreground">Stability</div>
                </div>
              </div>
              {oceanData?.summary && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-foreground/80">{oceanData.summary}</p>
                </div>
              )}
            </div>
          ),
          isSelected: false,
        });
      }

      setSections(sessionSections);
    } catch (error) {
      console.error('Error loading session data:', error);
      toast({
        title: "Error loading session data",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, isSelected: !section.isSelected }
          : section
      )
    );
  };

  const selectedCount = sections.filter(s => s.isSelected).length;

  const handleSendToManager = async () => {
    if (selectedCount === 0) return;
    
    setIsSending(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSending(false);
    
    toast({
      title: "Session recap sent successfully",
      description: `${selectedCount} section${selectedCount === 1 ? '' : 's'} shared with your manager.`,
    });
    
    // Reset selections after successful send
    setSections(prev => prev.map(section => ({ ...section, isSelected: false })));
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (!conversationId) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">No Session Selected</h1>
          <p className="text-muted-foreground mb-4">Please select a session to view its recap.</p>
          <Button onClick={() => navigate('/dashboard?refresh=true')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Session Recap</h1>
          <p className="text-muted-foreground">{currentDate}</p>
          {sessionData?.conversation && (
            <p className="text-sm text-muted-foreground mt-2">
              {sessionData.conversation.title || 'Conversation Session'}
            </p>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading session data...</span>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="space-y-4 mb-8">
              {sections.length === 0 ? (
                <Card className="border border-border bg-card">
                  <CardContent className="py-12 text-center">
                    <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Session Data Available</h3>
                    <p className="text-muted-foreground">
                      This session hasn't been analyzed yet or the analysis is incomplete.
                    </p>
                  </CardContent>
                </Card>
               ) : (
                 sections.map((section) => {
                   const IconComponent = section.icon;
                   
                   return (
                     <Card key={section.id} className="border border-border bg-card hover:shadow-sm transition-shadow">
                       <CardHeader className="pb-3">
                         <div className="flex items-center justify-between">
                           <CardTitle className="flex items-center gap-3 text-lg">
                             <div className="p-2 rounded-lg bg-primary/10">
                               <IconComponent className="w-4 h-4 text-primary" />
                             </div>
                             {section.title}
                           </CardTitle>
                           <div className="flex items-center space-x-2">
                             <Checkbox
                               id={section.id}
                               checked={section.isSelected}
                               onCheckedChange={() => toggleSection(section.id)}
                               className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                             />
                             <label 
                               htmlFor={section.id} 
                               className="text-sm text-muted-foreground cursor-pointer"
                             >
                               Share with manager
                             </label>
                           </div>
                         </div>
                       </CardHeader>
                       <CardContent className="pt-0">
                         {section.content}
                       </CardContent>
                     </Card>
                   );
                 })
               )}
             </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard?refresh=true')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              
              <Button
                onClick={handleSendToManager}
                disabled={selectedCount === 0 || isSending}
                className="flex items-center gap-2 min-w-[140px]"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Send to Manager
                    {selectedCount > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedCount}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionRecap;