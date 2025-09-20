-- Fix team limits validation - remove overly restrictive trigger

-- Drop the overly restrictive team limits trigger that's causing invitation failures
DROP TRIGGER IF EXISTS validate_team_limits_trigger ON team_members;
DROP FUNCTION IF EXISTS validate_team_limits();

-- Create a more reasonable validation trigger
CREATE OR REPLACE FUNCTION public.validate_reasonable_team_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  team_member_count INTEGER;
BEGIN
  -- Only validate team size limit (10 members max per team)
  SELECT COUNT(*) INTO team_member_count
  FROM team_members 
  WHERE team_id = NEW.team_id;
  
  IF team_member_count >= 10 THEN
    RAISE EXCEPTION 'Team cannot have more than 10 members';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create new trigger with reasonable limits (only team size, not user limits)
CREATE TRIGGER validate_team_limits_trigger
BEFORE INSERT ON team_members
FOR EACH ROW
EXECUTE FUNCTION validate_reasonable_team_limits();