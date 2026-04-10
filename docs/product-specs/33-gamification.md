# Module Gamification (XP / Badges / Streaks) -- Functional Specification

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Spinify** | Leaderboards TV-ready, gamification des KPIs de vente, competitions d'equipe, celebrations video, integration CRM (Salesforce, HubSpot), badges custom, points par metrique, coaching AI |
| **Ambition** | Scorecards gamifiees, coaching workflows, fantasy sports-style leagues, benchmarking, TV dashboards, integration Salesforce/Gong/Outreach, OKR tracking gamifie |
| **LevelEleven** | Sales gamification, contests configurables, leaderboards par metrique, badges, points, streaks, TV displays, CRM-native (Salesforce), coaching scorecards |
| **Bunchball / Nitro (BI Worldwide)** | Enterprise gamification platform, missions, quests, leaderboards, virtual economy, badges, levels, social feed, analytics, 200+ enterprise integrations |
| **Badgeville (SAP)** | Comportement-based gamification, missions, badges, leaderboards, reputation points, activity streams, insights analytics, profils gamifies, widget embeddable |
| **Habitica** | RPG de productivite, avatar personnalise avec armure/equipement, quests de groupe, streaks daily, damage sur taches manquees, rewards custom, guilds, challenges communautaires |
| **Todoist Karma** | Systeme de karma points, streaks quotidiens/hebdomadaires, niveaux (Beginner -> Enlightened -> Master -> Grand Master), trending graphs, goals quotidiens/hebdomadaires |
| **Duolingo** | Reference gamification : XP par lecon, streaks daily avec freeze, leagues hebdomadaires (Bronze->Diamond), gems (currency virtuelle), achievements, hearts/vies, leaderboards sociaux |
| **Forest** | Focus gamification, planter un arbre virtuel par session de focus, foret qui grandit, social planting, achievements, coins pour vrais arbres plantes |
| **Microsoft Viva Engage** | Badges communautaires, recognition posts, streaks de publication, achievements, leadership acknowledgments, analytics d'engagement |
| **Kahoot!** | Quiz gamifies temps reel, podium, musique, streaks, points par rapidite de reponse, leaderboards, reports, templates, mode equipe |
| **Octalysis (framework)** | Framework de gamification de Yu-kai Chou -- 8 core drives : Epic Meaning, Accomplishment, Empowerment, Ownership, Social Influence, Scarcity, Unpredictability, Avoidance. Reference theorique. |

## Principes directeurs

1. **Intrinsic motivation first** -- gamification rewards virtuous behaviors (collaboration, completion, punctuality) rather than pure competition. The leaderboard is opt-in and levels value personal progression.
2. **Non-punitive** -- no negative points, no level demotion, no penalty for inactivity. Lost streaks do not lose earned XP. The system encourages, never punishes.
3. **Transparent mechanics** -- the user sees exactly which actions earn XP, how badges are unlocked, and where they stand in their progression. No black box.
4. **Optional and discreet** -- gamification is toggleable per user and per organization. When disabled, no gamified element appears. When enabled, elements are subtly integrated (no intrusive popups).
5. **Equitable** -- XP is calibrated so all roles (sales, developer, manager, assistant) can progress at a similar rate. No bias toward one user type.
6. **Private by default** -- level and badges are visible on the user's profile. The leaderboard is opt-in. Detailed statistics (actions, hours) are visible only to the user themselves.

---

## Category 1 -- XP System and Levels

### 1.1 Experience points (XP) fundamentals
Every action in SignApps earns XP. XP is cumulative and never decreases. Total XP determines the level. XP is earned instantly with discreet visual feedback: a small toast notification slides in from the bottom-right: "+15 XP" with a subtle upward-moving animation (200ms slide-up, 1.5s visible, 300ms fade-out). The toast uses `bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm shadow-lg`. Multiple XP gains within 2 seconds are batched into a single toast: "+23 XP".

### 1.2 XP calculation rules per action type
| Action | Base XP | Bonus condition | Bonus XP |
|---|---|---|---|
| Document created | +15 | Shared within 1h | +5 |
| Document shared | +10 | Shared with 5+ people | +5 |
| Email sent | +5 | -- | -- |
| Email replied (< 24h) | +8 | Replied < 1h | +4 |
| Meeting organized | +20 | With agenda attached | +10 |
| Meeting joined | +10 | Joined on time (before start) | +5 |
| Task created | +5 | With description + due date | +3 |
| Task completed | +10 | -- | -- |
| Task completed before deadline | +15 | 3+ days before deadline | +5 |
| Code/document review submitted | +25 | With 3+ substantive comments | +10 |
| Comment posted | +5 | Comment has @mention | +2 |
| Contact added | +3 | With full details (email+phone+company) | +2 |
| File uploaded to Drive | +5 | Organized in a folder (not root) | +2 |
| Form created | +10 | -- | -- |
| Form responded | +5 | -- | -- |
| Wiki page created | +15 | -- | -- |
| Wiki page updated | +8 | -- | -- |
| Brainstorm participation | +20 | Contributed 5+ ideas | +10 |
| Vote cast in brainstorm | +3 | -- | -- |
| Chat message sent | +1 | -- | -- |
| Chat thread started | +3 | -- | -- |
| Profile completed (100%) | +50 | One-time bonus | -- |

The full XP schedule is configurable by admin. Changes apply to future actions only (not retroactive). Each row in the admin config has: action identifier, base XP, bonus condition (optional), bonus XP (optional), enabled toggle, max per day (anti-gaming cap).

### 1.3 Level progression curve (exponential)
Progression follows an exponential curve: `xp_required(level) = floor(100 * 1.5^(level - 1))`.

| Level | Name | XP Required (cumulative) | XP for this level | Badge Visual |
|---|---|---|---|---|
| 1 | Newcomer | 0 | -- | Bronze star |
| 2 | Initiate | 100 | 100 | Bronze star x2 |
| 3 | Contributor | 250 | 150 | Silver star |
| 4 | Active | 475 | 225 | Silver star x2 |
| 5 | Engaged | 812 | 337 | Gold star |
| 6 | Expert | 1,318 | 506 | Gold star x2 |
| 7 | Master | 2,077 | 759 | Diamond |
| 8 | Champion | 3,216 | 1,139 | Diamond x2 |
| 9 | Legend | 4,924 | 1,708 | Crown |
| 10 | Virtuoso | 7,486 | 2,562 | Golden crown |

The exponential curve ensures early levels feel quick (motivating new users) while later levels require sustained engagement. Level 10 is achievable in approximately 6-12 months of regular use.

