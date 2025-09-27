-- Clean up circular manager-employee relationships and conflicting invitations

-- First, let's check current problematic relationships
-- Remove any circular manager-employee relationships
DELETE FROM manager_employee_relationships mer1
WHERE EXISTS (
  SELECT 1 FROM manager_employee_relationships mer2
  WHERE mer1.manager_id = mer2.employee_id 
  AND mer1.employee_id = mer2.manager_id
);

-- Clean up team_members with conflicting roles
DELETE FROM team_members 
WHERE team_id = member_id 
AND role = 'manager'
AND NOT EXISTS (
  SELECT 1 FROM team_members tm2 
  WHERE tm2.team_id = team_members.team_id 
  AND tm2.member_id != team_members.team_id 
  AND tm2.role = 'employee'
);

-- Demote managers who don't actually have team members to employee
UPDATE profiles 
SET role = 'employee', can_manage_teams = false, team_name = NULL
WHERE role = 'manager' 
AND NOT EXISTS (
  SELECT 1 FROM manager_employee_relationships mer 
  WHERE mer.manager_id = profiles.id
);

-- Cancel conflicting pending invitations between users who already have relationships
UPDATE invitations 
SET status = 'cancelled'
WHERE status = 'pending' 
AND invitation_type = 'manager_request'
AND EXISTS (
  SELECT 1 FROM manager_employee_relationships mer
  WHERE (mer.manager_id = invitations.manager_id AND mer.employee_id IN (
    SELECT p.id FROM profiles p WHERE p.email = invitations.email
  )) OR (mer.employee_id = invitations.manager_id AND mer.manager_id IN (
    SELECT p.id FROM profiles p WHERE p.email = invitations.email
  ))
);

-- Update validation function to prevent managers from sending manager_request
CREATE OR REPLACE FUNCTION public.can_send_manager_request(requester_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    -- User is already a manager
    SELECT 1 FROM profiles 
    WHERE id = requester_profile_id 
    AND (role = 'manager' OR can_manage_teams = true)
  ) AND NOT EXISTS (
    -- User already has a manager
    SELECT 1 FROM manager_employee_relationships 
    WHERE employee_id = requester_profile_id
  );
$$;

-- Create function to prevent circular relationships
CREATE OR REPLACE FUNCTION public.would_create_circular_relationship(potential_manager_email text, requester_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if the potential manager is already managed by the requester
    SELECT 1 FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.employee_id
    WHERE mer.manager_id = requester_profile_id
    AND p.email = potential_manager_email
  );
$$;