-- Fix the RLS policy for invitations to handle null profile cases
DROP POLICY IF EXISTS "Managers can create invitations" ON public.invitations;

-- Create a more robust policy that handles authentication properly
CREATE POLICY "Authenticated users can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND id = manager_id
  )
);

-- Also fix the select policy to be more robust
DROP POLICY IF EXISTS "Managers can view their own invitations" ON public.invitations;

CREATE POLICY "Users can view their own invitations" 
ON public.invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND id = manager_id
  )
);

-- Fix the update policy as well
DROP POLICY IF EXISTS "Managers can update their own invitations" ON public.invitations;

CREATE POLICY "Users can update their own invitations" 
ON public.invitations 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND id = manager_id
  )
);