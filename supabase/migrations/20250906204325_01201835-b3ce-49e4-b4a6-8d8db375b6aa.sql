-- Add a function to clear conversation messages
CREATE OR REPLACE FUNCTION clear_conversation_messages(conversation_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Delete all messages for the conversation
  DELETE FROM public.messages WHERE conversation_id = conversation_uuid;
  
  -- Reset conversation insights
  UPDATE public.conversations 
  SET insights = NULL, 
      ocean_signals = NULL,
      updated_at = now()
  WHERE id = conversation_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;