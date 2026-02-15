-- ============================================================
-- Site Layouts table (shared node positions per site per mode)
-- ============================================================

CREATE TABLE site_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    layout_mode TEXT NOT NULL CHECK (layout_mode IN ('hierarchical', 'radial')),
    positions JSONB NOT NULL DEFAULT '{}',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (site_id, layout_mode)
);

CREATE INDEX idx_site_layouts_site_id ON site_layouts(site_id);

-- Reuse existing trigger function
CREATE TRIGGER update_site_layouts_updated_at
    BEFORE UPDATE ON site_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (public, same pattern as other tables)
ALTER TABLE site_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of site_layouts"
    ON site_layouts FOR SELECT USING (true);

CREATE POLICY "Allow public insert of site_layouts"
    ON site_layouts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update of site_layouts"
    ON site_layouts FOR UPDATE USING (true);

CREATE POLICY "Allow public delete of site_layouts"
    ON site_layouts FOR DELETE USING (true);
