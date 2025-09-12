-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create secure policies that restrict profile access
-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Managers can view profiles of their team members
CREATE POLICY "Managers can view their team profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles manager_profile 
    WHERE manager_profile.user_id = auth.uid() 
    AND manager_profile.id = profiles.manager_id
  )
);