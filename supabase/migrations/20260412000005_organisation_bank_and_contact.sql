-- Add contact fields to organisations
ALTER TABLE organisations ADD COLUMN phone TEXT;
ALTER TABLE organisations ADD COLUMN email TEXT;
ALTER TABLE organisations ADD COLUMN website TEXT;

-- Add bank detail fields to organisations
ALTER TABLE organisations ADD COLUMN bank_name TEXT;
ALTER TABLE organisations ADD COLUMN bank_account_number TEXT;
ALTER TABLE organisations ADD COLUMN bank_swift_code TEXT;
