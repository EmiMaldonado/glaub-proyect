-- Drop existing policies for invitations table to recreate them more securely
DROP POLICY IF EXISTS "Managers can view their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers can update their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers can create invitations" ON public.invitations;

-- Create a security definer function to check if user is the manager
CREATE OR REPLACE FUNCTION public.is_invitation_manager(invitation_manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = invitation_manager_id 
    AND profiles.user_id = auth.uid()
  )
$$;

-- Recreate secure policies using the security definer function
-- Policy 1: Only managers can view their own invitations (including emails)
CREATE POLICY "Managers can view only their own invitations" 
ON public.invitations 
FOR SELECT 
USING (public.is_invitation_manager(manager_id));

-- Policy 2: Only managers can create invitations
CREATE POLICY "Managers can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (public.is_invitation_manager(manager_id));

-- Policy 3: Only managers can update their own invitations
CREATE POLICY "Managers can update their own invitations" 
ON public.invitations 
FOR UPDATE 
USING (public.is_invitation_manager(manager_id));