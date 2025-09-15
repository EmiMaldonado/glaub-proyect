-- Create table for temporarily storing paused conversations
CREATE TABLE public.paused_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  conversation_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paused_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own paused conversations" 
ON public.paused_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own paused conversations" 
ON public.paused_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own paused conversations" 
ON public.paused_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own paused conversations" 
ON public.paused_conversations 
FOR DELETE 
USING (auth.uid() = user_id);