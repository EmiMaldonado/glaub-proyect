-- Clean up orphaned team_members records that reference non-existent profiles
DELETE FROM team_members 
WHERE team_id NOT IN (SELECT id FROM profiles)
   OR member_id NOT IN (SELECT id FROM profiles);

-- Add foreign key constraints to prevent future orphaned records
ALTER TABLE team_members 
ADD CONSTRAINT fk_team_members_team_id 
FOREIGN KEY (team_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE team_members 
ADD CONSTRAINT fk_team_members_member_id 
FOREIGN KEY (member_id) REFERENCES profiles(id) ON DELETE CASCADE;