-- Fix pending manager invitation for mariaemiliamaldonadopaez@gmail.com
-- Complete the invitation acceptance process and promote to manager role

-- Update the invitation status to accepted
UPDATE public.invitations 
SET status = 'accepted', accepted_at = now() 
WHERE email = 'mariaemiliamaldonadopaez@gmail.com' 
AND status = 'pending';

-- Update the user role to manager
UPDATE public.profiles 
SET role = 'manager' 
WHERE user_id = 'd1b39393-e837-49ab-9cc4-2628c99482cd';

-- Log the changes
SELECT 
    'Invitation completed for ' || email as message,
    status,
    accepted_at
FROM public.invitations 
WHERE email = 'mariaemiliamaldonadopaez@gmail.com';

SELECT 
    'Role updated for ' || full_name as message,
    role
FROM public.profiles 
WHERE user_id = 'd1b39393-e837-49ab-9cc4-2628c99482cd';