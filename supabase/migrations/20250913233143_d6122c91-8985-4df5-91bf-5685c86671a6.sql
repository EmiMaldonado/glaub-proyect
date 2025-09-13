-- Fix infinite recursion in profiles table RLS policies by creating security definer functions
-- and secure password reset tokens, training data, and invitations tables

-- 1. Create security definer function to get current user profile info (fixes infinite recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- 2. Drop and recreate profiles policies to fix infinite recursion
DROP POLICY IF EXISTS "Managers can view their team profiles" ON public.profiles;

-- Recreate the policy using the security definer function
CREATE POLICY "Managers can view their team profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles team_member 
    WHERE team_member.manager_id = public.get_current_user_profile_id()
    AND team_member.id = profiles.id
  )
);

-- 3. Secure password reset tokens - make them only accessible by service role and token owner
DROP POLICY IF EXISTS "Service role can manage password reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can insert their own reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can update their own reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can view their own reset tokens" ON public.password_reset_tokens;

-- Only service role should have full access to password reset tokens
CREATE POLICY "Service role full access to password reset tokens" 
ON public.password_reset_tokens 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Users can only access their own tokens for validation purposes
CREATE POLICY "Users can validate their own reset tokens" 
ON public.password_reset_tokens 
FOR SELECT 
USING (auth.uid() = user_id AND NOT is_used AND expires_at > now());

-- 4. Secure AI training data tables
-- Add RLS to OCEAN_phrases_traingdata
ALTER TABLE public."OCEAN_phrases_traingdata" ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read training data
CREATE POLICY "Authenticated users can read OCEAN training data" 
ON public."OCEAN_phrases_traingdata" 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Add RLS to training data - conversation table
ALTER TABLE public."training data - conversation" ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read conversation training data
CREATE POLICY "Authenticated users can read conversation training data" 
ON public."training data - conversation" 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 5. Secure invitations table - fix the existing policy that's causing issues
-- Drop and recreate invitation policies to be more secure
DROP POLICY IF EXISTS "Managers can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers can update their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers can view only their own invitations" ON public.invitations;

-- Create secure invitation policies using the security definer function
CREATE POLICY "Managers can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (manager_id = public.get_current_user_profile_id());

CREATE POLICY "Managers can update their own invitations" 
ON public.invitations 
FOR UPDATE 
USING (manager_id = public.get_current_user_profile_id());

CREATE POLICY "Managers can view their own invitations" 
ON public.invitations 
FOR SELECT 
USING (manager_id = public.get_current_user_profile_id());

-- 6. Add additional security function for invitation validation
CREATE OR REPLACE FUNCTION public.is_invitation_manager_secure(invitation_manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT invitation_manager_id = public.get_current_user_profile_id()
$$;