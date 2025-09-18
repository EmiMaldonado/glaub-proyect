-- Create manager_recommendations table for caching team recommendations
CREATE TABLE IF NOT EXISTS public.manager_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id uuid NOT NULL,
  team_hash text NOT NULL, -- Hash of team member IDs for cache invalidation
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create individual_recommendations table for caching individual member recommendations
CREATE TABLE IF NOT EXISTS public.individual_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id uuid NOT NULL,
  member_id uuid NOT NULL,
  member_hash text NOT NULL, -- Hash of member data for cache invalidation
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  leadership_tips jsonb NOT NULL DEFAULT '[]'::jsonb,
  member_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manager_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for manager_recommendations
CREATE POLICY "Managers can view their own team recommendations" 
ON public.manager_recommendations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = manager_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can create their own team recommendations" 
ON public.manager_recommendations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = manager_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can update their own team recommendations" 
ON public.manager_recommendations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = manager_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can delete their own team recommendations" 
ON public.manager_recommendations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = manager_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create policies for individual_recommendations
CREATE POLICY "Managers can view their team member recommendations" 
ON public.individual_recommendations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = individual_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can create their team member recommendations" 
ON public.individual_recommendations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = individual_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can update their team member recommendations" 
ON public.individual_recommendations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = individual_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can delete their team member recommendations" 
ON public.individual_recommendations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = individual_recommendations.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX idx_manager_recommendations_manager_id ON public.manager_recommendations(manager_id);
CREATE INDEX idx_manager_recommendations_team_hash ON public.manager_recommendations(team_hash);
CREATE INDEX idx_manager_recommendations_expires_at ON public.manager_recommendations(expires_at);

CREATE INDEX idx_individual_recommendations_manager_id ON public.individual_recommendations(manager_id);
CREATE INDEX idx_individual_recommendations_member_id ON public.individual_recommendations(member_id);
CREATE INDEX idx_individual_recommendations_member_hash ON public.individual_recommendations(member_hash);
CREATE INDEX idx_individual_recommendations_expires_at ON public.individual_recommendations(expires_at);

-- Add unique constraints for cache efficiency
ALTER TABLE public.manager_recommendations ADD CONSTRAINT unique_manager_team_hash UNIQUE (manager_id, team_hash);
ALTER TABLE public.individual_recommendations ADD CONSTRAINT unique_manager_member_hash UNIQUE (manager_id, member_id, member_hash);

-- Create trigger for updated_at columns
CREATE TRIGGER update_manager_recommendations_updated_at
  BEFORE UPDATE ON public.manager_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_individual_recommendations_updated_at
  BEFORE UPDATE ON public.individual_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();