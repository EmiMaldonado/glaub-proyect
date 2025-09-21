-- Fix invitation system security vulnerability
-- Remove the overly permissive token-based access policy
DROP POLICY IF EXISTS "Token based invitation access" ON public.invitations;

-- Create a secure function to validate invitation tokens
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token text)
RETURNS TABLE(
  id uuid,
  email text,
  status text,
  invitation_type text,
  manager_id uuid,
  invited_by_id uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id,
    i.email,
    i.status,
    i.invitation_type,
    i.manager_id,
    i.invited_by_id,
    i.expires_at,
    i.created_at
  FROM public.invitations i
  WHERE i.token = invitation_token
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
$$;

-- Create a more restricted RLS policy that only allows service role access
CREATE POLICY "Service role can access invitations" ON public.invitations
FOR ALL USING (auth.role() = 'service_role'::text);

-- Create a policy for users to access invitations through the secure function only
CREATE POLICY "Users can validate invitation tokens through function" ON public.invitations
FOR SELECT USING (false); -- This effectively blocks direct SELECT access for regular users

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;