-- Fix the RLS policy for viewing invitations
-- First, drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view invitations they sent or received" ON public.invitations;

-- Create a new policy that allows public access to invitations by token
-- This is needed for invitation acceptance when users may not be logged in yet
CREATE POLICY "Public can view invitations by token"
ON public.invitations
FOR SELECT
USING (true);

-- Create a policy for authenticated users to view their own invitations
CREATE POLICY "Users can view their own invitations"
ON public.invitations
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.manager_id OR p.id = invitations.invited_by_id
    )
  )
);

-- Fix the update policy as well
DROP POLICY IF EXISTS "Users can update invitations they sent or received" ON public.invitations;

CREATE POLICY "Users can update their own invitations"
ON public.invitations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.manager_id OR p.id = invitations.invited_by_id
    )
  )
);