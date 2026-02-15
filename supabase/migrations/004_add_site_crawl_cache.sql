-- ============================================================
-- Site Crawl Cache table (shared crawl data per site)
-- ============================================================

CREATE TABLE site_crawl_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_site_crawl_cache_site_id ON site_crawl_cache(site_id);

-- Reuse existing trigger function
CREATE TRIGGER update_site_crawl_cache_updated_at
    BEFORE UPDATE ON site_crawl_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (public, same pattern as other tables)
ALTER TABLE site_crawl_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of site_crawl_cache"
    ON site_crawl_cache FOR SELECT USING (true);

CREATE POLICY "Allow public insert of site_crawl_cache"
    ON site_crawl_cache FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update of site_crawl_cache"
    ON site_crawl_cache FOR UPDATE USING (true);

CREATE POLICY "Allow public delete of site_crawl_cache"
    ON site_crawl_cache FOR DELETE USING (true);
