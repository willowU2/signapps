-- Gamification schema: XP tracking, badges, streaks
CREATE SCHEMA IF NOT EXISTS gamification;

CREATE TABLE gamification.user_xp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE gamification.xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    xp_amount INTEGER NOT NULL,
    source_module VARCHAR(50),
    source_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_xp_events_user ON gamification.xp_events(user_id);

CREATE TABLE gamification.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    badge_type VARCHAR(50) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_badges_user ON gamification.badges(user_id);