Level-up triggers:
1. Full-screen overlay animation (500ms): the new level badge zooms in from the center with a burst of particles (using `canvas-confetti` ISC)
2. Badge visual pulses with a golden glow
3. Toast notification: "Level up! You are now [Level name]"
4. Optional: announcement in team chat feed (if user opted in)
5. Sound effect: short celebratory chime (Web Audio API, 1 second, volume controlled by user preference)

### 1.4 XP progress bar
Widget displaying:
- Current level name and badge icon (left side)
- XP progress bar: `bg-muted` track, `bg-primary` fill, animated width transition (500ms ease-out)
- Text above bar: "[current XP] / [next level XP]" (e.g., "1,150 / 1,318 XP")
- Text below bar: "[XP remaining] XP to [next level name]" (e.g., "168 XP to Expert")
- Percentage: "87% to next level"

The widget is visible in: user profile page, dashboard sidebar (collapsible), and optionally in the top navigation bar (compact mode: level badge + mini progress bar, 100px wide).

### 1.5 XP history log
Detailed panel listing every XP gain:
| Column | Content |
|---|---|
| Date/time | "Today at 14:32", "Yesterday at 09:15" |
| Action | "Document created" |
| Module | Badge: Docs (blue), Mail (red), Calendar (green), etc. |
| XP earned | "+15 XP" (green text) |
| Bonus | "+5 XP (shared within 1h)" or "--" |
| Total | Running total after this gain |

Filterable by: period (today, this week, this month, all time), module (checkboxes). Recharts `AreaChart` showing daily XP gain over the last 30 days. Average daily XP displayed. Peak day highlighted.

### 1.6 XP multiplier events
Admin-created temporary events that multiply XP for specific actions:
- **Event name**: e.g., "Sharing Week"
- **Multiplier**: 2x, 3x (select)
- **Affected actions**: multi-select from the action list (e.g., "Document shared", "File uploaded")
- **Start date/time** and **End date/time**
- **Announcement text**: displayed as a banner at the top of the dashboard

During the event:
- Affected actions show a "2x" badge next to the XP toast
- The XP history log marks multiplied entries with a flame icon
- The dashboard banner shows: "Sharing Week: 2x XP on all shares! Ends in 3d 12h"
- Banner styling: `bg-gradient-to-r from-orange-500 to-yellow-500 text-white`

Maximum 3 concurrent multiplier events. Admin can cancel an event early.

---

## Category 2 -- Badges and Achievements

### 2.1 Badge catalog
Library of unlockable badges. Each badge has:
- **Name**: human-readable (e.g., "Inbox Zero")
- **Icon**: custom SVG or emoji (rendered at 48x48px on profile, 24x24px inline)
- **Description**: what it rewards (e.g., "Maintained zero unread emails for 24 hours")
- **Unlock criteria**: SQL-evaluable condition (see 2.6)
- **Rarity**: Common (gray border), Rare (blue border), Epic (purple border), Legendary (gold border with glow)
- **XP bonus on unlock**: +50 (Common), +100 (Rare), +200 (Epic), +500 (Legendary)
- **Category**: module-based (Mail, Docs, Calendar, Tasks, Drive, Chat, Social, General)
- **Visibility**: visible (in catalog before unlock, grayed out with "?" criteria) or secret (hidden until unlocked)

Total badge count displayed on profile: "42/85 badges unlocked".

### 2.2 Badge definitions per module

**Mail**:
- "Inbox Zero" (Rare): 0 unread emails for 24 consecutive hours. SQL: `SELECT COUNT(*) FROM emails WHERE user_id = $1 AND is_read = false` returns 0 for 24h
- "Speed Responder" (Epic): replied to 50 emails within 1 hour of receipt. SQL: track `replied_at - received_at < interval '1 hour'` count >= 50
- "Diplomatic" (Rare): sent 100 emails with no follow-up "forgot attachment" reply within 24h

**Calendar**:
- "Punctual" (Common): joined 20 meetings before the start time
- "Organizer" (Rare): created 50 events with agenda attached
- "Efficient" (Epic): zero meetings without agenda this month (min 10 meetings)

**Docs**:
- "Prolific Author" (Rare): created 50 documents
- "Reviewer" (Rare): submitted 25 document reviews
- "Collaborator" (Epic): participated in (edited) 20 shared documents

**Tasks**:
- "Productive" (Rare): completed 100 tasks
- "Ahead of Schedule" (Epic): completed 30 tasks before deadline
- "Streak Master" (Legendary): maintained a 30-day streak of completing at least 1 task per day

**Drive**:
- "Organized" (Common): 30 files placed in folders (not in root)
- "Generous Sharer" (Rare): shared 50 files with team members

**Chat**:
- "Communicator" (Common): sent 500 messages
- "Responsive" (Rare): replied to 100 direct messages within 5 minutes

**General/Cross-module**:
- "Explorer" (Legendary, secret): used every SignApps module at least once
- "Early Bird" (Rare): logged in before 7am on 20 different days
- "Night Owl" (Rare): active after 10pm on 10 different days
- "Team Player" (Epic): received 50 kudos from different colleagues
- "Mentor" (Epic): sent 30 kudos to different colleagues

### 2.3 Multi-tier progressive badges
Some badges have Bronze -> Silver -> Gold tiers. Each tier replaces the previous on the profile.
| Badge | Bronze Threshold | Silver Threshold | Gold Threshold |
|---|---|---|---|
| Author | 10 documents | 50 documents | 200 documents |
| Communicator | 100 messages | 500 messages | 2,000 messages |
| Task Master | 25 tasks completed | 100 tasks | 500 tasks |
| Meeting Pro | 20 meetings organized | 100 meetings | 500 meetings |
| Reviewer | 10 reviews | 50 reviews | 200 reviews |
| Sharer | 20 shares | 100 shares | 500 shares |

Tier upgrade triggers the same animation as a new badge unlock, with the old tier visually "shattering" and the new tier appearing.

### 2.4 Secret badges
Not displayed in the catalog until unlocked. The catalog shows a slot with a "?" icon and "Secret badge" text. Once unlocked, the badge appears with a special "Secret" label and sparkle effect. Examples:
- "Easter Egg": used every single feature of SignApps at least once
- "Midnight Warrior": completed a task between midnight and 5am
- "All-In-One Day": created a doc, sent an email, completed a task, joined a meeting, uploaded a file, and sent a chat message all in the same day
- "Centurion": 100-day login streak

### 2.5 Badge unlock notification
When a badge is unlocked:
1. Toast notification (persistent until dismissed): badge icon + name + description + "View badge" link
2. Badge icon animation: spins in, then settles with a golden shimmer effect (`framer-motion` animate)
3. Confetti burst around the notification (using `canvas-confetti` ISC, 100 particles, 2-second duration)
4. Sound effect: short achievement chime (distinct from level-up sound)
5. Optional: auto-post to team chat feed: "[User] unlocked [Badge name]!" with badge icon

