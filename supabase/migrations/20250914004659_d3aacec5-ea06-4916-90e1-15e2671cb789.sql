-- Add check constraint to ensure only valid status values
ALTER TABLE public.invitations 
ADD CONSTRAINT check_invitation_status 
CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));

-- Add index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON public.invitations(email, status);