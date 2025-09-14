-- Fix the RLS policy for invitations table
-- The manager_id field contains profile IDs, not user IDs, so we need to check properly

-- First, create a security definer function to check if current user can create invitations
CREATE OR REPLACE FUNCTION public.can_create_invitation(invitation_manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = invitation_manager_id 
    AND profiles.user_id = auth.uid()
  )
$$;

-- Drop the existing policy that's causing the issue
DROP POLICY IF EXISTS "Authenticated users can create invitations" ON public.invitations;

-- Create a new correct policy using the security definer function
CREATE POLICY "Managers can create invitations for their profile" 
ON public.invitations 
FOR INSERT 
WITH CHECK (public.can_create_invitation(manager_id));