### 2.6 Badge unlock criteria (SQL conditions)
Each badge's unlock criteria is defined as a SQL-evaluable condition stored in the `badge_definitions.criteria_query` field. The XP engine evaluates all non-unlocked badges for a user after each XP gain. Evaluation is batched and asynchronous (does not block the original action).

Example criteria query for "Inbox Zero":
```sql
SELECT NOT EXISTS (
    SELECT 1 FROM emails
    WHERE user_id = $1 AND is_read = false
    AND received_at < now() - interval '24 hours'
) AND (
    SELECT COUNT(*) FROM emails WHERE user_id = $1 AND is_read = true
) > 0
```

Admin can create custom badges with custom SQL queries (validated for safety: read-only, parameterized, timeout 5s). The query must return a boolean.

### 2.7 Admin badge creator
Form for creating custom badges:
- **Name** (text, required, max 50 chars)
- **Icon** (upload SVG/PNG or select from icon library)
- **Description** (text, required, max 200 chars)
- **Rarity** (select: Common, Rare, Epic, Legendary)
- **Category** (select: module or General)
- **Criteria type**: automatic (SQL query) or manual (admin assigns manually)
- **SQL criteria** (code editor with syntax highlighting, visible if automatic)
- **XP bonus** (number, auto-filled based on rarity but editable)
- **Secret** (toggle)
- **Enabled** (toggle)

"Test criteria" button: runs the query for a selected test user and shows whether it would unlock. "Preview" button: shows how the badge would look on a profile.

---

## Category 3 -- Streaks

### 3.1 Daily streak tracking
Counter of consecutive days with at least one qualifying action. What qualifies is configurable by admin (default: any of the following counts):
- Complete a task
- Send an email
- Edit a document
- Upload a file
- Send a chat message
- Attend a meeting

The streak increments at midnight (organization timezone) if at least one qualifying action occurred that calendar day. If no qualifying action: the streak resets to 0 (unless a freeze is used).

### 3.2 Streak display widget
Widget showing:
- **Current streak**: large number (e.g., "12") with flame icon
- **Flame visual**: flame size and color changes based on streak length:
  - 1-6 days: small bronze flame
  - 7-29 days: medium silver flame (pulsing gently)
  - 30-99 days: large gold flame (animated flicker)
  - 100+ days: extra-large diamond flame (with particle effects)
- **Best streak record**: smaller text below: "Best: 45 days"
- **Today's status**: green checkmark "Today's streak secured" or orange clock "No qualifying action yet today"
- **Freeze count**: small badge: "1 freeze available"

Widget placement: user profile, dashboard sidebar, and a compact version in the top navigation bar (flame icon + number).

### 3.3 Streak freeze (protection)
Users have N streak freezes (default: 1, earnable via XP milestones or admin grants). A freeze protects the streak for one day of inactivity (weekend, holiday, sick day). Usage:
- **Automatic**: if the day ends without a qualifying action and the user has a freeze available, the freeze is consumed automatically. The streak is preserved. A notification: "Streak freeze used! Your 12-day streak is safe."
- **Manual**: user can pre-activate a freeze for a specific future date (e.g., planning a vacation). Manual activation via the streak widget: "Use freeze for tomorrow" button.
- **Indicator**: days where a freeze was used show a snowflake icon instead of a checkmark in the streak calendar.

Freeze earning milestones:
- 1 free freeze at account creation
- +1 freeze at level 3 (Contributor)
- +1 freeze at level 5 (Engaged)
- +1 freeze at level 7 (Master)
- +1 freeze per 30-day streak achieved
Admin can also manually grant freezes.

### 3.4 Streak recovery
When a streak is broken:
- The old streak record is preserved: "Best streak: 45 days"
- A new streak starts at 0 (increments to 1 after the next qualifying action day)
- No XP penalty (XP earned during the streak is kept)
- Empathetic message: "Your streak reset, but your 45-day record stands! Start a new run."
- No shame notification (the reset is only visible to the user)

### 3.5 Team streaks
Team-level streak tracking: if all members of a team maintain their individual streaks on the same day, the team streak increments. Team streak widget in the team dashboard:
- "Team Marketing: 8-day streak" with a larger team flame icon
- Individual member streak status: green checkmark or red X per member
- Team streak bonus: +5 XP per team member for each team streak day
- Team streak broken: notification to all members (opt-in): "Team streak broken. [User] did not qualify yesterday."
- The team streak is only broken if a member does not qualify AND has no freeze available.

### 3.6 Weekly streak
In addition to the daily streak, a weekly streak counts consecutive weeks where a configurable goal is met (default: complete 5 tasks per week). Less sensitive to individual day absences:
- **Counter**: "4 weeks" with a calendar icon
- **Goal tracking**: "3/5 tasks completed this week" with progress bar
- **Weekly streak widget**: separate from the daily streak, displayed below it
- **Weekly streak badge**: "Consistent" badge unlocked at 4 consecutive weeks, "Unstoppable" at 12 weeks

---

## Category 4 -- Leaderboard

### 4.1 Opt-in mechanism
The leaderboard is disabled by default for each user. Toggle in Settings > Privacy > Gamification: "Participate in leaderboard" (off by default). Users who have not opted in do not appear on any leaderboard and cannot see the leaderboard page. The toggle shows a clear explanation: "Your weekly XP and rank will be visible to other participants."

### 4.2 Weekly XP leaderboard
Leaderboard ranks participants by XP earned this week (Monday 00:00 to Sunday 23:59, organization timezone). Reset every Monday. This design ensures new users can compete with veterans (weekly XP, not cumulative). Displayed as a vertical list:

**Podium section (top 3)**:
- Position 1: gold crown icon, large avatar, name, weekly XP, level badge, top 3 badges
- Position 2: silver medal icon, medium avatar
- Position 3: bronze medal icon, medium avatar
Podium has a slight raised card design with `bg-gradient` backgrounds (gold, silver, bronze).

**Rest of the list (positions 4+)**:
| # | User | Weekly XP | Level | Top Badge |
|---|---|---|---|---|
| 4 | Avatar + Name | 342 XP | Expert (6) | Reviewer Gold |

The current user's position is always visible (pinned at the bottom if not in the visible range): "You: #23 - 87 XP this week" with a highlight background.

### 4.3 Time filter options
Toggle the leaderboard period:
- **This week** (default): XP earned since last Monday
- **This month**: XP earned since the 1st of the month
- **All time**: cumulative XP (benefits long-term users)
Each filter recalculates rankings. The URL param `?period=week|month|all` persists the choice.

