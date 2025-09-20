-- Complete migration from team_memberships to team_members and clean up

-- Ensure all data is migrated from team_memberships to team_members
DO $$
DECLARE
    membership_record RECORD;
    employee_id UUID;
    slot_name TEXT;
BEGIN
    -- Migrate all remaining records from team_memberships to team_members
    FOR membership_record IN SELECT * FROM team_memberships LOOP
        -- Add the manager as team leader (if not already there)
        INSERT INTO team_members (team_id, member_id, role) 
        VALUES (membership_record.manager_id, membership_record.manager_id, 'manager')
        ON CONFLICT (team_id, member_id) DO NOTHING;
        
        -- Migrate each employee (employee_1_id to employee_10_id)
        FOR i IN 1..10 LOOP
            slot_name := 'employee_' || i || '_id';
            
            EXECUTE format('SELECT %I FROM team_memberships WHERE id = $1', slot_name) 
            INTO employee_id 
            USING membership_record.id;
            
            IF employee_id IS NOT NULL THEN
                INSERT INTO team_members (team_id, member_id, role) 
                VALUES (membership_record.manager_id, employee_id, 'employee')
                ON CONFLICT (team_id, member_id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Update any profiles that might be missing manager_id relationships
UPDATE profiles 
SET manager_id = tm.team_id
FROM team_members tm
WHERE profiles.id = tm.member_id 
AND tm.role = 'employee' 
AND profiles.manager_id IS NULL;

-- Drop the old team_memberships table as it's no longer needed
DROP TABLE IF EXISTS team_memberships CASCADE;

-- Remove the old trigger that references team_memberships
DROP TRIGGER IF EXISTS check_manager_demotion_trigger ON team_memberships;