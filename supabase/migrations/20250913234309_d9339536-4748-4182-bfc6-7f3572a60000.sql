-- Simplify invitation system to work with Supabase's built-in email system
-- Instead of custom email sending, we'll create a simple invitation URL system

-- Add a column to store invitation URLs that can be shared manually
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS invitation_url TEXT;

-- Create a function to generate invitation URLs
CREATE OR REPLACE FUNCTION public.generate_invitation_url(invitation_id uuid)
RETURNS TEXT AS $$
DECLARE
    invitation_record RECORD;
    base_url TEXT;
BEGIN
    -- Get the invitation details
    SELECT * INTO invitation_record 
    FROM public.invitations 
    WHERE id = invitation_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Generate the invitation URL
    base_url := 'https://bmrifufykczudfxomenr.supabase.co/functions/v1/accept-invitation';
    
    RETURN base_url || '?token=' || invitation_record.token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing invitations with their URLs
UPDATE public.invitations 
SET invitation_url = public.generate_invitation_url(id)
WHERE invitation_url IS NULL;