### 4.4 Team leaderboard
Aggregated XP by team (from the organization structure). Teams ranked by total weekly XP divided by member count (average per member, to avoid large-team advantage). Displayed identically to the individual leaderboard but with team avatar, team name, member count, and average XP. Click on a team to see the individual breakdown of members.

### 4.5 Module-specific leaderboard
Filter the leaderboard by module: "Top Docs contributors", "Top Mail responders", "Top Calendar organizers", etc. Module filter is a row of pills (similar to search scopes). Each module filter ranks by XP earned only from that module's actions. Useful for recognizing domain expertise.

### 4.6 Leaderboard history archive
Past rankings stored weekly. User can browse: "Week 12: 5th, Week 13: 3rd, Week 14: 1st". Displayed as a Recharts `LineChart` showing the user's rank over time (Y-axis inverted: 1 at top). Trend indicator: "Trending up" (green arrow) or "Trending down" (red arrow) based on last 4 weeks.

### 4.7 Team challenges and competitions
Admin-created challenges:
- **Challenge name**: e.g., "Q2 Task Blitz"
- **Duration**: start date, end date
- **Criteria**: specific action type (e.g., "tasks completed") or general XP
- **Scope**: individual or team
- **Reward**: badge (select from catalog or create new), XP bonus, title (displayed next to user name for 1 week)
- **Announcement**: auto-posted to team chat + dashboard banner

During the challenge:
- Dedicated leaderboard for the challenge
- Progress bar: "You: 23/50 tasks | Challenge leader: Alice (41/50)"
- Countdown timer: "2d 14h remaining"
- On completion: winner announcement with confetti animation, badge auto-awarded

---

## Category 5 -- Onboarding Quests

### 5.1 Welcome quest
For new users, a guided quest "Discover SignApps" with 8 steps:
1. Complete your profile (avatar, bio, job title)
2. Send your first email
3. Create a document
4. Add a contact
5. Create a calendar event
6. Complete a task
7. Upload a file to Drive
8. Send a message in chat

Each step completed awards +25 XP bonus (total: 200 XP, enough to reach level 2). Completing all 8 steps unlocks the "First Steps" badge (Common). The quest panel shows progress: "Discover SignApps: 3/8 complete" with checkmarks on completed items and direct action links for remaining items ("Create your first document ->").

### 5.2 Quest progress widget
Dedicated widget on the dashboard (dismissible after completion):
- Title: "Discover SignApps"
- Progress bar: "3/8 steps complete" with animated fill
- Step list: each step has an icon, title, status (completed checkmark / pending circle)
- Click on a pending step: navigates to the relevant page with a highlight/tooltip pointing at the action
- Completion animation: the widget transforms into a "Congratulations!" card with confetti and the "First Steps" badge

### 5.3 Advanced thematic quests
Unlocked progressively after the welcome quest:
- **"Master the Mail"** (5 steps): reply to 5 emails, organize with labels, use a filter, archive 10 emails, achieve Inbox Zero for 1 hour
- **"Expert Documents"** (5 steps): create 3 documents, share a document, add a comment, use a template, export to PDF
- **"Collaborator"** (5 steps): participate in 3 meetings, post 10 chat messages, review a document, create a shared folder, add 5 contacts
- **"Organized"** (5 steps): create 3 folders in Drive, apply labels to 10 items, set up a calendar recurring event, create a form, use a Kanban board

Each quest awards: XP per step + a themed badge on completion. Quests are displayed in a quest log panel accessible from the profile.

### 5.4 Team quests (collaborative)
Quests where the entire team contributes to a shared goal:
- "Team Momentum: Complete 50 tasks this week" -- shared progress bar
- "Knowledge Builders: Create 20 wiki pages this month" -- shared progress bar
Each contributing member earns individual XP. When the team goal is reached: team badge awarded to all members, XP bonus (+50 per member), announcement in team chat.

### 5.5 Custom quests (admin)
Admin quest builder:
- **Quest name** (text)
- **Description** (text)
- **Steps**: list of conditions (action type + count + optional module filter)
- **XP per step** (number)
- **Completion reward**: badge (select), XP bonus (number), title (text, optional)
- **Target**: all users, specific team, specific role
- **Duration**: start date, end date (or permanent)
- **Active** (toggle)

Preview before publishing. Quests can be cloned and modified.

---

## Category 6 -- Gamified Profile and Social

### 6.1 Gamified profile card
Section on the user profile page:
- **Level badge** (large, centered): visual icon for current level
- **Level name**: "Expert (Level 6)"
- **XP total**: "1,450 XP"
- **Progress bar**: to next level (see 1.4)
- **Current streak**: flame icon + number + flame visual
- **Pinned badges** (3 max): user selects 3 badges to showcase. Displayed as 48x48 icons with name tooltip. "Edit pins" link opens a badge selector.
- **Stats summary**: "42 badges | 12-day streak | 3 quests completed"

The gamified section is collapsible if the user prefers a minimal profile.

### 6.2 Badge showcase page
Dedicated page (`/profile/:id/badges`) listing all badges:
- **Unlocked badges**: full color, with unlock date, rarity border, and XP earned
- **Locked badges** (visible): grayed out with criteria text. Progress indicator if applicable (e.g., "15/50 documents created")
- **Secret badges** (not yet unlocked): "?" slot with "Secret -- keep exploring!"
- **Filters**: by module, by rarity, by status (unlocked/locked), by date unlocked
- **Sort**: by date (newest first), by rarity (legendary first), by name (A-Z)
- **Badge detail modal**: click a badge to see full description, criteria, rarity, unlock date, and users who also have it (if opted in)

### 6.3 Profile comparison
Navigate to a colleague's profile (if they opted in to gamification visibility). Comparison panel:
- Side-by-side: your level vs. their level
- Badges in common (highlighted)
- Badges unique to each (your exclusive / their exclusive)
- Streak comparison
- "Challenge [user] to [action]" button (creates a friendly 1v1 mini-challenge, visible only to both)

### 6.4 Gamification activity feed
In the team chat or a dedicated "Activity" channel (configurable), auto-posted messages (only for users who opted in):
- "Alice reached Level 7 (Master)!" with badge icon
- "Bob unlocked the badge 'Inbox Zero'!" with badge icon
- "Team Marketing has a 30-day streak!" with flame icon
- "Challenge 'Q2 Task Blitz' winner: Alice (47 tasks)!" with trophy icon

Messages are posted via PgEventBus event `gamification.milestone.reached` consumed by `signapps-chat`. Messages have a distinctive "gamification" style: subtle background gradient, small trophy/star icon prefix.

