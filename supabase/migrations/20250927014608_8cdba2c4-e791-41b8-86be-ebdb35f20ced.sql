-- Check current data in team_members
SELECT DISTINCT role FROM team_members;

-- Drop the existing constraint
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;

-- Create a new constraint that allows the roles being used in the code
ALTER TABLE team_members 
ADD CONSTRAINT team_members_role_check 
CHECK (role IN ('employee', 'manager', 'member', 'leader'));