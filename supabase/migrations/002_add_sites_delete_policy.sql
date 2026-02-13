-- Add missing DELETE policy for sites table
CREATE POLICY "Allow public delete of sites"
    ON sites FOR DELETE
    USING (true);

-- Also add missing DELETE policy for anonymous_users
CREATE POLICY "Allow public delete of anonymous_users"
    ON anonymous_users FOR DELETE
    USING (true);
