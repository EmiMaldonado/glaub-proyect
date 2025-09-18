-- Paso 1.1: Crear nueva tabla team_members escalable (relación 1-a-muchos)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL, -- ID del team (será el profile.id del manager)
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint único para evitar duplicados
  UNIQUE(team_id, member_id)
);

-- Índices para optimización
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_member_id ON public.team_members(member_id);

-- RLS para team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para team_members
CREATE POLICY "Managers can manage their team members" 
ON public.team_members 
FOR ALL 
USING (
  team_id IN (
    SELECT p.id FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'manager'
  )
);

CREATE POLICY "Team members can view their own memberships" 
ON public.team_members 
FOR SELECT 
USING (
  member_id IN (
    SELECT p.id FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  )
);

-- Paso 1.2: Función para migrar datos de team_memberships a team_members
CREATE OR REPLACE FUNCTION migrate_team_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_record RECORD;
  employee_id UUID;
  slot_name TEXT;
BEGIN
  -- Migrar todos los registros existentes de team_memberships
  FOR membership_record IN SELECT * FROM team_memberships LOOP
    -- Agregar el manager como líder del equipo
    INSERT INTO team_members (team_id, member_id, role) 
    VALUES (membership_record.manager_id, membership_record.manager_id, 'manager')
    ON CONFLICT (team_id, member_id) DO NOTHING;
    
    -- Migrar cada empleado (employee_1_id a employee_10_id)
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
END;
$$;

-- Ejecutar la migración
SELECT migrate_team_memberships();

-- Paso 1.3: Constraints para límites del sistema
-- Función para validar límites de equipos
CREATE OR REPLACE FUNCTION validate_team_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  team_member_count INTEGER;
  user_team_count INTEGER;
BEGIN
  -- Validar máximo 10 miembros por equipo
  SELECT COUNT(*) INTO team_member_count
  FROM team_members 
  WHERE team_id = NEW.team_id;
  
  IF team_member_count >= 10 THEN
    RAISE EXCEPTION 'Team cannot have more than 10 members';
  END IF;
  
  -- Validar máximo 3 equipos por empleado (solo para employees, no managers)
  IF NEW.role = 'employee' THEN
    SELECT COUNT(*) INTO user_team_count
    FROM team_members 
    WHERE member_id = NEW.member_id AND role = 'employee';
    
    IF user_team_count >= 3 THEN
      RAISE EXCEPTION 'User cannot belong to more than 3 teams';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para validar límites en INSERT
CREATE TRIGGER validate_team_limits_trigger
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_team_limits();

-- Paso 1.4: Función mejorada para auto-demotion de managers
CREATE OR REPLACE FUNCTION check_manager_demotion_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_members INTEGER;
BEGIN
  -- Contar miembros restantes del equipo (excluyendo al manager mismo)
  SELECT COUNT(*) INTO remaining_members
  FROM team_members 
  WHERE team_id = OLD.team_id AND member_id != OLD.team_id AND role = 'employee';
  
  -- Si no quedan empleados, demover al manager
  IF remaining_members = 0 THEN
    -- Remover al manager del equipo también
    DELETE FROM team_members 
    WHERE team_id = OLD.team_id AND member_id = OLD.team_id;
    
    -- Cambiar rol del manager a employee y limpiar team_name
    UPDATE profiles 
    SET role = 'employee', team_name = NULL
    WHERE id = OLD.team_id;
    
    -- Crear notificación
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT 
      p.user_id,
      'role_change',
      'Role Changed to Employee',
      'You have been automatically changed from manager to employee as you no longer have any team members.',
      '{"previous_role": "manager", "new_role": "employee"}'::jsonb
    FROM profiles p
    WHERE p.id = OLD.team_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger para auto-demotion en DELETE
CREATE TRIGGER check_manager_demotion_new_trigger
  AFTER DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_manager_demotion_new();

-- Paso 1.5: Trigger para timestamps
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices para invitations (optimización)
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON invitations(email, status);