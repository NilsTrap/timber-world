-- Nilitto Projects: a buyer's inherited company role includes the ability to
-- create its own projects and manage original files on those visible deals.
-- Manufacturers remain read-only unless a later, explicit workflow grants a
-- separate write capability.

INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT id, 'action', 'deal', 'create', '{}'::jsonb
FROM public.access_groups
WHERE key = 'client'
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
