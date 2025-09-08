-- Add manager_id to profiles table for manager-employee relationships
ALTER TABLE public.profiles 
ADD COLUMN manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create invitations table for managing team invitations
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invitations table
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Managers can view their own invitations
CREATE POLICY "Managers can view their own invitations"
ON public.invitations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = invitations.manager_id 
  AND profiles.user_id = auth.uid()
));

-- Managers can create invitations
CREATE POLICY "Managers can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = invitations.manager_id 
  AND profiles.user_id = auth.uid()
));

-- Managers can update their own invitations
CREATE POLICY "Managers can update their own invitations"
ON public.invitations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = invitations.manager_id 
  AND profiles.user_id = auth.uid()
));

-- Create trigger for updating timestamps
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster token lookups
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_manager_id ON public.invitations(manager_id);