-- PHASE 1: Add missing manager_id column to profiles
ALTER TABLE public.profiles 
ADD COLUMN manager_id UUID REFERENCES public.profiles(id);

-- PHASE 2: Create hierarchical relationship table for N:N management relationships  
CREATE TABLE public.manager_employee_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(manager_id, employee_id),
  -- Prevent self-management
  CONSTRAINT no_self_management CHECK (manager_id != employee_id)
);

-- Enable RLS on the new table
ALTER TABLE public.manager_employee_relationships ENABLE ROW LEVEL SECURITY;

-- PHASE 3: Create hierarchical navigation functions
CREATE OR REPLACE FUNCTION public.get_direct_reports(manager_profile_id UUID)
RETURNS TABLE(employee_id UUID, employee_name TEXT, employee_email TEXT)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    mer.employee_id,
    p.full_name as employee_name,
    p.email as employee_email
  FROM manager_employee_relationships mer
  JOIN profiles p ON p.id = mer.employee_id
  WHERE mer.manager_id = manager_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_chain(employee_profile_id UUID)
RETURNS TABLE(manager_id UUID, manager_name TEXT, level INTEGER)
LANGUAGE SQL
STABLE SECURITY DEFINER  
SET search_path TO 'public'
AS $$
  WITH RECURSIVE manager_hierarchy AS (
    -- Base case: direct manager
    SELECT 
      mer.manager_id,
      p.full_name as manager_name,
      1 as level
    FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.manager_id
    WHERE mer.employee_id = employee_profile_id
    
    UNION ALL
    
    -- Recursive case: manager's manager
    SELECT 
      mer.manager_id,
      p.full_name as manager_name,
      mh.level + 1
    FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.manager_id
    JOIN manager_hierarchy mh ON mh.manager_id = mer.employee_id
    WHERE mh.level < 10 -- Prevent infinite loops
  )
  SELECT * FROM manager_hierarchy ORDER BY level;
$$;

-- PHASE 4: Core business rule validation function
CREATE OR REPLACE FUNCTION public.validate_manager_has_employees(manager_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM manager_employee_relationships 
    WHERE manager_id = manager_profile_id
  );
$$;

-- PHASE 5: Enhanced manager capabilities check
CREATE OR REPLACE FUNCTION public.check_manager_capabilities(profile_id UUID)
RETURNS TABLE(
  is_manager BOOLEAN,
  has_employees BOOLEAN,
  can_access_dashboard BOOLEAN,
  employee_count INTEGER
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    (p.can_manage_teams = true OR EXISTS(
      SELECT 1 FROM manager_employee_relationships mer WHERE mer.manager_id = profile_id
    )) as is_manager,
    public.validate_manager_has_employees(profile_id) as has_employees,
    (public.validate_manager_has_employees(profile_id) AND (
      p.can_manage_teams = true OR EXISTS(
        SELECT 1 FROM manager_employee_relationships mer WHERE mer.manager_id = profile_id
      )
    )) as can_access_dashboard,
    COALESCE((
      SELECT COUNT(*) 
      FROM manager_employee_relationships mer 
      WHERE mer.manager_id = profile_id
    ), 0)::INTEGER as employee_count
  FROM profiles p
  WHERE p.id = profile_id;
$$;

-- PHASE 6: Automatic manager demotion trigger
CREATE OR REPLACE FUNCTION public.handle_manager_demotion()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_still_has_employees BOOLEAN;
BEGIN
  -- Check if the manager still has employees after this change
  SELECT public.validate_manager_has_employees(COALESCE(OLD.manager_id, NEW.manager_id)) 
  INTO manager_still_has_employees;
  
  -- If manager has no employees left, demote them
  IF NOT manager_still_has_employees THEN
    UPDATE public.profiles 
    SET 
      can_manage_teams = false,
      role = 'employee',
      team_name = NULL
    WHERE id = COALESCE(OLD.manager_id, NEW.manager_id);
    
    -- Create notification
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT 
      p.user_id,
      'role_change',
      'Manager Role Removed',
      'You have been automatically demoted from manager as you no longer have any employees.',
      jsonb_build_object(
        'previous_role', 'manager', 
        'new_role', 'employee',
        'reason', 'no_employees'
      )
    FROM public.profiles p
    WHERE p.id = COALESCE(OLD.manager_id, NEW.manager_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- PHASE 7: Create triggers for automatic demotion
CREATE TRIGGER trigger_manager_demotion_on_relationship_change
  AFTER DELETE OR UPDATE ON public.manager_employee_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_manager_demotion();

CREATE TRIGGER trigger_manager_demotion_on_team_member_change  
  AFTER DELETE OR UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_manager_demotion_new();

-- PHASE 8: RLS Policies for hierarchical relationships
CREATE POLICY "Managers can manage their employee relationships"
ON public.manager_employee_relationships
FOR ALL
USING (
  manager_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can view their manager relationships"  
ON public.manager_employee_relationships
FOR SELECT
USING (
  employee_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

-- PHASE 9: Enhanced profile validation trigger
CREATE OR REPLACE FUNCTION public.validate_manager_promotion()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If promoting to manager or enabling can_manage_teams
  IF (NEW.can_manage_teams = true AND OLD.can_manage_teams = false) 
     OR (NEW.role = 'manager' AND OLD.role != 'manager') THEN
    
    -- Check if they actually have employees
    IF NOT public.validate_manager_has_employees(NEW.id) THEN
      RAISE EXCEPTION 'Cannot promote to manager: user has no employees. Add employees first.';
    END IF;
    
    -- Set team name if not set
    IF NEW.team_name IS NULL THEN
      NEW.team_name = COALESCE(NEW.display_name, NEW.full_name, 'Manager') || '''s Team';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_manager_promotion
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_manager_promotion();

-- PHASE 10: Data migration from existing relationships
-- Migrate data from team_members to manager_employee_relationships
INSERT INTO public.manager_employee_relationships (manager_id, employee_id)
SELECT DISTINCT tm.team_id, tm.member_id
FROM public.team_members tm
WHERE tm.role = 'employee' 
  AND tm.team_id != tm.member_id  -- Avoid self-references
ON CONFLICT (manager_id, employee_id) DO NOTHING;

-- Migrate data from sharing_preferences to profiles.manager_id (for direct manager)
UPDATE public.profiles 
SET manager_id = sp.manager_id
FROM public.sharing_preferences sp
WHERE profiles.user_id = sp.user_id 
  AND profiles.manager_id IS NULL
  AND sp.manager_id IS NOT NULL
  AND sp.manager_id != profiles.id; -- Avoid self-references

-- PHASE 11: Fix managers without employees by demoting them
UPDATE public.profiles 
SET 
  can_manage_teams = false,
  role = 'employee', 
  team_name = NULL
WHERE can_manage_teams = true 
  AND NOT public.validate_manager_has_employees(id);

-- Create notifications for demoted managers
INSERT INTO public.notifications (user_id, type, title, message, data)
SELECT 
  p.user_id,
  'role_change',
  'Manager Role Removed - No Employees',
  'You have been automatically demoted from manager as you had no employees. You can be promoted back once you have team members.',
  jsonb_build_object(
    'previous_role', 'manager', 
    'new_role', 'employee',
    'reason', 'no_employees_migration'
  )
FROM public.profiles p
WHERE p.can_manage_teams = false 
  AND p.role = 'employee'
  AND EXISTS (
    SELECT 1 FROM public.notifications n 
    WHERE n.user_id = p.user_id AND n.type = 'role_change'
    AND n.created_at > now() - interval '1 minute'
  );