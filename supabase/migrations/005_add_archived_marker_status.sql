-- Add 'archived' to the allowed marker statuses
ALTER TABLE markers DROP CONSTRAINT IF EXISTS markers_status_check;
ALTER TABLE markers ADD CONSTRAINT markers_status_check CHECK (status IN ('open', 'resolved', 'archived'));
