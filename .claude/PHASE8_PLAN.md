# Phase 8: Advanced Notifications
## 📧 Email, SMS, Push Notifications Implementation Plan

**Timeline**: 2 weeks (following Phase 7)
**Status**: Planning
**Technology**: SMTP + Twilio + Web Push API + Tokio background jobs

---

## 📋 Objectives

1. **Email Notifications**
   - Event reminders (15 min, 1h, 1d before)
   - Attendee invitations & RSVP digest
   - Daily/weekly calendar digest
   - Task completion notifications

2. **SMS Notifications** (Twilio)
   - Critical event reminders (high-priority events)
   - Attendee responses (someone accepted/declined)
   - Optional for users who opt-in

3. **Push Notifications** (Web Push API)
   - Real-time event alerts in browser
   - Task assignments
   - Attendee status updates
   - Test both Chrome and Firefox

4. **User Preferences**
   - Notification channels (email, SMS, push)
   - Frequency (instant, digest, weekly)
   - Quiet hours (don't disturb)
   - Per-calendar notification settings

5. **Notification History**
   - Audit log of sent notifications
   - Delivery status tracking
   - User read receipts (for push)
   - Used for analytics and troubleshooting

---

## 🎯 Success Criteria

✅ **Email Notifications**
- Send reminder 15 min before event start
- Include event details (title, time, attendees, location)
- HTML template with CSS styling
- Unsubscribe link present
- Delivery verified (bounce handling)

✅ **SMS Notifications**
- Send SMS to opted-in users
- Character limit respected (160 chars)
- Format: "Calendar: [Event] at [Time] - [Link]"
- Twilio integration tested
- Cost: Track usage for billing

✅ **Push Notifications**
- Register service worker for push
- Permission request UX
- Show notification in browser
- Click → navigate to event detail
- Badge update on unread count

✅ **User Preferences**
- Settings page with checkboxes
- Per-calendar granularity
- Test: Disable email, enable SMS
- Test: Mute calendar for 24 hours

✅ **Notification History**
- View sent notifications
- Filter by type (email, SMS, push)
- Filter by status (pending, sent, failed, bounced)
- Resend capability for failed

✅ **Testing**
- Unit: Template rendering, scheduler logic
- Integration: Real SMTP/Twilio (test mode)
- E2E: Send notification → User receives → Verifies
- Load: 100 users, 10 events/day = 1000 notifications

---

## 📊 Database Schema (Migration 012_notifications)

```sql
-- Notification preferences per user
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,

  -- Channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,

  -- Frequency
  email_frequency TEXT CHECK (email_frequency IN ('instant', 'digest', 'disabled')),
  -- instant: each event reminder
  -- digest: daily email at 8am with all reminders
  -- disabled: no emails

  -- Quiet hours (don't notify between these times)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_start TIME,                         -- e.g. 22:00 (10 PM)
  quiet_end TIME,                           -- e.g. 08:00 (8 AM)

  -- SMS
  phone_number TEXT,                        -- E.164 format: +1234567890

  -- Reminders
  reminder_times INT[] DEFAULT '{15,60,1440}',  -- minutes before (15m, 1h, 1d)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, calendar_id),
  INDEX(user_id),
  INDEX(calendar_id)
);

-- Notification subscriptions for push
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,  -- Web Push API subscription
  -- Contains: {endpoint, keys: {p256dh, auth}}

  user_agent TEXT,
  browser_name TEXT,                 -- Chrome, Firefox, Safari
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX(user_id)
);

-- Sent notifications audit log
CREATE TABLE notifications_sent (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Type
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'event_reminder',
    'event_invitation',
    'attendee_rsvp',
    'task_assigned',
    'task_completed',
    'daily_digest',
    'weekly_digest'
  )),

  -- Channel
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  recipient_address TEXT,            -- email or phone number

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- queued
    'sent',         -- successfully sent
    'delivered',    -- confirmed delivery (push only)
    'read',         -- user opened (push/email)
    'failed',       -- delivery failed
    'bounced'       -- hard bounce (email)
  )),

  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,

  INDEX(user_id),
  INDEX(event_id),
  INDEX(task_id),
  INDEX(status),
  INDEX(channel)
);

-- Notification templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,                      -- email subject
  template_html TEXT,                -- HTML body
  template_text TEXT,                -- plain text body
  variables JSON,                    -- {event_title, event_time, attendee_name, ...}

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(notification_type, channel)
);
```

---

## 🔧 Backend Implementation (signapps-calendar)

### New Modules

**`services/signapps-calendar/src/services/notifications/mod.rs`**
```
├─ scheduler.rs      - Background job runner (Tokio)
├─ email.rs          - SMTP integration (lettre)
├─ sms.rs            - Twilio integration
├─ push.rs           - Web Push API
├─ preferences.rs    - User notification settings
├─ templates.rs      - Template rendering
└─ audit.rs          - Logging notifications
```

### Services Detail

**1. Notification Scheduler** (`scheduler.rs`, 150 lines)
```rust
pub struct NotificationScheduler {
  pool: PgPool,
  smtp_config: SmtpConfig,
  twilio_config: TwilioConfig,
  webpush_vapid: VapidKey,
}

impl NotificationScheduler {
  // Check for upcoming events every minute
  pub async fn run_scheduler(self) {
    loop {
      // 1. Find events with reminders due in next 5 mins
      // 2. Get user preferences for each attendee
      // 3. Enqueue notification jobs
      // 4. Sleep 1 minute
    }
  }

  // Get reminders due for next N minutes
  async fn get_pending_reminders(&self, minutes: i32) -> Vec<(Event, User, Reminder)> {
    // SQL: SELECT * FROM events
    // WHERE start_time BETWEEN NOW() AND NOW() + minutes
    // AND reminder_sent = false
  }
}
```

**2. Email Service** (`email.rs`, 120 lines)
```rust
pub struct EmailService {
  smtp: SmtpTransport,  // lettre crate
  from_address: String,
}

impl EmailService {
  pub async fn send_event_reminder(
    &self,
    user: &User,
    event: &Event,
    template: &EmailTemplate,
  ) -> Result<String, AppError> {
    // 1. Render HTML from template
    // 2. Create SMTP message
    // 3. Send via SMTP
    // 4. Return message ID for tracking
  }

  pub async fn send_digest_email(
    &self,
    user: &User,
    events: Vec<Event>,
  ) -> Result<String, AppError> {
    // 1. Group events by date
    // 2. Render digest template
    // 3. Send
  }

  fn render_template(
    &self,
    template: &str,
    context: &HashMap<String, String>,
  ) -> String {
    // Use minijinja or handlebars for templating
  }
}
```

**3. SMS Service** (`sms.rs`, 100 lines)
```rust
pub struct SmsService {
  client: TwilioClient,  // async HTTP client
  from_number: String,   // Twilio verified number
}

impl SmsService {
  pub async fn send_sms(
    &self,
    to_phone: &str,
    message: &str,
  ) -> Result<String, AppError> {
    // 1. Validate E.164 format
    // 2. Truncate if > 160 chars
    // 3. POST to Twilio API
    // 4. Return SID for tracking
  }
}
```

**4. Push Service** (`push.rs`, 150 lines)
```rust
pub struct PushService {
  vapid_key: VapidKey,  // web_push crate
}

impl PushService {
  pub async fn send_push_notification(
    &self,
    subscription: &PushSubscription,
    title: &str,
    body: &str,
    icon: &str,
    link: &str,
  ) -> Result<(), AppError> {
    // 1. Deserialize subscription JSON
    // 2. Create Web Push payload
    // 3. Send via HTTPS
    // 4. Handle errors (subscription expired, etc)
  }
}
```

### New Handlers

**`services/signapps-calendar/src/handlers/notifications.rs`** (200 lines)
```rust
// GET /api/v1/notifications/preferences
pub async fn get_preferences(
  State(state): State<AppState>,
  Claims { sub, .. }: Claims,
) -> Result<Json<NotificationPreferences>, AppError> {
  NotificationPreferencesRepository::get_by_user(pool, sub).await
}

// PUT /api/v1/notifications/preferences
pub async fn update_preferences(
  State(state): State<AppState>,
  Claims { sub, .. }: Claims,
  Json(prefs): Json<UpdatePreferencesRequest>,
) -> Result<Json<NotificationPreferences>, AppError> {
  NotificationPreferencesRepository::update(pool, sub, prefs).await
}

// POST /api/v1/notifications/subscriptions/push
pub async fn subscribe_push(
  State(state): State<AppState>,
  Claims { sub, .. }: Claims,
  Json(subscription): Json<PushSubscription>,
) -> Result<StatusCode, AppError> {
  // Save Web Push subscription to DB
}

// GET /api/v1/notifications/history
pub async fn get_notification_history(
  State(state): State<AppState>,
  Claims { sub, .. }: Claims,
  Query(filter): Query<NotificationHistoryFilter>,
) -> Result<Json<Page<NotificationSent>>, AppError> {
  // Filter by type, status, date range
}

// POST /api/v1/notifications/:id/resend
pub async fn resend_notification(
  State(state): State<AppState>,
  Claims { sub, .. }: Claims,
  Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
  // Retry failed notification
}
```

### Dependencies (Cargo.toml)
```toml
lettre = "0.11"           # SMTP email
tokio = "1.36"            # async runtime (already have)
twilio = "0.1"            # Twilio SMS API
web_push = "0.28"         # Web Push API
minijinja = "1.0"         # template rendering
uuid = { version = "1.6", features = ["v4", "serde"] }
serde_json = "1.0"
chrono = "0.4"
tokio-util = "0.7"        # task spawning
```

---

## 🎨 Frontend Implementation

### New Pages & Components

**Page** (`client/src/app/settings/notifications/page.tsx`)
```
Notification Settings
├─ Email Preferences
│  ├─ [✓] Enable email notifications
│  ├─ Frequency: ○ Instant ○ Digest ○ Disabled
│  └─ Quiet hours: [ ] 22:00 to 08:00
│
├─ SMS Preferences
│  ├─ [✓] Enable SMS notifications
│  ├─ Phone number: [+1-234-567-8900]
│  └─ [Verify number] (SMS code)
│
├─ Push Notifications
│  ├─ [✓] Enable browser push
│  ├─ [Request permission]
│  └─ Registered browsers: Chrome, Firefox
│
├─ Per-Calendar Settings
│  ├─ Work Calendar: [Settings]
│  └─ Personal Calendar: [Settings]
│
└─ Notification History
   └─ [See below]
```

**Component** (`client/src/components/notifications/NotificationSettings.tsx`)
```typescript
export function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>();
  const [loading, setLoading] = useState(false);

  // Load preferences
  useEffect(() => {
    api.get(`/api/v1/notifications/preferences`)
      .then(setPrefs);
  }, []);

  // Update preference
  const handleChange = async (field: string, value: any) => {
    setLoading(true);
    await api.put(`/api/v1/notifications/preferences`, {
      ...prefs,
      [field]: value
    });
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Email Notifications</Label>
            <Switch
              checked={prefs?.email_enabled}
              onCheckedChange={(v) => handleChange('email_enabled', v)}
            />
          </div>
          {prefs?.email_enabled && (
            <Select value={prefs?.email_frequency}>
              <SelectTrigger>
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="digest">Daily digest at 8 AM</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* SMS Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>SMS Notifications</Label>
            <Switch
              checked={prefs?.sms_enabled}
              onCheckedChange={(v) => handleChange('sms_enabled', v)}
            />
          </div>
          {prefs?.sms_enabled && (
            <>
              <Input
                placeholder="+1-234-567-8900"
                value={prefs?.phone_number}
                onChange={(e) => handleChange('phone_number', e.target.value)}
              />
              <Button variant="outline">Verify Phone</Button>
            </>
          )}
        </div>

        {/* Push Section */}
        <div className="flex items-center justify-between">
          <Label>Browser Push Notifications</Label>
          <Button onClick={() => requestPushPermission()}>
            {prefs?.push_enabled ? 'Manage' : 'Enable'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Notification History Component** (`client/src/components/notifications/NotificationHistory.tsx`)
```typescript
export function NotificationHistory() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState<NotificationFilter>({
    type: 'all',
    status: 'all',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={[
            { header: 'Type', field: 'notification_type' },
            { header: 'Channel', field: 'channel' },
            { header: 'Status', field: 'status', render: (s) => <Badge>{s}</Badge> },
            { header: 'Sent', field: 'sent_at', render: (d) => formatTime(d) },
            {
              header: 'Actions',
              render: (row) => (
                <>
                  {row.status === 'failed' && (
                    <Button size="sm" onClick={() => resend(row.id)}>
                      Resend
                    </Button>
                  )}
                </>
              ),
            },
          ]}
          data={notifications}
        />
      </CardContent>
    </Card>
  );
}
```

### Service Worker (for Push)
**`client/public/service-worker.js`** (80 lines)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const notification = {
    title: data.title,
    body: data.body,
    icon: data.icon,
    badge: '/badge-72x72.png',
    click_action: data.link,
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.click_action && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.click_action);
    })
  );
});
```

### Hooks
**`client/src/hooks/use-push-notifications.ts`** (80 lines)
```typescript
export function usePushNotifications() {
  const [registered, setRegistered] = useState(false);

  // Register service worker
  async function register() {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.register(
      '/service-worker.js'
    );

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send to backend
      await api.post('/api/v1/notifications/subscriptions/push', subscription);
      setRegistered(true);
    }
  }

  return { register, registered };
}
```

---

## 📧 Email Templates

Use minijinja for templating:

**`templates/event-reminder.html.j2`**
```html
<html>
  <body style="font-family: Arial; color: #333;">
    <h2>{{ event_title }}</h2>
    <p>
      <strong>When:</strong> {{ event_time }}<br>
      <strong>Where:</strong> {{ event_location }}<br>
      <strong>Organizer:</strong> {{ organizer_name }}
    </p>
    <p><strong>Attendees:</strong> {{ attendees }}</p>
    <a href="{{ event_link }}" style="background: #007bff; color: white; padding: 10px; text-decoration: none;">
      View Event
    </a>
    <hr>
    <p style="font-size: 12px; color: #999;">
      <a href="{{ unsubscribe_link }}">Manage notifications</a>
    </p>
  </body>
</html>
```

---

## 🔄 Workflow: Event Reminder

```
1. Event created: start_time = 2026-02-20 10:00:00, user_id = alice

2. Notification Scheduler runs (every minute):
   SELECT events WHERE start_time BETWEEN NOW() AND NOW() + 5 mins
   → Finds event scheduled for 09:45 (15 min before)

3. Check preferences:
   SELECT notification_preferences
   WHERE user_id = alice AND email_enabled = true
   → email_frequency = 'instant'

4. Queue notification:
   INSERT INTO notifications_sent {
     user_id: alice,
     event_id: event_id,
     notification_type: 'event_reminder',
     channel: 'email',
     status: 'pending'
   }

5. Send email:
   - Render template with event details
   - SMTP: Send to alice@example.com
   - UPDATE notifications_sent SET status='sent', sent_at=NOW()

6. User receives email:
   "Meeting: Project Kickoff at 10:00 AM - [View Event] [Decline] [Accept]"

7. User can click RSVP link (unsubscribe safe token):
   POST /api/v1/events/:event_id/attendees/:attendee_id/rsvp?response=accepted&token=...
```

---

## 🧪 Testing Strategy

### Unit Tests
- Email template rendering
- SMS message truncation
- Quiet hours logic
- Preference validation

### Integration Tests
- SMTP sending (using mailtrap.io)
- Twilio SMS (test credentials)
- Web Push payload encoding
- Preferences persistence

### E2E Tests (Playwright)
1. Create event 1 hour from now
2. Verify notification queued
3. Wait 50 minutes
4. Check email received in inbox
5. Click RSVP link
6. Verify attendee status updated

### Load Test
- 100 users, 10 events each = 1000 notifications
- Measure: Queue time, send time, success rate
- Goal: <1s per notification, 99.9% success

---

## 📦 Implementation Order

**Week 1**
1. Database migration & models
2. Notification scheduler
3. Email service (SMTP)
4. Email preference handlers
5. E2E test: Create event → Receive email

**Week 2**
1. SMS service (Twilio)
2. Push notifications (Web Push API)
3. Notification history
4. Settings UI
5. Load testing & Polish

---

## ⚙️ Environment Variables

```bash
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=noreply@signapps.com
SMTP_PASSWORD=<app-password>
SMTP_FROM_ADDRESS=noreply@signapps.com

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Web Push
VAPID_SUBJECT=mailto:admin@signapps.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Frontend
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## 🎯 Success Criteria Checklist

- [ ] Email reminders sent 15 min before event (verified via mailtrap)
- [ ] SMS sent to opted-in users with Twilio test account
- [ ] Push notifications display in browser
- [ ] Settings page allows user to configure preferences
- [ ] Notification history shows all sent notifications
- [ ] Quiet hours prevent notifications outside window
- [ ] 1000 notifications sent in <1 second with 99.9% success
- [ ] E2E test: Event → Email → RSVP → Status updated
- [ ] Documentation: API endpoints, template variables, deployment

---

## 📚 Related Documentation
- Phase 7 Summary: Real-time collaboration
- Database migration: `migrations/012_notifications.sql`
- API spec: `docs/NOTIFICATIONS_API.md` (to be created)

---

**Status**: Planning Complete
**Ready for Implementation**: ✅
**Estimated Duration**: 2 weeks (80-100 hours)
**Author**: Claude Haiku 4.5
**Last Updated**: Feb 16, 2026