### 6.5 Peer recognition (kudos)
"Kudos" button on any user's profile card or in chat (@user kudos):
- Opens a mini-dialog: select a kudos type (thumbs up, star, heart, rocket, clap) + optional message (max 140 chars)
- Sending kudos: +5 XP to the recipient, +2 XP to the sender
- Daily limit: 5 kudos per user per day (anti-spam)
- Kudos history: on the profile page, "Kudos received" section showing recent kudos with sender, type, message, and date
- Kudos count displayed on profile: "127 kudos received"
- "Top kudos giver" and "Top kudos receiver" badges (per month)

---

## Category 7 -- Administration and Analytics

### 7.1 Admin gamification dashboard
Overview panel:
- Active gamified users: N (percentage of total users)
- Leaderboard opt-in rate: N%
- Total XP distributed this week: N
- Badges most unlocked (top 10, bar chart)
- Badges least unlocked (bottom 10, bar chart -- indicates hard badges)
- Average streak length: N days
- Quest completion rate: N%
- Engagement trend: Recharts `LineChart` of daily active gamified users over 30 days

### 7.2 XP schedule configuration
Table of all XP actions:
| Action | Base XP | Bonus Condition | Bonus XP | Max/Day | Enabled |
|---|---|---|---|---|---|
| document_created | 15 | shared_within_1h | 5 | 20 | yes |
| email_sent | 5 | -- | -- | 50 | yes |
| ... | ... | ... | ... | ... | ... |

Edit inline: click a cell to modify. Save button applies changes. Changes affect future actions only. "Reset to defaults" button restores the original schedule. "Preview impact" button shows: estimated level distribution before/after the change (how many users at each level).

### 7.3 Global activation/deactivation
- **Organization toggle**: enable/disable gamification for the entire organization. When disabled, all gamification UI elements are hidden, XP stops accumulating, leaderboards are hidden. Data is preserved (not deleted).
- **Per-module toggle**: disable XP for specific modules (e.g., disable Mail XP but keep Tasks XP). Useful for focusing gamification on specific behaviors.
- **Per-role toggle**: disable gamification for specific roles (e.g., disable for managers to avoid pressure). Role list from RBAC.

### 7.4 Engagement reports
Downloadable reports (CSV/PDF):
- **User engagement**: XP per user per week, active days per user, badges per user
- **Gamification vs. module usage**: correlation chart showing whether gamified users use modules more than non-gamified users
- **Quest funnel**: for each quest, how many users started, progressed to step N, completed
- **Streak distribution**: histogram of current streak lengths (how many users at 1d, 7d, 30d, 100d)
- **Leaderboard participation**: opt-in trend over time

### 7.5 Anti-gaming detection
Rate limiting and pattern detection to prevent XP manipulation:
- **Per-action daily cap**: max N XP per action type per day (e.g., max 50 emails = 250 XP). Configurable in the XP schedule.
- **Quality gates**: document must have > 10 chars to earn XP (not empty). Email must have a recipient (not self-send). Task must have a title. Chat message must have > 2 chars.
- **Burst detection**: if a user earns > 200 XP in 5 minutes, flag for review. Admin notification: "Unusual XP burst detected for [user]: 350 XP in 3 minutes."
- **Self-referential actions blocked**: sending email to yourself, assigning tasks to yourself and immediately completing them, creating and deleting documents repeatedly.
- **Flagged actions**: admin can view flagged actions, confirm as legitimate or revoke XP.

Flagged items in admin panel: table with user, action, XP, timestamp, flag reason, status (pending/confirmed/revoked).

### 7.6 Reset and migration
- **Full reset**: admin can reset all XP, levels, badges, and streaks for the organization (requires typed confirmation: "RESET ALL GAMIFICATION DATA"). This is irreversible.
- **User reset**: admin can reset gamification data for a specific user (e.g., for testing).
- **Schedule migration**: when changing the XP schedule, option for "retroactive recalculation" (re-processes all historical actions with new XP values). Warning: computationally expensive, runs as background job.
- **Data export**: export all gamification data as CSV: users with XP/level/badges/streaks, XP log, badge unlock log. For analytics or migration.

---

## Category 8 -- PostgreSQL Schema

### 8.1 user_xp table
```sql
CREATE TABLE user_xp (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    total_xp        INTEGER NOT NULL DEFAULT 0,
    level           SMALLINT NOT NULL DEFAULT 1,
    level_name      TEXT NOT NULL DEFAULT 'Newcomer',
    weekly_xp       INTEGER NOT NULL DEFAULT 0,
    monthly_xp      INTEGER NOT NULL DEFAULT 0,
    weekly_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', now()),
    monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
    leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false,
    gamification_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_xp_org ON user_xp (org_id);
CREATE INDEX idx_user_xp_leaderboard ON user_xp (org_id, weekly_xp DESC) WHERE leaderboard_opt_in = true;
CREATE INDEX idx_user_xp_level ON user_xp (org_id, level DESC);
```

### 8.2 xp_log table
```sql
CREATE TABLE xp_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    action          TEXT NOT NULL,  -- 'document_created', 'email_sent', etc.
    module          TEXT NOT NULL,  -- 'docs', 'mail', 'calendar', etc.
    base_xp         SMALLINT NOT NULL,
    bonus_xp        SMALLINT NOT NULL DEFAULT 0,
    multiplier      REAL NOT NULL DEFAULT 1.0,  -- 1.0 = no multiplier, 2.0 = double XP event
    total_xp        SMALLINT NOT NULL,  -- base_xp * multiplier + bonus_xp * multiplier
    resource_id     UUID,  -- optional: the document/email/task that triggered the XP
    is_flagged      BOOLEAN NOT NULL DEFAULT false,
    flag_reason     TEXT,
    flag_status     TEXT DEFAULT 'pending',  -- 'pending', 'confirmed', 'revoked'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_log_user ON xp_log (user_id, created_at DESC);
CREATE INDEX idx_xp_log_org ON xp_log (org_id, created_at DESC);
CREATE INDEX idx_xp_log_flagged ON xp_log (is_flagged) WHERE is_flagged = true;
```

### 8.3 badge_definitions table
```sql
CREATE TABLE badge_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),  -- null = global/system badge
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon_url        TEXT,
    icon_emoji      TEXT,
    category        TEXT NOT NULL,  -- 'mail', 'docs', 'calendar', 'tasks', 'drive', 'chat', 'social', 'general'
    rarity          TEXT NOT NULL DEFAULT 'common',  -- 'common', 'rare', 'epic', 'legendary'
    xp_bonus        INTEGER NOT NULL DEFAULT 50,
    is_secret       BOOLEAN NOT NULL DEFAULT false,
    is_progressive  BOOLEAN NOT NULL DEFAULT false,  -- true for multi-tier badges
    tier            SMALLINT DEFAULT 1,  -- 1=bronze, 2=silver, 3=gold (for progressive)
    parent_badge_id UUID REFERENCES badge_definitions(id),  -- links tiers together
    criteria_type   TEXT NOT NULL DEFAULT 'automatic',  -- 'automatic', 'manual'
    criteria_query  TEXT,  -- SQL query returning boolean for automatic badges
    criteria_description TEXT,  -- human-readable description of criteria
    enabled         BOOLEAN NOT NULL DEFAULT true,
    is_system       BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_badge_defs_org ON badge_definitions (org_id, category, enabled);
CREATE INDEX idx_badge_defs_parent ON badge_definitions (parent_badge_id);
```

