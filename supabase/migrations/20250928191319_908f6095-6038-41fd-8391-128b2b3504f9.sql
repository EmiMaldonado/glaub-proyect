-- Allow employees to view their manager's basic profile information
CREATE POLICY "Employees can view their manager profile" 
ON public.profiles 
FOR SELECT 
USING (
  -- User is viewing their direct manager's profile
  id IN (
    SELECT mer.manager_id 
    FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.employee_id
    WHERE p.user_id = auth.uid()
  )
);