-- Fix infinite recursion in profiles RLS policies

-- 1. Drop all existing problematic policies on profiles table
DROP POLICY IF EXISTS "Managers can view shared profiles from team members" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- 2. Create security definer functions to avoid recursion
-- These functions run with elevated privileges and bypass RLS

CREATE OR REPLACE FUNCTION public.get_user_profile_by_user_id(target_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, role text, manager_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.role, p.manager_id
  FROM public.profiles p
  WHERE p.user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_user_manager_of_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles manager_profile
    JOIN public.profiles target_profile ON target_profile.manager_id = manager_profile.id
    WHERE manager_profile.user_id = auth.uid()
    AND target_profile.user_id = profile_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_user_view_shared_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sharing_preferences sp
    JOIN public.profiles manager_profile ON manager_profile.id = sp.manager_id
    WHERE sp.user_id = profile_user_id
    AND manager_profile.user_id = auth.uid()
    AND sp.share_profile = true
  );
$$;

-- 3. Create new non-recursive RLS policies

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow managers to view their direct team members
CREATE POLICY "Managers can view team member profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_user_manager_of_profile(user_id));

-- Allow managers to view shared profiles from team members
CREATE POLICY "Managers can view shared profiles" 
ON public.profiles 
FOR SELECT 
USING (public.can_user_view_shared_profile(user_id));

-- Service role can manage all profiles (for system operations)
CREATE POLICY "Service role full access" 
ON public.profiles 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. Create function to safely check onboarding status
CREATE OR REPLACE FUNCTION public.get_user_onboarding_status(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(onboarding_completed, false)
  FROM public.profiles
  WHERE user_id = target_user_id;
$$;

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_profile_by_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_manager_of_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_view_shared_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_onboarding_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_onboarding_status(uuid) TO service_role;