### 8.4 user_badges table
```sql
CREATE TABLE user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id        UUID NOT NULL REFERENCES badge_definitions(id),
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_pinned       BOOLEAN NOT NULL DEFAULT false,
    notified        BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges (user_id, unlocked_at DESC);
CREATE INDEX idx_user_badges_pinned ON user_badges (user_id) WHERE is_pinned = true;
```

### 8.5 streaks table
```sql
CREATE TABLE streaks (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    current_daily   INTEGER NOT NULL DEFAULT 0,
    best_daily      INTEGER NOT NULL DEFAULT 0,
    last_daily_at   DATE,  -- last date a qualifying action occurred
    freeze_count    INTEGER NOT NULL DEFAULT 1,
    freeze_used_dates DATE[] NOT NULL DEFAULT '{}',
    current_weekly  INTEGER NOT NULL DEFAULT 0,
    best_weekly     INTEGER NOT NULL DEFAULT 0,
    weekly_goal     INTEGER NOT NULL DEFAULT 5,  -- tasks per week
    weekly_progress INTEGER NOT NULL DEFAULT 0,
    week_start      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_streaks_org ON streaks (org_id);
```

### 8.6 team_streaks table
```sql
CREATE TABLE team_streaks (
    team_id         UUID PRIMARY KEY,  -- references the org structure team
    org_id          UUID NOT NULL REFERENCES organizations(id),
    current_streak  INTEGER NOT NULL DEFAULT 0,
    best_streak     INTEGER NOT NULL DEFAULT 0,
    last_active_at  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.7 xp_multiplier_events table
```sql
CREATE TABLE xp_multiplier_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    multiplier      REAL NOT NULL DEFAULT 2.0,
    affected_actions TEXT[] NOT NULL,  -- ['document_shared', 'file_uploaded', etc.]
    announcement    TEXT,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_multipliers_active ON xp_multiplier_events (org_id, start_at, end_at) WHERE is_active = true;
```

### 8.8 challenges table
```sql
CREATE TABLE challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    description     TEXT,
    criteria_action TEXT NOT NULL,  -- action type or 'xp_total'
    criteria_count  INTEGER,       -- target count (null if xp_total)
    scope           TEXT NOT NULL DEFAULT 'individual',  -- 'individual', 'team'
    reward_badge_id UUID REFERENCES badge_definitions(id),
    reward_xp       INTEGER NOT NULL DEFAULT 0,
    reward_title    TEXT,  -- temporary title displayed next to winner's name
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled', 'active', 'completed', 'cancelled'
    winner_user_id  UUID REFERENCES users(id),
    winner_team_id  UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_org ON challenges (org_id, status, start_at);
```

### 8.9 quests table
```sql
CREATE TABLE quests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),  -- null = system quest
    name            TEXT NOT NULL,
    description     TEXT,
    quest_type      TEXT NOT NULL DEFAULT 'individual',  -- 'individual', 'team'
    steps           JSONB NOT NULL,  -- [{ step_number, action, count, module, xp_reward, description }]
    completion_badge_id UUID REFERENCES badge_definitions(id),
    completion_xp   INTEGER NOT NULL DEFAULT 0,
    target_audience TEXT NOT NULL DEFAULT 'all',  -- 'all', 'new_users', 'team', 'role'
    target_ids      UUID[] DEFAULT '{}',
    is_permanent    BOOLEAN NOT NULL DEFAULT true,
    start_at        TIMESTAMPTZ,
    end_at          TIMESTAMPTZ,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    is_system       BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quests_org ON quests (org_id, enabled);
```

### 8.10 user_quest_progress table
```sql
CREATE TABLE user_quest_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id        UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    current_step    INTEGER NOT NULL DEFAULT 0,
    step_progress   JSONB NOT NULL DEFAULT '{}',  -- { "1": { completed: true, completed_at: "..." }, "2": { completed: false, progress: 3, target: 5 } }
    status          TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'abandoned'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    UNIQUE (user_id, quest_id)
);

