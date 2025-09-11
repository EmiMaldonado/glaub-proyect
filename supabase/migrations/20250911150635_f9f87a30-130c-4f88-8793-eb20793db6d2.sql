-- Create key_insights table for conversation analysis
CREATE TABLE public.key_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  insights JSONB DEFAULT '[]'::jsonb,
  personality_notes JSONB DEFAULT '{}'::jsonb,
  next_steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.key_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for key_insights
CREATE POLICY "Users can view insights for their conversations" 
ON public.key_insights 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = key_insights.conversation_id 
  AND conversations.user_id = auth.uid()
));

CREATE POLICY "Users can create insights for their conversations" 
ON public.key_insights 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = key_insights.conversation_id 
  AND conversations.user_id = auth.uid()
));

CREATE POLICY "Users can update insights for their conversations" 
ON public.key_insights 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = key_insights.conversation_id 
  AND conversations.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_key_insights_updated_at
  BEFORE UPDATE ON public.key_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();