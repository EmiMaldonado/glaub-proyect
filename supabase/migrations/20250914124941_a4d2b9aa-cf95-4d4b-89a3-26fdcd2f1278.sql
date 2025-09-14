-- Add performance indexes for invitations
CREATE INDEX IF NOT EXISTS idx_invitations_token_status ON public.invitations(token, status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_memberships_employee_manager ON public.team_memberships(employee_id, manager_id);

-- Update the invitations status check constraint to allow 'declined' status
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check 
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));