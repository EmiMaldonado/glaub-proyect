-- Reset the declined invitation back to pending for testing
UPDATE invitations 
SET status = 'pending', updated_at = now() 
WHERE id = '71b068e7-6d9e-4aec-bb2f-384a72c3251b';

-- Update the validate_manager_promotion function to handle manager_request flow
CREATE OR REPLACE FUNCTION public.validate_manager_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If promoting to manager or enabling can_manage_teams
  IF (NEW.can_manage_teams = true AND OLD.can_manage_teams = false) 
     OR (NEW.role = 'manager' AND OLD.role != 'manager') THEN
    
    -- Check if they actually have employees (skip validation if they don't but allow promotion)
    -- This handles the manager_request flow where promotion happens before adding employees
    IF NOT public.validate_manager_has_employees(NEW.id) THEN
      -- Log this for debugging but don't prevent the promotion
      RAISE LOG 'User promoted to manager without existing employees - this is allowed for manager_request flow';
    END IF;
    
    -- Set team name if not set
    IF NEW.team_name IS NULL THEN
      NEW.team_name = COALESCE(NEW.display_name, NEW.full_name, 'Manager') || '''s Team';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;