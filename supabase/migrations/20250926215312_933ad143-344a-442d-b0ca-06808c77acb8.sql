-- FASE 1: Restaurar perfil de manager de Emilia
UPDATE profiles 
SET 
  role = 'manager',
  team_name = 'Emilia''s Team',
  updated_at = now()
WHERE email = 'mariaemiliamaldonadopaez@gmail.com' AND can_manage_teams = true;

-- Verificar también cualquier otro usuario con can_manage_teams pero sin role
UPDATE profiles 
SET 
  role = 'manager',
  team_name = COALESCE(display_name, full_name, 'Manager') || '''s Team',
  updated_at = now()
WHERE can_manage_teams = true AND role IS NULL;