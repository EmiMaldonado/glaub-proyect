-- Phase 1: Fix team management data inconsistencies and unify to team_members table

-- First, ensure team_members table has proper constraints and indexes
ALTER TABLE team_members ADD CONSTRAINT unique_team_member UNIQUE (team_id, member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);

-- Migrate existing team_memberships data to team_members table
INSERT INTO team_members (team_id, member_id, role, joined_at)
SELECT DISTINCT 
  tm.manager_id as team_id,
  tm.manager_id as member_id,
  'manager' as role,
  tm.created_at as joined_at
FROM team_memberships tm
WHERE NOT EXISTS (
  SELECT 1 FROM team_members t 
  WHERE t.team_id = tm.manager_id AND t.member_id = tm.manager_id
);

-- Migrate all employee slots from team_memberships to team_members
INSERT INTO team_members (team_id, member_id, role, joined_at)
SELECT DISTINCT
  tm.manager_id as team_id,
  employee_id as member_id,
  'employee' as role,
  tm.created_at as joined_at
FROM team_memberships tm
CROSS JOIN LATERAL (
  VALUES 
    (tm.employee_1_id), (tm.employee_2_id), (tm.employee_3_id), (tm.employee_4_id), (tm.employee_5_id),
    (tm.employee_6_id), (tm.employee_7_id), (tm.employee_8_id), (tm.employee_9_id), (tm.employee_10_id)
) AS employees(employee_id)
WHERE employee_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM team_members t 
  WHERE t.team_id = tm.manager_id AND t.member_id = employee_id
);

-- Update profiles.manager_id based on team_members relationships
UPDATE profiles
SET manager_id = tm.team_id
FROM team_members tm
WHERE profiles.id = tm.member_id 
AND tm.role = 'employee'
AND (profiles.manager_id IS NULL OR profiles.manager_id != tm.team_id);

-- Fix sharing_preferences to use correct user_id instead of profile_id
-- First, let's update the existing sharing preferences with correct user_ids
UPDATE sharing_preferences
SET user_id = p.user_id
FROM profiles p
WHERE sharing_preferences.user_id = p.id
AND p.user_id != sharing_preferences.user_id;

-- Update manager_id in sharing_preferences to use correct profile_id
UPDATE sharing_preferences sp
SET manager_id = p.id
FROM profiles p
JOIN team_members tm ON tm.team_id = p.id
WHERE sp.user_id IN (
  SELECT p2.user_id 
  FROM profiles p2 
  WHERE p2.id = tm.member_id
)
AND tm.role = 'employee'
AND sp.manager_id != p.id;