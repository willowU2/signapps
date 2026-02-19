-- Migration 012: Notification System Schema
-- Adds support for email, SMS, and push notifications with user preferences

-- Notification preferences per user and per calendar
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES calendar.calendars(id) ON DELETE CASCADE,

  -- Email settings
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_frequency VARCHAR(20) NOT NULL DEFAULT 'instant'
    CHECK (email_frequency IN ('instant', 'digest', 'disabled')),

  -- SMS settings
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number VARCHAR(20),  -- E.164 format: +1234567890

  -- Push notification settings
  push_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Quiet hours (don't send between these times)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_start TIME,
  quiet_end TIME,

  -- Reminder times (in minutes before event)
  -- Default: 15 min, 1 hour, 1 day
  reminder_times INT[] NOT NULL DEFAULT '{15,60,1440}'::INT[],

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(user_id, calendar_id),
  CHECK (
    calendar_id IS NULL  -- System-wide preferences
    OR calendar_id IS NOT NULL  -- Or per-calendar
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_calendar_id
  ON notification_preferences(calendar_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_calendar
  ON notification_preferences(user_id, calendar_id);

-- Web Push API subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,

  -- Web Push API subscription object
  subscription_json JSONB NOT NULL,
  -- Structure: {
  --   "endpoint": "https://fcm.googleapis.com/...",
  --   "expirationTime": null,
  --   "keys": {
  --     "p256dh": "...",
  --     "auth": "..."
  --   }
  -- }

  -- Browser info
  user_agent VARCHAR(500),
  browser_name VARCHAR(50),  -- Chrome, Firefox, Safari, Edge
  browser_version VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraint
  UNIQUE(user_id, subscription_json)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

-- Sent notifications audit log
CREATE TABLE IF NOT EXISTS notifications_sent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
  task_id UUID REFERENCES calendar.tasks(id) ON DELETE SET NULL,

  -- Notification details
  notification_type VARCHAR(50) NOT NULL
    CHECK (notification_type IN (
      'event_reminder',
      'event_invitation',
      'attendee_rsvp',
      'task_assigned',
      'task_completed',
      'daily_digest',
      'weekly_digest'
    )),

  -- Channel
  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('email', 'sms', 'push')),

  recipient_address VARCHAR(255),  -- email or phone

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',      -- queued, not yet sent
      'sent',         -- sent successfully
      'delivered',    -- confirmed delivery (push)
      'read',         -- user opened (push/email with pixel)
      'failed',       -- delivery failed
      'bounced',      -- hard bounce (email)
      'unsubscribed'  -- user unsubscribed
    )),

  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Tracking
  external_id VARCHAR(255),  -- Email message ID, Twilio SID, etc
  retry_count INT NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB,  -- Any additional data (template variables, etc)

  -- Constraints & Indexes
  CONSTRAINT notification_must_have_event_or_task
    CHECK ((event_id IS NOT NULL) OR (task_id IS NOT NULL) OR (notification_type LIKE '%digest%'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_sent_user_id
  ON notifications_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_event_id
  ON notifications_sent(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_task_id
  ON notifications_sent(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_status
  ON notifications_sent(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_channel
  ON notifications_sent(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_type
  ON notifications_sent(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_created_at
  ON notifications_sent(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_user_created
  ON notifications_sent(user_id, created_at DESC);

-- Notification templates (for email rendering)
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  notification_type VARCHAR(50) NOT NULL
    CHECK (notification_type IN (
      'event_reminder',
      'event_invitation',
      'attendee_rsvp',
      'task_assigned',
      'task_completed',
      'daily_digest',
      'weekly_digest'
    )),

  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('email', 'sms', 'push')),

  -- Template content
  subject TEXT,  -- Email subject line
  template_html TEXT,  -- HTML body (minijinja syntax)
  template_text TEXT,  -- Plain text body (fallback)

  -- Variable documentation
  variables JSONB,  -- {event_title, event_time, attendee_name, ...}

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(notification_type, channel)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_channel
  ON notification_templates(notification_type, channel);

-- Notification digest batches (for digest emails)
CREATE TABLE IF NOT EXISTS notification_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,

  -- Digest period
  digest_type VARCHAR(20) NOT NULL
    CHECK (digest_type IN ('daily', 'weekly')),

  scheduled_for TIMESTAMPTZ NOT NULL,  -- When digest should be sent
  sent_at TIMESTAMPTZ,  -- When it was actually sent

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),

  -- Content
  notification_count INT NOT NULL DEFAULT 0,
  content JSONB,  -- Array of notification summaries

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_digests_user_id
  ON notification_digests(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_digests_scheduled_for
  ON notification_digests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_digests_status
  ON notification_digests(status);

-- Enable soft-deletes or use partitioning for old records?
-- For now, keep all records for audit log purposes
-- Archive old records with a separate job monthly

-- Insert default templates
INSERT INTO notification_templates (id, name, notification_type, channel, subject, template_html, variables, is_active)
VALUES
  (
    uuid_generate_v4(),
    'Event Reminder - Email',
    'event_reminder',
    'email',
    'Reminder: {{ event_title }} at {{ event_time }}',
    '<html><body><h2>{{ event_title }}</h2><p><strong>When:</strong> {{ event_time }}<br><strong>Where:</strong> {{ event_location }}</p><a href="{{ event_link }}">View Event</a></body></html>',
    '{"event_title": "Meeting Title", "event_time": "10:00 AM", "event_location": "Room 123", "event_link": "https://..."}'::JSONB,
    true
  ),
  (
    uuid_generate_v4(),
    'Event Reminder - SMS',
    'event_reminder',
    'sms',
    NULL,
    NULL,
    '{"event_title": "Meeting", "event_time": "10:00 AM"}'::JSONB,
    true
  ),
  (
    uuid_generate_v4(),
    'Daily Digest - Email',
    'daily_digest',
    'email',
    'Your calendar digest for {{ date }}',
    '<html><body><h2>Your Calendar Digest</h2><p>{{ event_count }} events today</p>{{ events_html }}</body></html>',
    '{"date": "Feb 20, 2026", "event_count": 5, "events_html": "..."}'::JSONB,
    true
  );

-- Index on events start_time for notification scheduling
CREATE INDEX IF NOT EXISTS idx_events_start_time
  ON calendar.events(start_time);

-- Comment on tables
COMMENT ON TABLE notification_preferences IS 'User notification settings for email, SMS, and push channels';
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscriptions for browser notifications';
COMMENT ON TABLE notifications_sent IS 'Audit log of all sent notifications with delivery status';
COMMENT ON TABLE notification_templates IS 'Email/SMS/Push templates with minijinja syntax';
COMMENT ON TABLE notification_digests IS 'Queued digest notifications (daily/weekly summaries)';

-- Update sequence (for migration tracking)
-- Assumes migration system tracks this
