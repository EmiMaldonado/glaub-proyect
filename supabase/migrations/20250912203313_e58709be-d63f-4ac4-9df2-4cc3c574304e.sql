-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION public.generate_reset_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_length integer := 50;
  chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer := 0;
BEGIN
  -- Generate a cryptographically secure random token
  FOR i IN 1..token_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  
  RETURN result;
END;
$$;

-- Add policy to allow service role to manage tokens (needed for edge functions)
CREATE POLICY "Service role can manage password reset tokens" 
ON public.password_reset_tokens 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to validate reset tokens (for edge functions)
CREATE OR REPLACE FUNCTION public.validate_reset_token(token_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Find valid, unused, non-expired token
  SELECT user_id, expires_at, is_used INTO token_record
  FROM password_reset_tokens
  WHERE token = token_input
    AND is_used = false
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN token_record.user_id;
END;
$$;