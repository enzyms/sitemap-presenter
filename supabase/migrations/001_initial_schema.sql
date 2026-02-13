-- ============================================================
-- Feedback Widget Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Sites table (one per website with widget installed)
-- ============================================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE DEFAULT ('site_' || replace(uuid_generate_v4()::text, '-', '')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for API key lookups
CREATE INDEX idx_sites_api_key ON sites(api_key);
CREATE INDEX idx_sites_domain ON sites(domain);

-- ============================================================
-- Anonymous users table (for widget users without auth)
-- ============================================================
CREATE TABLE anonymous_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anonymous_users_session ON anonymous_users(session_id);

-- ============================================================
-- Markers table (feedback points on pages)
-- ============================================================
CREATE TABLE markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    author_id UUID REFERENCES anonymous_users(id) ON DELETE SET NULL,

    -- Page info
    page_url TEXT NOT NULL,
    page_path TEXT NOT NULL,
    page_title TEXT,

    -- Sequential number per page for display
    number INTEGER NOT NULL,

    -- Element anchor (how to find the element)
    anchor JSONB NOT NULL,
    -- anchor: { selector, xpath, innerText, tagName, offsetX, offsetY }

    -- Fallback position if element not found
    fallback_position JSONB NOT NULL,
    -- fallback_position: { xPercent, yPercent }

    -- Viewport info when marker was created
    viewport JSONB NOT NULL,
    -- viewport: { width, height, scrollX, scrollY, devicePixelRatio, timestamp }

    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_markers_site_id ON markers(site_id);
CREATE INDEX idx_markers_page_path ON markers(site_id, page_path);
CREATE INDEX idx_markers_status ON markers(site_id, status);
CREATE INDEX idx_markers_created_at ON markers(site_id, created_at DESC);

-- ============================================================
-- Comments table (feedback threads)
-- ============================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marker_id UUID NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
    author_id UUID REFERENCES anonymous_users(id) ON DELETE SET NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_marker_id ON comments(marker_id);
CREATE INDEX idx_comments_created_at ON comments(marker_id, created_at ASC);

-- ============================================================
-- Updated at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markers_updated_at
    BEFORE UPDATE ON markers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Sites policies
-- Sites can be read/written by anyone with the anon key
-- (in production, you'd add auth checks)
-- ============================================================
CREATE POLICY "Allow public read of sites"
    ON sites FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert of sites"
    ON sites FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update of sites"
    ON sites FOR UPDATE
    USING (true);

-- ============================================================
-- Anonymous users policies
-- Anyone can create/read anonymous users
-- ============================================================
CREATE POLICY "Allow public read of anonymous_users"
    ON anonymous_users FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert of anonymous_users"
    ON anonymous_users FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update of anonymous_users"
    ON anonymous_users FOR UPDATE
    USING (true);

-- ============================================================
-- Markers policies
-- Markers are scoped by site - anyone with valid site access can CRUD
-- ============================================================
CREATE POLICY "Allow public read of markers"
    ON markers FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert of markers"
    ON markers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update of markers"
    ON markers FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete of markers"
    ON markers FOR DELETE
    USING (true);

-- ============================================================
-- Comments policies
-- Comments follow marker access
-- ============================================================
CREATE POLICY "Allow public read of comments"
    ON comments FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert of comments"
    ON comments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public delete of comments"
    ON comments FOR DELETE
    USING (true);

-- ============================================================
-- Function to get next marker number for a page
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_marker_number(p_site_id UUID, p_page_path TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(number), 0) + 1
    INTO next_num
    FROM markers
    WHERE site_id = p_site_id AND page_path = p_page_path;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Enable Realtime for markers and comments
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE markers;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
