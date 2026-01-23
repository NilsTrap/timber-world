-- Migration: Add party_id to portal_users for producer-to-facility linking
-- Story 3.1: Producer Inventory Table

ALTER TABLE portal_users
ADD COLUMN party_id UUID REFERENCES parties(id);

COMMENT ON COLUMN portal_users.party_id IS 'Links producer users to their facility (party). NULL for admin users.';
