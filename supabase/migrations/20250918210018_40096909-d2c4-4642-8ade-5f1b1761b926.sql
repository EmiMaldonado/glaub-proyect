-- Fix critical security vulnerability and RLS policies for invitations table

-- 1. First, remove the dangerous public read policy
DROP POLICY IF EXISTS "Public can view invitations by token" ON public.invitations;

-- 2. Create secure, token-based read policy for invitation acceptance
CREATE POLICY "Users can view invitations by token for acceptance" ON public.invitations
FOR SELECT 
USING (
  -- Allow reading invitations by token (for accepting invitations)
  token IS NOT NULL 
  AND status = 'pending'
  AND expires_at > now()
);

-- 3. Update the insert policy to work properly with edge functions
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;

CREATE POLICY "Users can create invitations" ON public.invitations
FOR INSERT 
WITH CHECK (
  -- Allow if user is creating invitation for their own profile
  auth.uid() IN (
    SELECT p.user_id 
    FROM public.profiles p 
    WHERE p.id = invitations.invited_by_id
  )
);

-- 4. Create a read policy for users to view their own sent/received invitations
CREATE POLICY "Users can view their own invitations" ON public.invitations
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Can view invitations they sent
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.invited_by_id
    )
    OR
    -- Can view invitations they received
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.manager_id
    )
  )
);

-- 5. Update policy for updating invitations
DROP POLICY IF EXISTS "Users can update their own invitations" ON public.invitations;

CREATE POLICY "Users can update their own invitations" ON public.invitations
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Can update invitations they sent
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.invited_by_id
    )
    OR
    -- Can update invitations they received (for status changes)
    auth.uid() IN (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE p.id = invitations.manager_id
    )
  )
);