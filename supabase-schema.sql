-- ══════════════════════════════════════════
--  拉花日记本 Cloud — Supabase Schema
-- ══════════════════════════════════════════

-- 1. Notebooks table
CREATE TABLE notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '拉花日记',
  emoji TEXT NOT NULL DEFAULT '☕',
  share_code TEXT NOT NULL UNIQUE,
  password_hash TEXT,  -- NULL = no password
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notebooks_share_code ON notebooks(share_code);

-- 2. Entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  photos TEXT[] DEFAULT '{}',  -- array of storage URLs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entries_notebook ON entries(notebook_id, date DESC);

-- 3. Enable Row Level Security
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — allow all via service_role (API routes handle auth)
--    For anon access (client-side), we use permissive policies
--    since auth is handled at the application level via password/cookie

CREATE POLICY "Allow all on notebooks" ON notebooks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on entries" ON entries
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Storage bucket for photos (run in Supabase Dashboard > Storage)
-- Create a bucket named "photos" with public access:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
