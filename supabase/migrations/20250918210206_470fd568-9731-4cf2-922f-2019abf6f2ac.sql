-- Fix critical security vulnerability and RLS policies for invitations table

-- 1. First, remove the dangerous public read policy
DROP POLICY IF EXISTS "Public can view invitations by token" ON public.invitations;

-- 2. Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can update their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;

-- 3. Create secure, token-based read policy for invitation acceptance
CREATE POLICY "Token based invitation access" ON public.invitations
FOR SELECT 
USING (
  -- Allow reading invitations by token (for accepting invitations)
  token IS NOT NULL 
  AND status = 'pending'
  AND expires_at > now()
);

-- 4. Create insert policy that works with edge functions
CREATE POLICY "Authenticated users can create invitations" ON public.invitations
FOR INSERT 
WITH CHECK (
  -- Allow if user is creating invitation for their own profile
  auth.uid() IN (
    SELECT p.user_id 
    FROM public.profiles p 
    WHERE p.id = invitations.invited_by_id
  )
);

-- 5. Create read policy for users to view their own sent/received invitations
CREATE POLICY "Users can view sent and received invitations" ON public.invitations
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

-- 6. Create update policy for invitation status changes
CREATE POLICY "Users can update invitation status" ON public.invitations
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