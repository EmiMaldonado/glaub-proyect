-- Create sharing preferences table
CREATE TABLE public.sharing_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_profile BOOLEAN NOT NULL DEFAULT false,
  share_insights BOOLEAN NOT NULL DEFAULT false,
  share_conversations BOOLEAN NOT NULL DEFAULT false,
  share_ocean_profile BOOLEAN NOT NULL DEFAULT false,
  share_progress BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, manager_id)
);

-- Enable RLS
ALTER TABLE public.sharing_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for sharing preferences
CREATE POLICY "Users can manage their own sharing preferences"
ON public.sharing_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view sharing preferences for their team members"
ON public.sharing_preferences
FOR SELECT
USING (
  manager_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_sharing_preferences_updated_at
BEFORE UPDATE ON public.sharing_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's manager from team memberships
CREATE OR REPLACE FUNCTION public.get_user_manager_id(user_profile_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.manager_id
  FROM team_memberships tm
  WHERE user_profile_id IN (
    tm.employee_1_id, tm.employee_2_id, tm.employee_3_id, tm.employee_4_id, tm.employee_5_id,
    tm.employee_6_id, tm.employee_7_id, tm.employee_8_id, tm.employee_9_id, tm.employee_10_id
  )
  LIMIT 1;
$$;

-- Update conversations table RLS to allow managers to see shared conversations
CREATE POLICY "Managers can view shared conversations from team members"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sharing_preferences sp
    JOIN public.profiles p ON p.user_id = conversations.user_id
    WHERE sp.user_id = conversations.user_id
    AND sp.manager_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND sp.share_conversations = true
  )
);

-- Update key_insights table RLS to allow managers to see shared insights
CREATE POLICY "Managers can view shared insights from team members"
ON public.key_insights
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.sharing_preferences sp ON sp.user_id = c.user_id
    WHERE c.id = key_insights.conversation_id
    AND sp.manager_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND sp.share_insights = true
  )
);

-- Update profiles table RLS to allow managers to see shared profiles
CREATE POLICY "Managers can view shared profiles from team members"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sharing_preferences sp
    WHERE sp.user_id = profiles.user_id
    AND sp.manager_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND sp.share_profile = true
  )
);