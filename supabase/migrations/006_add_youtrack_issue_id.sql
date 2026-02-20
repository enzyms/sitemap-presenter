-- Add youtrack_issue_id column to markers table
ALTER TABLE markers ADD COLUMN IF NOT EXISTS youtrack_issue_id TEXT DEFAULT NULL;
