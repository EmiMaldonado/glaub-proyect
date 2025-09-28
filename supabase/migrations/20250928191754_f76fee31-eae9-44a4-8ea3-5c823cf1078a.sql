-- Drop the problematic RLS policy causing infinite recursion
DROP POLICY IF EXISTS "Employees can view their manager profile" ON public.profiles;

-- Create a security definer function to safely check if a user can view a manager profile
CREATE OR REPLACE FUNCTION public.can_view_manager_profile(manager_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM manager_employee_relationships mer
    JOIN profiles emp_profile ON emp_profile.id = mer.employee_id
    WHERE mer.manager_id = manager_profile_id
    AND emp_profile.user_id = auth.uid()
  );
$$;

-- Create a new RLS policy using the security definer function
CREATE POLICY "Employees can view their manager profile safely" 
ON public.profiles 
FOR SELECT 
USING (public.can_view_manager_profile(id));