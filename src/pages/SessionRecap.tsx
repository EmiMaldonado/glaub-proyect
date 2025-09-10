import React, { useState } from 'react';
import { ArrowLeft, MessageCircle, Hash, Lightbulb, ClipboardList, Brain, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface RecapSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
  isSelected: boolean;
}

const SessionRecap = () => {
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [sections, setSections] = useState<RecapSection[]>([
    {
      id: 'interaction-summary',
      title: 'Interaction Summary',
      icon: MessageCircle,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-foreground/80">
            45-minute therapeutic conversation session focused on anxiety management and coping strategies.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Duration: 45 minutes</span>
            <span>Type: Text & Voice</span>
            <span>Status: Completed</span>
          </div>
        </div>
      ),
      isSelected: false,
    },
    {
      id: 'key-topics',
      title: 'Key Topics',
      icon: Hash,
      content: (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">Anxiety Management</Badge>
          <Badge variant="secondary" className="text-xs">Breathing Techniques</Badge>
          <Badge variant="secondary" className="text-xs">Work Stress</Badge>
          <Badge variant="secondary" className="text-xs">Sleep Patterns</Badge>
          <Badge variant="secondary" className="text-xs">Self-Care</Badge>
          <Badge variant="secondary" className="text-xs">Mindfulness</Badge>
        </div>
      ),
      isSelected: false,
    },
    {
      id: 'core-insights',
      title: 'Core Insights',
      icon: Lightbulb,
      content: (
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span>Identified connection between work deadlines and sleep disruption patterns</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span>Discovered effective breathing technique that reduced anxiety during session</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span>Recognized importance of setting boundaries with work expectations</span>
          </li>
        </ul>
      ),
      isSelected: false,
    },
    {
      id: 'recommended-actions',
      title: 'Recommended Actions',
      icon: ClipboardList,
      content: (
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
            <span>Practice 4-7-8 breathing technique daily before bedtime</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
            <span>Implement 30-minute work-free buffer time before sleep</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
            <span>Schedule weekly check-ins to monitor stress levels</span>
          </li>
        </ul>
      ),
      isSelected: false,
    },
    {
      id: 'ai-recommendations',
      title: 'AI Recommendations',
      icon: Brain,
      content: (
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-info mt-2 flex-shrink-0" />
            <span>Consider exploring progressive muscle relaxation techniques</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-info mt-2 flex-shrink-0" />
            <span>Journaling before bed may help process work-related thoughts</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-info mt-2 flex-shrink-0" />
            <span>Recommended reading: "The Anxiety and Worry Workbook" by David A. Clark</span>
          </li>
        </ul>
      ),
      isSelected: false,
    },
  ]);

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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Session Recap</h1>
          <p className="text-muted-foreground">{currentDate}</p>
        </div>

        {/* Main Content */}
        <div className="space-y-4 mb-8">
          {sections.map((section) => {
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
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
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
      </div>
    </div>
  );
};

export default SessionRecap;