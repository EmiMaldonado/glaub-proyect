-- Insert sharing preferences for team members to allow manager access to their data
INSERT INTO public.sharing_preferences (
  user_id, 
  manager_id,
  share_profile,
  share_conversations,
  share_insights,
  share_ocean_profile,
  share_progress,
  share_strengths,
  share_manager_recommendations
) VALUES 
-- For user f21fc777-21da-46b7-b9f7-795588e07bb0 (Test)
('f21fc777-21da-46b7-b9f7-795588e07bb0', '42dc90c4-bc73-4cd5-bddc-46dea219c9cd', true, true, true, true, true, true, true),
-- For user 85a4d707-ab26-4821-93c4-ff47230322ab (Test 1) 
('85a4d707-ab26-4821-93c4-ff47230322ab', '42dc90c4-bc73-4cd5-bddc-46dea219c9cd', true, true, true, true, true, true, true)
ON CONFLICT (user_id, manager_id) DO UPDATE SET
  share_conversations = true,
  share_ocean_profile = true,
  share_insights = true;