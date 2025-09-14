-- Fix the redundant logic in the RLS policy for profiles
-- The correct logic should be:
-- 1. Users can see their own profile (auth.uid() = user_id)
-- 2. Managers can see profiles where they are the manager (auth.uid() = profiles.manager_id)

DROP POLICY IF EXISTS "Managers can view their team profiles" ON public.profiles;

CREATE POLICY "Managers can view their team profiles" ON public.profiles 
FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = profiles.manager_id
);