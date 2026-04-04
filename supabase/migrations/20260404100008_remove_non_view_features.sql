-- Remove all non-.view features (actions not yet enforced)
DELETE FROM features WHERE code NOT LIKE '%.view';
