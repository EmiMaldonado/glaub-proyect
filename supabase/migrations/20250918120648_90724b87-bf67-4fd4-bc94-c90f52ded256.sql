-- Phase 5: Automatic Configuration - Intelligent Defaults

-- Update sharing_preferences table defaults to be more user-friendly
ALTER TABLE public.sharing_preferences 
ALTER COLUMN share_profile SET DEFAULT true,
ALTER COLUMN share_conversations SET DEFAULT true,
ALTER COLUMN share_insights SET DEFAULT true,
ALTER COLUMN share_ocean_profile SET DEFAULT true,
ALTER COLUMN share_progress SET DEFAULT true,
ALTER COLUMN share_strengths SET DEFAULT true,
ALTER COLUMN share_manager_recommendations SET DEFAULT true;

-- Improve the team name generation trigger
CREATE OR REPLACE FUNCTION public.set_initial_team_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- If role changed to manager and team_name is null, set personalized team name
  IF NEW.role = 'manager' AND OLD.role != 'manager' AND NEW.team_name IS NULL THEN
    NEW.team_name = COALESCE(NEW.display_name, NEW.full_name, 'Manager') || '''s Team';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to auto-setup sharing preferences with intelligent defaults
CREATE OR REPLACE FUNCTION public.setup_default_sharing_preferences(target_user_id uuid, target_manager_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create sharing preferences with intelligent defaults if they don't exist
  INSERT INTO public.sharing_preferences (
    user_id, 
    manager_id,
    share_profile,
    share_conversations,
    share_insights,
    share_ocean_profile,
    share_progress,
    share_strengths,
    share_manager_recommendations
  ) VALUES (
    target_user_id,
    target_manager_id,
    true, -- Share all by default for better collaboration
    true,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id, manager_id) DO NOTHING;
END;
$$;

-- Create function to send welcome notifications
CREATE OR REPLACE FUNCTION public.send_welcome_notification(target_user_id uuid, notification_type text, team_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  title_text text;
  message_text text;
BEGIN
  CASE notification_type
    WHEN 'new_manager' THEN
      title_text := 'Welcome to Management!';
      message_text := 'You''re now a manager! Your team "' || COALESCE(team_name, 'Your Team') || '" is ready. Start inviting members and explore your management dashboard.';
    WHEN 'joined_team' THEN
      title_text := 'Welcome to ' || COALESCE(team_name, 'the Team') || '!';
      message_text := 'You''ve successfully joined the team. All sharing preferences are enabled by default for better collaboration. You can adjust them anytime in your settings.';
    ELSE
      title_text := 'Welcome!';
      message_text := 'Welcome to the platform. Explore your dashboard to get started.';
  END CASE;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    target_user_id,
    'welcome',
    title_text,
    message_text,
    jsonb_build_object('notification_type', notification_type, 'team_name', team_name)
  );
END;
$$;