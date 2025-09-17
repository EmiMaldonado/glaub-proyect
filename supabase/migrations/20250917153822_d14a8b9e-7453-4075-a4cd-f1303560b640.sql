-- Phase 1: Team Management System Foundation

-- Add notification system table for invitation responses
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('invitation_accepted', 'invitation_declined', 'team_invite', 'role_change')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications for users" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true); -- Allow service role to create notifications

-- Add updated_at trigger for notifications
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update invitations table to support Employee → Manager flow
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS invitation_type TEXT DEFAULT 'team_member' CHECK (invitation_type IN ('team_member', 'manager_request'));

ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS invited_by_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update invitation RLS policies to support the new flow
DROP POLICY IF EXISTS "Managers can create invitations for their profile" ON public.invitations;
DROP POLICY IF EXISTS "Anyone authenticated can manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.invitations;

-- Create proper RLS policies for invitations
CREATE POLICY "Users can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE id = invited_by_id
  )
);

CREATE POLICY "Users can view invitations they sent or received" 
ON public.invitations 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE id = manager_id OR id = invited_by_id
  )
);

CREATE POLICY "Users can update invitations they sent or received" 
ON public.invitations 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE id = manager_id OR id = invited_by_id
  )
);

-- Update sharing preferences to include all required fields
ALTER TABLE public.sharing_preferences 
ADD COLUMN IF NOT EXISTS share_strengths BOOLEAN DEFAULT FALSE;

ALTER TABLE public.sharing_preferences 
ADD COLUMN IF NOT EXISTS share_manager_recommendations BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_type ON public.invitations(invitation_type);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations(invited_by_id);

-- Create function to handle manager demotion when no team members
CREATE OR REPLACE FUNCTION public.check_and_demote_manager_if_no_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this was a deletion that might affect team size
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- Check if manager still has team members
    IF NOT public.manager_has_team_members(COALESCE(OLD.manager_id, NEW.manager_id)) THEN
      -- Demote manager and clear team name
      UPDATE public.profiles 
      SET role = 'employee', team_name = NULL
      WHERE id = COALESCE(OLD.manager_id, NEW.manager_id);
      
      -- Create notification for the demoted manager
      INSERT INTO public.notifications (user_id, type, title, message, data)
      SELECT 
        p.user_id,
        'role_change',
        'Role Changed to Employee',
        'You have been automatically changed from manager to employee as you no longer have any team members.',
        '{"previous_role": "manager", "new_role": "employee"}'::jsonb
      FROM public.profiles p
      WHERE p.id = COALESCE(OLD.manager_id, NEW.manager_id);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for automatic manager demotion
DROP TRIGGER IF EXISTS auto_demote_manager_trigger ON public.team_memberships;
CREATE TRIGGER auto_demote_manager_trigger
  AFTER UPDATE OR DELETE ON public.team_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_demote_manager_if_no_team();

-- Create function to get user notifications
CREATE OR REPLACE FUNCTION public.get_user_notifications(target_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  type TEXT,
  title TEXT,  
  message TEXT,
  data JSONB,
  read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.type, n.title, n.message, n.data, n.read, n.created_at
  FROM public.notifications n
  WHERE n.user_id = COALESCE(target_user_id, auth.uid())
  ORDER BY n.created_at DESC;
$$;