-- Create enum type for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Update the invitations table to use the enum type
ALTER TABLE public.invitations 
ALTER COLUMN status TYPE invitation_status USING status::invitation_status;

-- Update default value to use enum
ALTER TABLE public.invitations 
ALTER COLUMN status SET DEFAULT 'pending'::invitation_status;

-- Add index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON public.invitations(email, status);