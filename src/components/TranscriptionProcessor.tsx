import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TranscriptionProcessorProps {
  audioBlob: Blob | null;
  onTranscriptionComplete: (transcription: string) => void;
  onInsightsGenerated: (insights: ConversationInsights) => void;
}

interface ConversationInsights {
  topicsDiscussed: string[];
  keyDecisions: string[];
  nextSteps: string[];
  overallSentiment: {
    score: number;
    label: string;
    description: string;
  };
  processingTime: number;
  confidence: number;
}

const TranscriptionProcessor: React.FC<TranscriptionProcessorProps> = ({
  audioBlob,
  onTranscriptionComplete,
  onInsightsGenerated
}) => {
  const [processingState, setProcessingState] = useState<'idle' | 'transcribing' | 'generating-insights' | 'complete'>('idle');
  const [transcription, setTranscription] = useState<string>('');
  const [insights, setInsights] = useState<ConversationInsights | null>(null);
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mock transcription service
  const mockTranscribe = async (blob: Blob): Promise<string> => {
    // Simulate API call delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await delay(200);
    }

    // Mock transcription based on audio duration/size
    const mockTranscriptions = [
      "I've been thinking about ways to improve our team's productivity. Maybe we should consider implementing a new project management system that could help us track our progress better and identify bottlenecks early on.",
      "The quarterly review went well overall. We met most of our targets, but there are definitely areas where we can improve. I think we need to focus more on client communication and follow-up processes.",
      "During today's discussion, we covered several important topics including budget allocation, timeline adjustments, and resource management. The team seems aligned on the priorities for next quarter.",
      "I wanted to share some thoughts on the recent changes in our workflow. The new system is showing promising results, but we might need to adjust our approach based on the feedback we've received from users."
    ];

    return mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
  };

  // Mock insights generation
  const generateInsights = async (text: string): Promise<ConversationInsights> => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Simulate processing time
    for (let i = 0; i <= 100; i += 15) {
      setProgress(i);
      await delay(150);
    }

    const mockInsights: ConversationInsights = {
      topicsDiscussed: [
        "Team productivity optimization",
        "Project management systems",
        "Quarterly performance review",
        "Client communication strategies"
      ],
      keyDecisions: [
        "Implement new project management system",
        "Focus on client communication improvements", 
        "Adjust timeline for Q2 deliverables",
        "Allocate additional resources to user feedback"
      ],
      nextSteps: [
        "Research and evaluate project management tools",
        "Schedule follow-up meetings with key clients",
        "Create communication improvement plan",
        "Gather more detailed user feedback"
      ],
      overallSentiment: {
        score: 0.72,
        label: "Positive",
        description: "The conversation shows constructive thinking and problem-solving approach"
      },
      processingTime: 2.3,
      confidence: 0.89
    };

    return mockInsights;
  };

  const processAudio = async () => {
    if (!audioBlob) return;

    try {
      // Step 1: Transcribe audio
      setProcessingState('transcribing');
      setProgress(0);
      const transcriptionResult = await mockTranscribe(audioBlob);
      setTranscription(transcriptionResult);
      onTranscriptionComplete(transcriptionResult);

      // Step 2: Generate insights
      setProcessingState('generating-insights');
      setProgress(0);
      const insightsResult = await generateInsights(transcriptionResult);
      setInsights(insightsResult);
      onInsightsGenerated(insightsResult);

      setProcessingState('complete');
    } catch (error) {
      console.error('Processing failed:', error);
      setProcessingState('idle');
    }
  };

  useEffect(() => {
    if (audioBlob && processingState === 'idle') {
      processAudio();
    }
  }, [audioBlob]);

  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'text-success';
    if (score >= 0.4) return 'text-warning';
    return 'text-error';
  };

  const getSentimentBadgeVariant = (score: number) => {
    if (score >= 0.7) return 'default';
    if (score >= 0.4) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Processing State */}
      {(processingState === 'transcribing' || processingState === 'generating-insights') && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {processingState === 'transcribing' ? 'Transcribing audio...' : 'Generating insights...'}
                  </span>
                  <span className="text-sm text-muted-foreground">{progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcription Display */}
      {transcription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Transcription</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {transcription.length} characters
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Collapsible open={isTranscriptionExpanded} onOpenChange={setIsTranscriptionExpanded}>
              <div className="space-y-3">
                <Textarea
                  value={transcription}
                  readOnly
                  className="min-h-[80px] resize-none bg-muted/50"
                  style={{
                    height: isTranscriptionExpanded ? 'auto' : '80px'
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    {isTranscriptionExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Show Full Transcription
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Insights Display */}
      {insights && processingState === 'complete' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-semibold">Conversation Insights</h3>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>Confidence: {Math.round(insights.confidence * 100)}%</span>
            </div>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Topics Discussed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-primary">Topics Discussed</CardTitle>
                <CardDescription>Key themes from the conversation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.topicsDiscussed.map((topic, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-primary/60" />
                      <span className="text-sm">{topic}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Key Decisions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-warning">Key Decisions</CardTitle>
                <CardDescription>Important decisions made</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.keyDecisions.map((decision, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-warning/60" />
                      <span className="text-sm">{decision}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-success">Next Steps</CardTitle>
                <CardDescription>Action items identified</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.nextSteps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-success/60" />
                      <span className="text-sm">{step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Overall Sentiment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Overall Sentiment</CardTitle>
                <CardDescription>Emotional tone analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={getSentimentBadgeVariant(insights.overallSentiment.score)}>
                      {insights.overallSentiment.label}
                    </Badge>
                    <span className={`font-semibold ${getSentimentColor(insights.overallSentiment.score)}`}>
                      {Math.round(insights.overallSentiment.score * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        insights.overallSentiment.score >= 0.7 ? 'bg-success' :
                        insights.overallSentiment.score >= 0.4 ? 'bg-warning' : 'bg-error'
                      }`}
                      style={{ width: `${insights.overallSentiment.score * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {insights.overallSentiment.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generate New Insights Button */}
          <div className="text-center pt-4">
            <Button 
              variant="outline" 
              onClick={() => processAudio()}
              className="hover:bg-primary/5 hover:border-primary/50"
            >
              <Brain className="w-4 h-4 mr-2" />
              Generate New Insights
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionProcessor;