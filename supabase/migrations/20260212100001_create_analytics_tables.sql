-- Analytics tables for website tracking
-- Captures Vercel geo/device data and business events

-- Sessions table - one per visitor session
CREATE TABLE analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  -- Geo from Vercel headers
  country_code TEXT,
  city TEXT,
  region TEXT,
  -- Device from User-Agent
  device_type TEXT,    -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  -- Bot detection
  is_bot BOOLEAN DEFAULT FALSE,
  -- Timing
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  -- Context
  locale TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table - all tracked events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,      -- 'page_view', 'product_view', 'filter_click', etc.
  event_category TEXT,           -- 'navigation', 'catalog', 'quote', 'journey'
  properties JSONB DEFAULT '{}', -- Flexible event data
  page_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quote funnel tracking - detailed funnel stages
CREATE TABLE analytics_quote_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  form_viewed BOOLEAN DEFAULT FALSE,
  form_viewed_at TIMESTAMPTZ,
  fields_interacted BOOLEAN DEFAULT FALSE,
  fields_interacted_at TIMESTAMPTZ,
  form_submitted BOOLEAN DEFAULT FALSE,
  form_submitted_at TIMESTAMPTZ,
  submission_success BOOLEAN DEFAULT FALSE,
  submission_success_at TIMESTAMPTZ,
  fields_touched TEXT[],
  selected_product_ids TEXT[],
  time_on_form_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One funnel record per session
  UNIQUE(session_id)
);

-- Indexes for performance
CREATE INDEX idx_analytics_sessions_created_at ON analytics_sessions(created_at DESC);
CREATE INDEX idx_analytics_sessions_country ON analytics_sessions(country_code);
CREATE INDEX idx_analytics_sessions_is_bot ON analytics_sessions(is_bot);

CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_category ON analytics_events(event_category);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_session_name ON analytics_events(session_id, event_name);

CREATE INDEX idx_analytics_quote_funnels_session_id ON analytics_quote_funnels(session_id);

-- RLS Policies
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_quote_funnels ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from tracking endpoint)
CREATE POLICY "Allow anonymous insert on analytics_sessions"
  ON analytics_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on analytics_events"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on analytics_quote_funnels"
  ON analytics_quote_funnels FOR INSERT
  WITH CHECK (true);

-- Allow anonymous updates for session last_seen_at
CREATE POLICY "Allow anonymous update on analytics_sessions"
  ON analytics_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on analytics_quote_funnels"
  ON analytics_quote_funnels FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow authenticated reads (for admin dashboard)
CREATE POLICY "Allow authenticated read on analytics_sessions"
  ON analytics_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on analytics_events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on analytics_quote_funnels"
  ON analytics_quote_funnels FOR SELECT
  TO authenticated
  USING (true);