CREATE INDEX idx_quest_progress_user ON user_quest_progress (user_id, status);
```

### 8.11 kudos table
```sql
CREATE TABLE kudos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES users(id),
    receiver_id     UUID NOT NULL REFERENCES users(id),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    kudos_type      TEXT NOT NULL,  -- 'thumbs_up', 'star', 'heart', 'rocket', 'clap'
    message         TEXT,  -- max 140 chars
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kudos_receiver ON kudos (receiver_id, created_at DESC);
CREATE INDEX idx_kudos_sender_daily ON kudos (sender_id, created_at DESC);
```

---

## Category 9 -- REST API Endpoints

### 9.1 User XP and level
```
GET    /api/v1/gamification/me               -- current user's XP, level, streak, badges, quests
GET    /api/v1/gamification/users/:id        -- another user's public gamification data (if visible)
Auth: Bearer JWT.
```

### 9.2 XP history
```
GET    /api/v1/gamification/xp/history       -- XP log (filters: module, from, to, page, per_page)
GET    /api/v1/gamification/xp/stats         -- XP stats (daily chart data, averages, peak)
Auth: Bearer JWT. User sees only their own data.
```

### 9.3 Badges
```
GET    /api/v1/gamification/badges           -- badge catalog (all definitions + user's unlock status)
GET    /api/v1/gamification/badges/:id       -- badge detail
PATCH  /api/v1/gamification/badges/:id/pin   -- pin/unpin a badge on profile { pinned: bool }
Auth: Bearer JWT.
```

### 9.4 Streaks
```
GET    /api/v1/gamification/streaks          -- current user's streak data (daily, weekly, freezes)
POST   /api/v1/gamification/streaks/freeze   -- manually activate a freeze { date: "2026-04-15" }
Auth: Bearer JWT.
```

### 9.5 Leaderboard
```
GET    /api/v1/gamification/leaderboard      -- leaderboard (params: period=week|month|all, module, scope=individual|team, page, per_page)
Auth: Bearer JWT. Only returns opted-in users.
```

### 9.6 Quests
```
GET    /api/v1/gamification/quests           -- available quests for current user
GET    /api/v1/gamification/quests/:id       -- quest detail + progress
POST   /api/v1/gamification/quests/:id/start -- start a quest (for non-auto-started quests)
Auth: Bearer JWT.
```

### 9.7 Challenges
```
GET    /api/v1/gamification/challenges       -- active and upcoming challenges
GET    /api/v1/gamification/challenges/:id   -- challenge detail + leaderboard
Auth: Bearer JWT.
```

### 9.8 Kudos
```
POST   /api/v1/gamification/kudos            -- send kudos { receiver_id, kudos_type, message }
GET    /api/v1/gamification/kudos/received   -- kudos received by current user
GET    /api/v1/gamification/kudos/sent       -- kudos sent by current user
Auth: Bearer JWT. Rate limited: 5 kudos per user per day.
```

### 9.9 Admin endpoints
```
GET    /api/v1/admin/gamification/dashboard  -- admin dashboard data
GET    /api/v1/admin/gamification/config     -- XP schedule, toggles
PUT    /api/v1/admin/gamification/config     -- update XP schedule
POST   /api/v1/admin/gamification/badges     -- create custom badge
PUT    /api/v1/admin/gamification/badges/:id -- update badge
DELETE /api/v1/admin/gamification/badges/:id -- delete custom badge
POST   /api/v1/admin/gamification/badges/:id/award -- manually award badge to user { user_id }
POST   /api/v1/admin/gamification/multipliers -- create XP multiplier event
DELETE /api/v1/admin/gamification/multipliers/:id -- cancel multiplier event
POST   /api/v1/admin/gamification/challenges -- create challenge
PUT    /api/v1/admin/gamification/challenges/:id -- update challenge
DELETE /api/v1/admin/gamification/challenges/:id -- cancel challenge
POST   /api/v1/admin/gamification/quests     -- create custom quest
PUT    /api/v1/admin/gamification/quests/:id -- update quest
DELETE /api/v1/admin/gamification/quests/:id -- delete quest
GET    /api/v1/admin/gamification/flags      -- list flagged XP entries
PATCH  /api/v1/admin/gamification/flags/:id  -- resolve flag { status: 'confirmed' | 'revoked' }
POST   /api/v1/admin/gamification/reset      -- reset gamification data { scope: 'all' | 'user', user_id? }
POST   /api/v1/admin/gamification/export     -- export gamification data CSV
Auth: Bearer JWT. Role: admin only.
```

---

## Category 10 -- PgEventBus Events

### 10.1 Events consumed by gamification
| Event | Source Module | Action |
|---|---|---|
| `document.created` | signapps-docs | Award XP for document creation |
| `document.shared` | signapps-docs | Award XP for sharing |
| `email.sent` | signapps-mail | Award XP for email sent |
| `email.replied` | signapps-mail | Award XP for reply (check timing for bonus) |
| `event.created` | signapps-calendar | Award XP for meeting organized |
| `event.joined` | signapps-calendar | Award XP for meeting joined |
| `task.created` | signapps-calendar | Award XP for task creation |
| `task.completed` | signapps-calendar | Award XP for completion (check deadline for bonus) |
| `file.uploaded` | signapps-storage | Award XP for file upload |
| `contact.created` | signapps-contacts | Award XP for contact addition |
| `form.created` | signapps-forms | Award XP for form creation |
| `form.responded` | signapps-forms | Award XP for form response |
| `chat.message.sent` | signapps-chat | Award XP for message |
| `review.submitted` | signapps-docs | Award XP for review |
| `collab.brainstorm.participated` | signapps-collab | Award XP for brainstorm |

### 10.2 Events emitted by gamification
| Event | Trigger | Payload |
|---|---|---|
| `gamification.xp.earned` | XP awarded | `{ user_id, action, xp_earned, total_xp, new_level? }` |
| `gamification.level.up` | User levels up | `{ user_id, new_level, level_name }` |
| `gamification.badge.unlocked` | Badge unlocked | `{ user_id, badge_id, badge_name, rarity }` |
| `gamification.streak.broken` | Daily streak resets | `{ user_id, streak_was, best_streak }` |
| `gamification.streak.milestone` | Streak reaches 7, 30, 100 days | `{ user_id, streak_days, milestone }` |
| `gamification.challenge.completed` | Challenge ends with winner | `{ challenge_id, winner_id, winner_type }` |
| `gamification.quest.completed` | User completes a quest | `{ user_id, quest_id, quest_name }` |
| `gamification.kudos.sent` | Kudos sent | `{ sender_id, receiver_id, kudos_type }` |
| `gamification.milestone.reached` | Any notable event (for activity feed) | `{ user_id, milestone_type, description }` |
| `gamification.flag.detected` | Anti-gaming flag | `{ user_id, action, xp, reason }` |

---

## Category 11 -- Inter-Module Integration

### 11.1 Integration with all SignApps modules (XP triggers)
The gamification engine listens to PgEventBus events from all modules. It runs as a background Tokio task inside `signapps-gateway` (port 3099). For each event, it: (1) maps the event to an XP action, (2) checks anti-gaming rules, (3) awards XP, (4) evaluates badge criteria, (5) updates streak state. All operations are asynchronous and do not block the original action.

### 11.2 Integration with signapps-chat (port 3020)
- Activity feed messages posted to team channel for milestones (level-up, badge, streak, challenge winner)
- Kudos can be sent via chat command: `/kudos @alice thumbs_up Great work on the presentation!`
- Leaderboard summary posted weekly (Monday morning): "This week's top 3: 1. Alice (342 XP), 2. Bob (287 XP), 3. Charlie (245 XP)"

### 11.3 Integration with signapps-notifications (port 8095)
- Badge unlock notification (in-app + push)
- Level-up notification (in-app + push)
- Streak at-risk reminder ("You haven't done anything qualifying today. Your 12-day streak is at risk!" -- sent at 8pm if no action)
- Challenge start/end notifications
- Quest step completion notifications

### 11.4 Integration with signapps-identity (port 3001)
- User profile includes gamification section
- Level badge displayed next to user name in mentions, comments, and chat
- RBAC roles determine access to admin gamification features
- User privacy settings (leaderboard opt-in) stored in identity preferences

### 11.5 Integration with signapps-calendar (port 3011)
- Challenge dates visible as events in calendar
- XP multiplier events visible as banner events
- Meeting attendance tracked for XP (joined on time vs. late)

### 11.6 Integration with signapps-ai (port 3005)
- Quest recommendation: AI suggests quests based on user behavior patterns
- Challenge optimization: AI recommends challenge parameters (duration, criteria, reward) based on historical engagement data
- Anti-gaming: AI helps detect sophisticated gaming patterns beyond simple rate limiting

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Duolingo Blog** (blog.duolingo.com) -- articles sur la gamification, les streaks, les leagues, la retention utilisateur.
- **Habitica Wiki** (habitica.fandom.com) -- documentation sur le systeme RPG, les quests, les streaks, les rewards.
- **Todoist Karma** (todoist.com/help/articles/karma) -- documentation sur le systeme de karma points, niveaux, goals.
- **Octalysis Framework** (yukaichou.com/gamification-examples/octalysis-complete-gamification-framework) -- framework theorique de gamification, 8 core drives, White Hat vs Black Hat.
- **Spinify Resources** (spinify.com/resources) -- guides sur les leaderboards, les competitions, la gamification des ventes.
- **Bunchball / BI Worldwide** (biworldwide.com) -- etudes de cas enterprise gamification.
- **Gamification.co** -- articles et use cases sur la gamification en entreprise.
- **Extra Credits (YouTube)** -- series video sur le game design et la gamification appliquee.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Habitica** (github.com/HabitRPG/habitica) | **GPL-3.0** (serveur) / **MIT** (client mobile) | **INTERDIT** pour le serveur (GPL). Le client mobile MIT peut etre etudie pour les patterns UI de gamification (XP bar, streaks, badges). |
| **Framer Motion** (framer.com/motion) | **MIT** | Animations de celebration (level-up, badge unlock, confetti). Pattern pour les micro-interactions gamifiees. |
| **canvas-confetti** (github.com/catdad/canvas-confetti) | **ISC** | Effet confetti pour les celebrations (level-up, badge debloque, streak milestone). Leger et configurable. |
| **react-rewards** (github.com/thedevelobear/react-rewards) | **MIT** | Micro-animations de recompense (confetti, emoji rain, balloons) pour React. Pattern direct pour les feedbacks gamifies. |
| **Lottie / lottie-web** (github.com/airbnb/lottie-web) | **MIT** | Animations JSON (After Effects -> Web). Pattern pour les animations de badges et de level-up. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques de progression (XP over time, engagement trends). Deja utilise dans SignApps. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management pour le store gamification (XP, level, badges, streaks). Deja utilise dans SignApps. |
| **date-fns** (date-fns.org) | **MIT** | Calculs de streaks (jours consecutifs, semaines). Deja utilise dans SignApps. |
| **nanoid** (github.com/ai/nanoid) | **MIT** | Generation d'IDs courts pour les badges et quetes. Leger. |

### Pattern d'implementation recommande
1. **XP Engine** : background Tokio task dans `signapps-gateway`. Ecoute les evenements PgEventBus de tous les modules et attribue les XP selon le bareme configurable.
2. **Stockage** : tables PostgreSQL : `user_xp`, `xp_log`, `badge_definitions`, `user_badges`, `streaks`, `quests`, `user_quest_progress`, `challenges`, `kudos`.
3. **Badges** : evaluation des criteres a chaque gain d'XP. Query sur les compteurs (nombre de docs, taches, etc.) via les repositories existants. Attribution asynchrone pour ne pas ralentir l'action.
4. **Streaks** : cron job quotidien a minuit (organisation timezone). Pour chaque utilisateur, verifier si une action qualifiante a eu lieu dans les 24h. Incrementer ou reset le streak. Consommer un freeze si disponible.
5. **Leaderboard** : query PostgreSQL `ORDER BY weekly_xp DESC LIMIT 50`. Cache moka (signapps-cache) avec TTL 5 min. Invalidation sur nouveau gain d'XP.
6. **Animations** : `canvas-confetti` (ISC) pour les level-up et badge unlock. `framer-motion` (MIT) pour les micro-interactions. `Lottie` (MIT) pour les animations custom.
7. **Anti-gaming** : rate limiting via `signapps-cache` (moka). Max N actions XP par type par heure. Quality gates on each action. Burst detection with admin flagging.

---

## Assertions E2E cles (a tester)

- Creating a document generates a "+15 XP" toast and increments the XP counter
- Sending an email generates +5 XP
- Completing a task generates +10 XP (or +15 if before deadline)
- Completing a task before deadline with 3+ days margin generates +15 base + 5 bonus = +20 XP
- Level-up triggers a full-screen celebration animation with confetti
- The XP progress bar reflects the correct ratio of current XP to next level XP
- The XP history log lists gains by date, action, and module with correct totals
- The 30-day XP chart shows daily XP gains with correct values
- XP multiplier event doubles XP for affected actions during the event period
- The multiplier banner displays with correct countdown
- The "Inbox Zero" badge unlocks after 24h with zero unread emails
- Progressive badge "Author" upgrades from Bronze to Silver when threshold is reached
- Secret badges remain invisible in the catalog until unlocked
- Secret badge "Explorer" unlocks after using every module at least once
- Badge unlock notification displays with animation and confetti
- Pinning 3 badges on the profile displays them in the showcase section
- The daily streak increments at midnight if a qualifying action occurred
- The streak flame visual changes size/color at 7, 30, and 100 days
- Streak freeze automatically protects the streak for one day of inactivity
- Manual freeze activation preserves the streak for the selected date
- A broken streak preserves the "best streak" record
- The team streak increments only if all team members maintain individual streaks
- The weekly streak counts consecutive weeks meeting the goal (default: 5 tasks)
- The leaderboard only shows opted-in users
- The weekly leaderboard resets every Monday
- The leaderboard podium (top 3) displays with gold/silver/bronze styling
- The current user's position is always visible even if ranked 50th
- Module-specific leaderboard filters XP by the selected module
- The leaderboard history shows rank trend over past weeks
- Creating a challenge displays it on the challenge leaderboard with countdown
- Challenge completion awards the configured badge and XP to the winner
- The welcome quest "Discover SignApps" shows 0/8 progress for new users
- Completing a quest step increments progress and awards step XP
- Completing all 8 steps awards the "First Steps" badge and 200 XP bonus
- Advanced quests unlock after the welcome quest is completed
- Team quests show shared progress bar and award team XP on completion
- The gamified profile card displays level, XP, streak, and pinned badges
- Badge showcase page shows unlocked badges in color and locked badges grayed out
- The "Kudos" button sends kudos with +5 XP to recipient and +2 XP to sender
- Daily kudos limit (5) is enforced; 6th kudos attempt shows an error
- The activity feed posts milestone messages (level-up, badge) to team chat
- Admin can modify the XP schedule and changes apply to future actions
- Admin per-module toggle disables XP for a specific module
- The organization toggle disables all gamification UI elements globally
- Anti-gaming blocks XP for self-sent emails (sending to own address)
- Anti-gaming flags burst activity (>200 XP in 5 minutes)
- Admin can review flagged entries and confirm or revoke XP
- Full gamification reset (with typed confirmation) clears all data
- Retroactive recalculation with new XP schedule updates all user levels correctly
