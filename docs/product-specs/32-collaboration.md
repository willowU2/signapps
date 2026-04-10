# Module Visual Collaboration -- Functional Specification

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Miro** | Infinite canvas, 250+ templates, sticky notes, mind maps, flowcharts, wireframes, Talktrack async video, voting, timer, presentation mode, 100+ integrations, real-time collaboration, clusters, tags, comments, frames |
| **FigJam** | Whiteboard collaboratif integre Figma, stamps/reactions inline, AI-generated templates, widgets (voting, countdown, music), sections, connectors, audio chat integre, Dev Mode bridge |
| **Lucidspark** | Brainstorming visuel, freehand drawing, sticky notes, voting, timer, breakout boards, emoji reactions, action items, integrations (Lucidchart, Jira, Slack), templates collaboratifs |
| **Whimsical** | Mind maps elegants, flowcharts, wireframes, docs -- le tout dans un seul outil. Auto-layout intelligent, shortcuts clavier rapides, templates, nested boards, AI mind map generation |
| **MindMeister** | Mind mapping leader, collaboration temps reel, modes (mind map, org chart, outline), export PDF/PNG, integration MeisterTask, themes, focus mode, history playback, presentations |
| **XMind** | Mind mapping professionnel, structures multiples (logic chart, org chart, tree, fishbone, matrix, timeline, brace), themes, markers, labels, export multi-format, pitch mode |
| **Coggle** | Mind maps collaboratifs simples, branches colorees drag-and-drop, loops (liens cross-branches), images inline, history playback, export PDF/PNG/text, real-time multi-user |
| **Mural** | Facilitation visuelle, templates design thinking, icebreakers, voting, timer, private mode, facilitator superpowers, rooms, integrations enterprise, accessibility features |
| **Excalidraw** | Whiteboard open source (MIT), hand-drawn style, real-time collab, library d'elements, end-to-end encryption, embeddable, offline-first, export SVG/PNG |
| **Notion AI / Notion Boards** | Bases de donnees en vue Kanban, mind maps via integrations, AI brainstorming, linked databases, toggle blocks pour l'arborescence, templates |
| **Trello** | Kanban reference, cards drag-and-drop, power-ups, Butler automation, checklists, due dates, labels, members, attachments, calendar view, timeline view |
| **Jira Board** | Kanban/Scrum boards, sprint planning, backlog grooming, swimlanes, WIP limits, quick filters, board configuration, automation rules, release tracking |

## Principes directeurs

1. **Infinite canvas, no page boundaries** -- the workspace is a zoomable, pannable canvas with no borders. The user never runs out of space. Elements are positioned freely.
2. **Multi-mode, one workspace** -- Mind Map, Kanban, Brainstorm, and Meeting Board are views of the same collaborative space. Elements created in one mode are visible in others when relevant.
3. **Native real-time collaboration** -- every action (node creation, card movement, sticky note placement) is propagated in < 200ms to all participants via CRDT (Yjs through signapps-collab).
4. **AI as co-creator** -- AI can generate mind maps from a topic, suggest ideas during brainstorming, summarize session results, and structure meeting boards.
5. **Keyboard-first accessibility** -- all actions are achievable via keyboard. Navigate between nodes with Tab/arrows. Add nodes with Enter. Screen readers announce the structure.
6. **Export and integration** -- visual artifacts (mind maps, boards) export to PNG/SVG/PDF and integrate into Docs, Mail, and Slides as images or interactive embeds.

---

## Category 1 -- Mind Map Editor

### 1.1 Root node creation
A mind map starts with a central root node (main topic). Text is editable by double-click. The root node is centered on the canvas and cannot be deleted (only renamed). Default styling: `bg-primary text-primary-foreground rounded-xl px-6 py-3 text-lg font-semibold shadow-lg`. On creation, the root node pulses once (scale 1.0 -> 1.05 -> 1.0, 300ms) to draw attention.

### 1.2 Adding child nodes
Select a node, then press `Tab` or click the `+` button (appears on hover, right side of the node) to create a connected child node. The child is connected by a curved branch. `Enter` creates a sibling node (same level as the selected node). Auto-layout adjusts positions to avoid overlap. Default direction: right-expanding (configurable). New nodes enter with a fade-in + slide-from-parent animation (200ms).

### 1.3 Inline text editing
Double-click on a node activates inline editing. Multi-line text supported (Shift+Enter for new line within the node). Basic markdown: `**bold**`, `*italic*`, `[link](url)`. `Escape` validates and exits edit mode. `Enter` (without Shift) also validates. The node auto-resizes to fit content with a minimum width of 80px and maximum of 300px.

### 1.4 Node styles
Each node is customizable via a context panel (right-click or toolbar):
- **Background color**: palette of 12 preset colors + custom hex picker
- **Border color**: separate from background
- **Shape**: rectangle (default), ellipse, diamond, cloud, hexagon, rounded rectangle
- **Icon**: emoji picker or icon library (Lucide icons)
- **Image**: small image (max 100x100px) displayed inside the node
- **Font size**: S (12px), M (14px, default), L (18px), XL (24px)
Child nodes auto-inherit the parent's color scheme unless overridden. Style inheritance follows the branch: root -> level 1 gets color A, level 2 gets color B (configurable color palette per branch).

### 1.5 Branches and connectors
Branches connecting parent to child are stylable:
- **Color**: per-branch or inherited from parent (each root branch gets a distinct hue from the color palette)
- **Thickness**: thin (1px), normal (2px, default), thick (3px)
- **Style**: curved bezier (default), straight, orthogonal (right angles)
- **Animation**: optional pulse animation on branch creation (subtle glow traveling from parent to child)
Auto-layout adjusts branch positions to avoid crossing. When nodes are moved manually, branches follow with smooth 150ms transition.

### 1.6 Drag-and-drop reparenting
Drag a node to move it. If dragged onto another node, it becomes that node's child (reparenting). Visual feedback: target node highlights with `ring-2 ring-primary` border. If dragged into empty space, the node becomes a floating orphan (disconnected from the tree). Undo with `Ctrl+Z`. Drop animation: 200ms ease-out snap to new position.

### 1.7 Fold/Unfold (collapse/expand)
Click the `-` icon on a node to collapse its children (hide the sub-branch). The icon changes to `+` and a count badge shows "5 children". Click `+` to expand. Keyboard shortcut: `Space` on a selected node toggles fold/unfold. Fold animation: children slide toward parent and fade out (200ms). Unfold reverses. Useful for navigating large mind maps.

### 1.8 Lite mode
Toggle "Lite Mode" in the toolbar: simplifies display by hiding icons, images, colors (all nodes become white with gray border), and showing only text. Useful for printing or focused reading. Toggle back restores all styling. Keyboard shortcut: `Ctrl+Shift+L`.

### 1.9 Auto-layout and layout algorithms
"Reorganize" button applies automatic layout. Layout selector dropdown:
- **Right** (classic mind map, default): root on the left, children expand right
- **Left**: root on the right, children expand left
- **Radial** (centered): root in the center, children radiate outward
- **Top-Down** (org chart): root at top, children below
- **Fishbone** (Ishikawa diagram): horizontal spine with angled branches
- **Timeline** (horizontal chronological): nodes arranged left-to-right by order

Layout computed via D3 tree layout algorithm with custom spacing. Transition animation: all nodes slide to new positions simultaneously (400ms ease-in-out).

### 1.10 Cross-branch links
Create a visual link (dashed arrow) between two nodes on different branches. Click source node, then `Ctrl+Click` destination node. A dashed arrow with an optional label appears. Useful for showing cross-cutting relationships. Links are bidirectional (no arrow direction) or directional (with arrowhead). Style: `stroke-dasharray: 5,5` with `stroke-opacity: 0.6`. Label: editable text on hover.

### 1.11 Notes and comment threads on nodes
Right-click a node -> "Add note" opens a rich text panel attached to the node. The note content is not displayed directly on the canvas; only a small note indicator icon appears on the node. Comments: right-click -> "Comment" opens a threaded discussion panel. @mentions supported. Comments are displayed in a side panel listing all threads for the board.

### 1.12 Node metadata
Each node can carry metadata:
- **Priority**: high/medium/low (colored dot indicator)
- **Assignee**: user avatar displayed on the node
- **Due date**: date badge below the node
- **Tags**: colored tag chips
- **Progress**: percentage bar (0-100%)
Metadata is optional and displayed as small indicators around the node edges.

### 1.13 Mind map settings
Settings panel for the entire mind map:
- **Canvas background**: white (default), light gray, dotted grid, line grid
- **Global theme**: Classic, Dark, Pastel, Monochrome, Colorful
- **Default direction**: right, left, radial, top-down
- **Node spacing**: compact, normal (default), spacious
- **Default font**: system font (default), serif, monospace
- **Branch style**: curved (default), straight, orthogonal

---

## Category 2 -- Kanban Board

### 2.1 Configurable columns
Kanban has user-named columns (e.g., To Do, In Progress, In Review, Done). Add column: click `+` at the right end. Rename: double-click the column header. Delete: right-click -> Delete (with confirmation if column has cards). Reorder: drag column header left/right. Column header background uses `bg-muted`. Maximum 12 columns.

### 2.2 Kanban cards
Each card contains:
- **Title** (text, required, editable inline)
- **Description** (markdown, expandable on card click)
- **Assignees** (user avatars, multi-select)
- **Labels** (colored tags, up to 5)
- **Due date** (date badge; overdue dates shown in red)
- **Priority** (badge: Urgent/High/Medium/Low with color)
- **Checklist** (progress bar showing X/Y items completed)
- **Attachments** (count badge with paperclip icon)
- **Comments** (count badge with bubble icon)

Quick add: text input at the bottom of each column. Type title and press `Enter` to create a minimal card. Click the card to open the detail panel.

### 2.3 Drag-and-drop card movement
Drag a card from one column to another to change its status. Drag vertically within a column to reorder by priority. Visual feedback: card lifts with `shadow-xl` and slight rotation (2deg), drop zone shows a blue dashed outline. Implemented via `dnd-kit` (MIT). Animation: card slides to new position (200ms ease-out). CRDT sync ensures all participants see the move within 200ms.

### 2.4 WIP limits
Configure a maximum card count per column (e.g., max 5 in "In Progress"). When the limit is reached:
- Column header shows a warning icon (orange triangle)
- Column background changes to `bg-orange-50`
- Dragging a new card into the column shows a confirmation dialog: "This column has reached its limit (5/5). Add anyway?"
- Admin can make WIP limits strict (block) or advisory (warn)

### 2.5 Card filters and search
Filter bar above the board:
- **Assignee** (avatar selector, multi-select)
- **Label** (color/name selector)
- **Priority** (dropdown)
- **Due date** (overdue, due this week, due this month, no date)
- **Text search** (searches title and description)
Non-matching cards are dimmed (`opacity-30`) rather than hidden, so the board structure remains visible. Reset filters button clears all.

### 2.6 Swimlanes
Horizontal divisions across the board: by project, by team, by type, or custom. Each swimlane has its own row of columns. Swimlane header: collapsible with click, shows name and card count. Drag cards between swimlanes. Add swimlane: button at the bottom. Reorder swimlanes by drag.

### 2.7 Compact/detailed view toggle
- **Compact**: cards show title + assignee avatar only (3 lines max). Dense layout.
- **Detailed**: cards show all fields (title, description excerpt, assignees, labels, due date, checklist progress). Standard layout.
Toggle via button in the toolbar. State persisted per user. Keyboard shortcut: `Ctrl+Shift+V`.

### 2.8 Basic automations
Rule engine for simple automations (configurable per board):
- "When a card enters [column], notify [user]"
- "When a card enters [Done], set completed_at to now"
- "When due date is passed, add [Overdue] label"
- "When all checklist items are checked, move to [In Review]"
- "When a card is created, assign to [user]"
Rules are displayed in a table: trigger, condition, action, enabled toggle. Admin creates rules via a form with dropdowns.

### 2.9 Kanban analytics
Panel showing:
- **Cycle time**: average days from "In Progress" to "Done" (line chart over time)
- **Throughput**: cards completed per week (bar chart)
- **WIP over time**: cards in each column per day (stacked area chart)
- **Aging**: cards in "In Progress" sorted by age (oldest first, with color: green <3d, yellow 3-7d, red >7d)

---

## Category 3 -- Brainstorm and Ideation

### 3.1 Sticky notes on canvas
Infinite canvas with virtual sticky notes of varied colors. Create a note: double-click on empty canvas space (creates a note at that position) or click the "Add Sticky" button in the toolbar. Text is editable inline. Notes are resizable by dragging corners. Stacking (overlapping) is allowed. Default size: 150x150px. Colors: yellow (default), pink, green, blue, orange, purple. Each color maps to a configurable category.

### 3.2 Color-category mapping
Each sticky note color represents a category (configurable by the facilitator):
- Yellow: Ideas
- Pink: Problems
- Green: Solutions
- Blue: Questions
- Orange: Actions
- Purple: Wild cards
Legend displayed as a horizontal bar at the top of the canvas: colored circles with labels. Clicking a legend item filters the canvas to show only that category (others are dimmed).

### 3.3 Clustering (affinity mapping)
Drag multiple sticky notes close together to auto-create a cluster. The cluster gets a dashed border and a title input. Alternatively: select multiple notes (Shift+Click or lasso selection) -> right-click -> "Group as cluster". Clusters are collapsible (click the cluster title to fold/unfold). Cluster title is editable. Drag the cluster border to move all contained notes. Useful for affinity mapping after a brainstorm.

### 3.4 Dot voting
Facilitator activates "Vote" mode via a toolbar button. Each participant gets N votes (configurable: default 3). Click on a sticky note to cast a vote. Vote count displayed as a badge on the note (`bg-primary text-primary-foreground rounded-full w-6 h-6` badge in the top-right corner). Participant's own votes are indicated by a small dot under the badge. Facilitator can "Reveal results" (if votes were hidden) and "Sort by votes" (rearranges notes in descending vote order). Facilitator can reset votes.

### 3.5 Session timer
Visible countdown timer in the top-right corner of the canvas. Facilitator sets duration: preset buttons (3m, 5m, 10m, 15m) or custom input. Timer shows `MM:SS` in large text. Visual states: normal (white text), warning (<1 minute, orange pulsing text), expired (red text + sound chime via Web Audio API). Timer is synchronized across all participants via CRDT. Facilitator can pause, resume, or reset the timer.

### 3.6 Private mode (silent brainstorm)
Facilitator activates "Private Mode". Each participant writes their notes, but notes from other participants are hidden (shown as blank cards with "?" icon). The facilitator sees all notes in real-time (facilitator privilege). When the facilitator clicks "Reveal All", all notes become visible simultaneously with a staggered fade-in animation (50ms delay per note). This prevents cognitive anchoring. After reveal, normal mode resumes.

### 3.7 AI ideation
"Generate AI Ideas" button with a sparkle icon. Opens a dialog:
- **Topic**: auto-filled from the board title, editable
- **Count**: slider (3-15 ideas, default 7)
- **Style**: creative, analytical, provocative, practical (radio buttons)
AI generates N sticky notes with ideas via `signapps-ai` (port 3005) `POST /api/v1/ai/generate`. Each generated note appears with a sparkle icon indicator. The user can accept (keep the note), reject (delete), or edit each one. Accepted notes lose the sparkle icon and become regular notes.

### 3.8 Conversion to tasks
Select one or more sticky notes -> right-click -> "Convert to tasks". Creates tasks in the Calendar/Tasks module with:
- Task title: note text
- Task description: "Created from brainstorm session [board name] on [date]"
- Back-link: link from the task to the brainstorm board
A confirmation dialog shows the tasks to be created. After creation, converted notes get a small link icon badge.

### 3.9 Session summary
"Summarize Session" button. AI generates a structured summary via `signapps-ai`:
- **Topic**: board title
- **Participants**: list of participants
- **Duration**: session time
- **Themes identified**: clustered categories with counts
- **Top ideas** (by votes): ranked list
- **Decisions made**: extracted from notes tagged as "Actions"
- **Next steps**: action items with assignees (if specified)
Output: rich text in a side panel. Export options: PDF, Markdown, send via email (opens compose in Mail module).

---

## Category 4 -- Meeting Board

### 4.1 Meeting board template
Pre-structured board with sections (each section is a framed area on the canvas):
- **Agenda** (left, blue frame): list of agenda items
- **Notes** (center, white frame): collaborative notes area
- **Decisions** (bottom-left, green frame): recorded decisions
- **Actions** (bottom-right, orange frame): action items
- **Parking Lot** (right sidebar, gray frame): topics deferred to future meetings
Each section has a colored header and is independently scrollable. Sections can be resized by dragging the frame borders.

### 4.2 Interactive agenda
List of agenda items with:
- **Title** (text, editable)
- **Duration** (minutes, number input)
- **Owner** (user avatar selector)
- **Per-item timer**: clicking "Start" on an agenda item starts a countdown for that item's allocated duration
- **Status**: pending (gray), current (blue, pulsing), completed (green checkmark), skipped (strikethrough)

Total duration displayed at the top: "Total: 45 min | Elapsed: 12 min | Remaining: 33 min". Alert when an item exceeds its allocated time: item border turns red, toast notification "Agenda item [title] has exceeded its time by [N] minutes". Facilitator advances items with a "Next" button or by clicking the next item.

### 4.3 Collaborative notes
Rich text area in the Notes section with real-time collaborative editing (Yjs CRDT via signapps-collab). Multiple participants type simultaneously with colored cursors and name labels. Formatting: headings, bold, italic, lists, checkboxes. @mentions trigger notifications. The notes section is essentially an embedded mini-editor (subset of the Docs module Tiptap editor).

### 4.4 Decisions section
Each decision is a card with:
- **Text** (description of the decision)
- **Date** (auto-filled with today)
- **Approved by** (multi-select users who approve)
- **Status**: proposed, approved, rejected
Click "Approve" to add your name to the approvers list. Decisions are exportable and referenceable: each decision gets a unique ID (e.g., "DEC-2026-0012") that can be cited in other modules.

### 4.5 Action items
Each action item is a card with:
- **Description** (text, required)
- **Assignee** (user avatar, required)
- **Deadline** (date picker)
- **Priority** (high/medium/low)
- **Status**: open, in progress, done

"Create as Task" button pushes the action to the Calendar/Tasks module with all fields. Once synced, the action item shows a link icon and status updates bidirectionally (completing the task in Calendar marks the action as "done" in the meeting board).

### 4.6 Parking lot
Section for off-topic items raised during the meeting. Each item: text + raised-by user. Items can be "Promoted" to an agenda item for the next meeting (creates a draft agenda item in a future meeting board). Items can also be dismissed (strikethrough).

### 4.7 Participants and presence
Participant list panel showing:
- Avatar, name, online/offline indicator (green/gray dot)
- Role: facilitator (crown icon), participant, observer (eye icon)
- Join/leave timestamps
Presence is real-time via WebSocket awareness (Yjs). Facilitator can mute/unmute participants (controls who can edit vs. view-only). Integration with Calendar: participants are auto-populated from the calendar event's attendee list. Integration with Meet: if a video call is active, a "Join Meet" button appears.

### 4.8 Meeting history archive
Chronological list of past meeting boards accessible from the sidebar. Each entry: meeting title, date, participant count, action items count (completed/total). Click to open the archived board (read-only unless reopened by facilitator). Search across meeting history by text (full-text search on notes, decisions, and actions).

---

## Category 5 -- Canvas and Drawing Tools

### 5.1 Infinite canvas navigation
- **Zoom**: mouse wheel (or pinch on trackpad) from 10% to 400%. Zoom level displayed in the bottom-left corner. Double-click on zoom indicator resets to 100%.
- **Pan**: middle-click drag, or `Space` + left-click drag. Two-finger drag on trackpad.
- **Minimap**: small overview in the bottom-right corner showing the entire canvas with a viewport rectangle. Click on the minimap to jump to that area.
- **Fit to screen**: button (or `Ctrl+Shift+F`) that zooms and pans to fit all elements in the viewport with 5% padding.

### 5.2 Geometric shapes
Toolbar insert menu: rectangle, ellipse, diamond, triangle, star (5-point), arrow (block), line, polyline, text box, image. Each shape is:
- **Resizable**: corner handles with aspect-ratio lock (hold `Shift`)
- **Rotatable**: rotation handle at the top (15-degree snap with `Shift`)
- **Colorable**: fill color + border color + border width + border style (solid, dashed, dotted)
- **Text inside**: double-click to add text inside any shape
- **Selectable**: single-click to select, `Shift+Click` for multi-select, lasso drag for area select

### 5.3 Freehand drawing
Pencil mode activated by toolbar button or `D` key. Draw freehand on the canvas. Settings: color (palette), thickness (1-10px slider), opacity (0-100%), smoothing (auto-smooth curves). Eraser mode: `E` key, erases strokes by intersection. Freehand strokes are vector paths (SVG) for clean export. Each stroke is an independent element (selectable, movable, deletable).

### 5.4 Smart connectors
Create an arrow between two elements: hover over source element -> connector anchor point appears (blue dot on each side) -> drag from anchor to destination element. Connector types: straight arrow, curved arrow, orthogonal (right-angle) arrow, no arrow (line). Label on the connector: double-click to add/edit text. Connectors maintain attachment when elements are moved (auto-reroute). Connector color and thickness are configurable.

### 5.5 Frames (grouping)
Create a frame: toolbar "Frame" button, then draw a rectangle on the canvas. Frame has:
- **Title** (top-left, editable)
- **Background color** (subtle, `opacity-10`)
- **Border** (dashed, configurable color)
Moving the frame moves all elements inside it. Elements can be dragged in/out of frames. Frames are used for: sections in a brainstorm, slides in presentation mode, organizing the canvas. Frames can be nested (one frame inside another).

### 5.6 Images and media
Insert images: upload from file, paste from clipboard, drag from Drive, URL input. Images are resizable and support: crop (double-click to enter crop mode), rotation, border, shadow, opacity. Insert video embeds: YouTube, SignApps Meet recordings (pasted URL auto-converts to a player widget). Insert PDF: shows first-page thumbnail, click to open in a viewer overlay.

### 5.7 Canvas templates
Template library accessible via "New Board" or toolbar button:
- **Business Model Canvas** (9 sections)
- **SWOT Analysis** (4 quadrants)
- **Lean Canvas** (9 sections)
- **User Journey Map** (horizontal timeline with lanes)
- **Retrospective** (Start / Stop / Continue columns)
- **Sprint Planning** (backlog + sprint columns)
- **Design Thinking** (Empathize / Define / Ideate / Prototype / Test phases)
- **Meeting Board** (Agenda / Notes / Decisions / Actions)
- **Mind Map** (central node with 4 branches)
- **Blank canvas**
Templates pre-populate elements and frames. User can save any board as a custom template.

---

## Category 6 -- Real-Time Collaboration (CRDT)

### 6.1 Cursor presence
Each participant has a colored cursor (arrow icon) with their name label visible to others. Cursor position is broadcast in real-time via Yjs awareness protocol through `signapps-collab` (port 3013). Colors are assigned from a palette (12 distinct hues). Cursors fade after 10 seconds of inactivity (reduce to 30% opacity). Cursor update rate: 60fps locally, throttled to 15fps for network broadcast.

### 6.2 Selection awareness
When a participant selects elements (nodes, cards, shapes), other participants see the selection as a colored outline (`ring-2`) matching the selector's cursor color. Prevents edit conflicts: if Alice is editing a node's text, Bob sees a lock icon and "Alice is editing" tooltip on that node.

### 6.3 CRDT synchronization
All board state (nodes, cards, sticky notes, shapes, connectors, text) is synchronized via Yjs CRDT documents. One Yjs document per board. WebSocket connection to `signapps-collab` (port 3013). Conflict resolution: CRDT guarantees eventual consistency without conflicts. Offline changes are queued and merged on reconnection. Sync latency target: < 200ms for all operations.

### 6.4 Undo/Redo with collaboration
`Ctrl+Z` (undo) and `Ctrl+Shift+Z` (redo) operate on the current user's actions only (not other participants' actions). Undo stack is per-user. If Alice undoes her action, Bob's view reflects the reversal, but Bob's undo stack is unchanged. Implemented via Yjs `UndoManager`.

### 6.5 Offline support
Board works offline with full editing capabilities. Changes are stored locally in IndexedDB (via Yjs persistence adapter). When reconnecting:
1. Local changes are sent to the server
2. Remote changes are received and merged
3. CRDT resolution handles any conflicts
4. UI updates to reflect the merged state
Offline indicator: yellow banner "You are offline. Changes will sync when reconnected."

---

## Category 7 -- Comment Threads and Annotations

### 7.1 Anchored comments
Right-click on any element (node, card, shape, sticky note) -> "Comment". Opens a comment thread panel on the right side. Each comment has: author avatar + name, timestamp, text (markdown supported), @mentions. Reply threading with indentation. Resolve button archives the thread (element loses the comment indicator).

### 7.2 Comment panel
Side panel listing all comment threads for the board. Filters: open threads, resolved threads, my mentions, all threads. Each thread shows: element preview, last comment, timestamp, unresolved count. Click on a thread to pan/zoom to the element and highlight it.

### 7.3 Reactions and stamps
Toolbar "Stamp" mode: select from a library of stamps (checkmark, question mark, exclamation, heart, thumbs up, star, flag, X mark). Click on any element or canvas location to place the stamp. Stamps are small (24x24px) and positioned relative to the element. Each stamp shows the placer's initials on hover. Used for asynchronous feedback (e.g., reviewer stamps a checkmark on approved items).

---

## Category 8 -- Export and Integration

### 8.1 Export to PNG
"Export" -> "PNG". Options:
- Selection only / entire canvas / specific frame
- Resolution: 1x (72 DPI), 2x (144 DPI, default for retina), 4x (288 DPI, for print)
- Background: transparent or white
Rendered via `html2canvas` (MIT) or native Canvas API. Download as `[board-name]-[date].png`.

### 8.2 Export to SVG
Vector export preserving all shapes, text, and connectors. Editable in Illustrator/Inkscape. File size optimized (no embedded raster images unless the board contains uploaded images).

### 8.3 Export to PDF
Export the canvas or selected frames as a PDF document:
- One frame per page (for presentation-style boards)
- Entire canvas on one page (scaled to fit)
- A4/Letter page size selection
Generated via `jsPDF` (MIT) or `@react-pdf/renderer` (MIT).

### 8.4 Export Kanban to CSV
Export Kanban board as CSV: columns = board metadata, each row = one card with fields: title, description, column (status), assignees, labels, due date, priority, checklist progress, created date. Importable into project management tools.

### 8.5 Export meeting board to Markdown
Export meeting board as a structured Markdown document:
```
# Meeting: [Title] - [Date]
## Participants: [list]
## Agenda
1. [Item] (Owner: [name], Duration: [min])
...
## Notes
[collaborative notes content]
## Decisions
- DEC-2026-0012: [text] (Approved by: [names])
...
## Actions
- [ ] [description] (@assignee, due: [date])
...
## Parking Lot
- [item] (raised by: [name])
```

### 8.6 Embed in other modules
A collaboration board can be inserted into:
- **Docs** (signapps-docs): as an interactive embed (iframe-style, resizable) or as a static PNG snapshot
- **Email** (signapps-mail): as a PNG attachment with a link to the live board
- **Calendar** (signapps-calendar): link in the event description
Embed URL format: `/collab/boards/:id/embed?theme=light&frame=frame-1`.

### 8.7 Presentation mode
Navigate the canvas frame by frame like a slideshow:
- Each frame = one slide
- Order: top-left to bottom-right (or manually ordered in the frame list panel)
- Navigation: arrow keys, click, or presenter remote
- Transitions: smooth zoom/pan animation between frames (500ms ease-in-out)
- Laser pointer: press and hold `L` to show a red dot that follows the cursor (visible to all in real-time)
- Full-screen mode
- Presenter notes (optional text per frame, visible only to the presenter)
Exit presentation: `Escape` or click the exit button.

### 8.8 Version history and playback
Timeline of board modifications accessible via "History" button. Versions are auto-saved every 5 minutes and on significant actions. Features:
- **Version list**: timestamp, author, change summary ("Added 3 nodes", "Moved 5 cards")
- **Restore**: click "Restore this version" to revert (creates a new version, does not delete history)
- **Playback**: animated replay of the board's construction from creation to current state. Playback speed: 1x, 2x, 5x, 10x. Useful for reviewing how a brainstorm or mind map evolved.

---

## Category 9 -- PostgreSQL Schema

### 9.1 collab_boards table
```sql
CREATE TABLE collab_boards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    title           TEXT NOT NULL,
    board_type      TEXT NOT NULL,  -- 'mind_map', 'kanban', 'brainstorm', 'meeting', 'canvas', 'template'
    template_id     UUID REFERENCES collab_board_templates(id),
    owner_id        UUID NOT NULL REFERENCES users(id),
    yjs_doc_id      TEXT NOT NULL UNIQUE,  -- Yjs document identifier for CRDT sync
    settings        JSONB NOT NULL DEFAULT '{}',  -- theme, layout, background, etc.
    thumbnail_url   TEXT,  -- auto-generated thumbnail for preview
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    meeting_event_id UUID,  -- link to calendar event if meeting board
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_boards_org ON collab_boards (org_id, is_archived, updated_at DESC);
CREATE INDEX idx_collab_boards_owner ON collab_boards (owner_id);
CREATE INDEX idx_collab_boards_meeting ON collab_boards (meeting_event_id) WHERE meeting_event_id IS NOT NULL;
```

### 9.2 collab_board_permissions table
```sql
CREATE TABLE collab_board_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'editor',  -- 'owner', 'editor', 'commenter', 'viewer'
    link_token  TEXT UNIQUE,  -- for share-by-link access
    link_role   TEXT,         -- role for link-based access
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_perms_board ON collab_board_permissions (board_id);
CREATE INDEX idx_collab_perms_user ON collab_board_permissions (user_id);
```

### 9.3 collab_nodes table (mind map nodes)
```sql
CREATE TABLE collab_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES collab_nodes(id) ON DELETE SET NULL,
    text            TEXT NOT NULL DEFAULT '',
    node_type       TEXT NOT NULL DEFAULT 'topic',  -- 'root', 'topic', 'floating'
    position_x      DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y      DOUBLE PRECISION NOT NULL DEFAULT 0,
    width           DOUBLE PRECISION,
    height          DOUBLE PRECISION,
    style           JSONB NOT NULL DEFAULT '{}',  -- color, shape, icon, font_size, etc.
    metadata        JSONB NOT NULL DEFAULT '{}',  -- priority, assignee_id, due_date, tags, progress
    is_collapsed    BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_nodes_board ON collab_nodes (board_id);
CREATE INDEX idx_collab_nodes_parent ON collab_nodes (parent_id);
```

### 9.4 collab_kanban_columns table
```sql
CREATE TABLE collab_kanban_columns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    wip_limit   INTEGER,  -- null = no limit
    color       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_columns_board ON collab_kanban_columns (board_id, sort_order);
```

### 9.5 collab_kanban_cards table
```sql
CREATE TABLE collab_kanban_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id       UUID NOT NULL REFERENCES collab_kanban_columns(id) ON DELETE CASCADE,
    board_id        UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    swimlane_id     UUID REFERENCES collab_kanban_swimlanes(id),
    title           TEXT NOT NULL,
    description     TEXT,
    assignee_ids    UUID[] NOT NULL DEFAULT '{}',
    labels          JSONB NOT NULL DEFAULT '[]',  -- [{ name, color }]
    priority        TEXT DEFAULT 'medium',  -- 'urgent', 'high', 'medium', 'low'
    due_date        DATE,
    checklist       JSONB NOT NULL DEFAULT '[]',  -- [{ text, checked }]
    attachments     JSONB NOT NULL DEFAULT '[]',  -- [{ name, url, size }]
    sort_order      INTEGER NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    linked_task_id  UUID,  -- link to calendar task if converted
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_cards_column ON collab_kanban_cards (column_id, sort_order);
CREATE INDEX idx_kanban_cards_board ON collab_kanban_cards (board_id);
CREATE INDEX idx_kanban_cards_assignee ON collab_kanban_cards USING GIN (assignee_ids);
```

### 9.6 collab_kanban_swimlanes table
```sql
CREATE TABLE collab_kanban_swimlanes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_collapsed BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_swimlanes_board ON collab_kanban_swimlanes (board_id, sort_order);
```

### 9.7 collab_sticky_notes table (brainstorm)
```sql
CREATE TABLE collab_sticky_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    cluster_id      UUID REFERENCES collab_sticky_clusters(id) ON DELETE SET NULL,
    text            TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT 'yellow',
    position_x      DOUBLE PRECISION NOT NULL,
    position_y      DOUBLE PRECISION NOT NULL,
    width           DOUBLE PRECISION NOT NULL DEFAULT 150,
    height          DOUBLE PRECISION NOT NULL DEFAULT 150,
    votes           INTEGER NOT NULL DEFAULT 0,
    voter_ids       UUID[] NOT NULL DEFAULT '{}',
    is_ai_generated BOOLEAN NOT NULL DEFAULT false,
    linked_task_id  UUID,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sticky_notes_board ON collab_sticky_notes (board_id);
CREATE INDEX idx_sticky_notes_cluster ON collab_sticky_notes (cluster_id);
```

### 9.8 collab_sticky_clusters table
```sql
CREATE TABLE collab_sticky_clusters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT '',
    position_x  DOUBLE PRECISION NOT NULL,
    position_y  DOUBLE PRECISION NOT NULL,
    width       DOUBLE PRECISION NOT NULL DEFAULT 400,
    height      DOUBLE PRECISION NOT NULL DEFAULT 300,
    is_collapsed BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sticky_clusters_board ON collab_sticky_clusters (board_id);
```

### 9.9 collab_comments table
```sql
CREATE TABLE collab_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES collab_boards(id) ON DELETE CASCADE,
    element_id      UUID NOT NULL,  -- references any element (node, card, sticky, shape)
    element_type    TEXT NOT NULL,   -- 'node', 'card', 'sticky', 'shape'
    parent_id       UUID REFERENCES collab_comments(id) ON DELETE CASCADE,  -- for threading
    author_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    is_resolved     BOOLEAN NOT NULL DEFAULT false,
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_comments_board ON collab_comments (board_id);
CREATE INDEX idx_collab_comments_element ON collab_comments (element_type, element_id);
```

### 9.10 collab_board_templates table
```sql
CREATE TABLE collab_board_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID REFERENCES organizations(id),  -- null = global template
    name        TEXT NOT NULL,
    description TEXT,
    board_type  TEXT NOT NULL,
    template_data JSONB NOT NULL,  -- serialized board structure (nodes, columns, frames, etc.)
    thumbnail_url TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,  -- true for built-in templates
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_templates_org ON collab_board_templates (org_id);
```

---

## Category 10 -- REST API Endpoints

### 10.1 Board CRUD
```
GET    /api/v1/collab/boards                 -- list boards (filters: type, archived, owner)
POST   /api/v1/collab/boards                 -- create board { title, board_type, template_id? }
GET    /api/v1/collab/boards/:id             -- get board details + elements
PUT    /api/v1/collab/boards/:id             -- update board (title, settings)
DELETE /api/v1/collab/boards/:id             -- archive board (soft delete)
POST   /api/v1/collab/boards/:id/duplicate   -- duplicate board
Auth: Bearer JWT. Permissions checked per board.
```

### 10.2 Board sharing
```
GET    /api/v1/collab/boards/:id/permissions -- list permissions
POST   /api/v1/collab/boards/:id/permissions -- add user { user_id, role }
PUT    /api/v1/collab/boards/:id/permissions/:pid -- update role
DELETE /api/v1/collab/boards/:id/permissions/:pid -- revoke access
POST   /api/v1/collab/boards/:id/share-link  -- generate share link { role }
Auth: Bearer JWT. Role: owner only for permission management.
```

### 10.3 Mind map nodes
```
GET    /api/v1/collab/boards/:id/nodes       -- list all nodes (tree structure)
POST   /api/v1/collab/boards/:id/nodes       -- create node { parent_id, text, style }
PUT    /api/v1/collab/boards/:id/nodes/:nid  -- update node (text, style, position, parent_id)
DELETE /api/v1/collab/boards/:id/nodes/:nid  -- delete node (cascades to children)
Auth: Bearer JWT. Role: editor+.
```

### 10.4 Kanban endpoints
```
GET    /api/v1/collab/boards/:id/columns     -- list columns with cards
POST   /api/v1/collab/boards/:id/columns     -- create column { title, wip_limit }
PUT    /api/v1/collab/boards/:id/columns/:cid -- update column
DELETE /api/v1/collab/boards/:id/columns/:cid -- delete column

POST   /api/v1/collab/boards/:id/cards       -- create card { column_id, title, ... }
PUT    /api/v1/collab/boards/:id/cards/:cid  -- update card
DELETE /api/v1/collab/boards/:id/cards/:cid  -- delete card
PATCH  /api/v1/collab/boards/:id/cards/:cid/move -- move card { column_id, sort_order }
Auth: Bearer JWT. Role: editor+.
```

### 10.5 Brainstorm endpoints
```
POST   /api/v1/collab/boards/:id/sticky-notes -- create sticky note { text, color, position }
PUT    /api/v1/collab/boards/:id/sticky-notes/:sid -- update
DELETE /api/v1/collab/boards/:id/sticky-notes/:sid -- delete
POST   /api/v1/collab/boards/:id/vote         -- cast vote { sticky_note_id }
DELETE /api/v1/collab/boards/:id/vote/:sid     -- remove vote
POST   /api/v1/collab/boards/:id/reveal        -- reveal all notes (facilitator only)
POST   /api/v1/collab/boards/:id/ai-ideate     -- generate AI ideas { topic, count, style }
POST   /api/v1/collab/boards/:id/summarize     -- generate AI session summary
Auth: Bearer JWT. Role: editor+ (facilitator for reveal/ai).
```

### 10.6 Comments
```
GET    /api/v1/collab/boards/:id/comments    -- list comments (filters: element_id, resolved)
POST   /api/v1/collab/boards/:id/comments    -- create comment { element_id, element_type, content, parent_id? }
PUT    /api/v1/collab/boards/:id/comments/:cid -- update comment
DELETE /api/v1/collab/boards/:id/comments/:cid -- delete comment
PATCH  /api/v1/collab/boards/:id/comments/:cid/resolve -- resolve thread
Auth: Bearer JWT. Role: commenter+.
```

### 10.7 Export
```
POST   /api/v1/collab/boards/:id/export       -- export board { format: 'png'|'svg'|'pdf'|'csv'|'md', options: {...} }
Response 200: { download_url: string, expires_at: iso8601 }
Auth: Bearer JWT. Role: viewer+.
```

### 10.8 Templates
```
GET    /api/v1/collab/templates              -- list templates (system + org)
POST   /api/v1/collab/templates              -- create template from board { board_id, name, description }
DELETE /api/v1/collab/templates/:id          -- delete custom template
Auth: Bearer JWT. Role: editor+ for create, viewer+ for list.
```

---

## Category 11 -- PgEventBus Events

### 11.1 Events consumed by collaboration
| Event | Source | Action |
|---|---|---|
| `calendar.event.created` | signapps-calendar | Auto-create meeting board if event type is "meeting" |
| `calendar.event.updated` | signapps-calendar | Update meeting board participants |
| `calendar.event.deleted` | signapps-calendar | Archive associated meeting board |

### 11.2 Events emitted by collaboration
| Event | Trigger | Payload |
|---|---|---|
| `collab.board.created` | New board created | `{ board_id, board_type, owner_id }` |
| `collab.action.created` | Action item created in meeting board | `{ action_id, board_id, assignee_id, description, deadline }` |
| `collab.task.converted` | Sticky note or action converted to task | `{ board_id, source_type, task_id }` |
| `collab.meeting.summarized` | AI summary generated | `{ board_id, summary_text }` |
| `collab.brainstorm.completed` | Facilitator ends brainstorm session | `{ board_id, note_count, cluster_count, vote_count }` |

---

## Category 12 -- Inter-Module Integration

### 12.1 Integration with signapps-collab (port 3013)
All real-time CRDT synchronization flows through the collab service. One Yjs document per board. WebSocket endpoint: `ws://localhost:3013/ws/collab/:yjs_doc_id`. Awareness protocol handles cursor presence and selection sharing.

### 12.2 Integration with signapps-calendar (port 3011)
- Meeting boards are auto-created when a calendar event of type "meeting" is created
- Participants are synced from the event attendee list
- Action items can be pushed to the Calendar/Tasks module
- Meeting board link is added to the calendar event description

### 12.3 Integration with signapps-ai (port 3005)
- AI ideation: `POST /api/v1/ai/generate` with topic and parameters
- Session summary: `POST /api/v1/ai/summarize` with session data
- Mind map generation from text: `POST /api/v1/ai/structure` returns a tree JSON

### 12.4 Integration with signapps-docs (port 3010)
- Boards can be embedded in documents as interactive iframes or static PNG snapshots
- Meeting notes can be exported to a Docs document

### 12.5 Integration with signapps-storage (port 3004)
- Uploaded images and attachments stored via the storage service
- Board thumbnails auto-generated and stored for preview in board lists
- Exported files (PNG, SVG, PDF) temporarily stored with 24h expiry

### 12.6 Integration with signapps-notifications (port 8095)
- @mention in comments triggers notification
- Action item assignment triggers notification
- Brainstorm invitation triggers notification
- Meeting board ready notification when auto-created from calendar event

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Miro Academy** (miro.com/academy) -- guides sur le brainstorming, l'affinity mapping, le design thinking, les templates.
- **FigJam Help** (help.figma.com/figjam) -- documentation sur les widgets, stamps, connectors, audio chat, templates.
- **Whimsical Help** (whimsical.com/help) -- documentation sur les mind maps, flowcharts, wireframes, raccourcis clavier.
- **MindMeister Help** (support.mindmeister.com) -- guides sur le mind mapping collaboratif, les structures, les modes de presentation.
- **XMind Blog** (xmind.app/blog) -- tutoriels sur les structures de mind map, les use cases, les bonnes pratiques.
- **Excalidraw Blog** (blog.excalidraw.com) -- articles sur l'architecture CRDT, le rendering canvas, la collaboration temps reel.
- **Mural Blog** (mural.co/blog) -- guides sur la facilitation visuelle, les icebreakers, le design thinking.
- **Trello Guide** (trello.com/guide) -- documentation sur les boards Kanban, les power-ups, les automatisations Butler.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Excalidraw** (github.com/excalidraw/excalidraw) | **MIT** | Whiteboard collaboratif canvas. Reference architecturale pour le canvas infini, les elements, la collaboration CRDT. |
| **tldraw** (github.com/tldraw/tldraw) | **Apache-2.0** | Canvas collaboratif avec dessin libre, formes, connecteurs. Pattern pour le rendering et les interactions. |
| **reactflow** (github.com/xyflow/xyflow) | **MIT** | Diagrammes de flux interactifs React. Pattern pour les connecteurs, les noeuds drag-and-drop, le zoom/pan. |
| **markmap** (github.com/markmap/markmap) | **MIT** | Mind map depuis Markdown. Pattern pour le rendu SVG de mind maps et l'auto-layout. |
| **jsmind** (github.com/hizzgdev/jsmind) | **BSD-2-Clause** | Mind map library JS legere. Pattern pour les operations de noeuds (add, move, fold). |
| **Yjs** (github.com/yjs/yjs) | **MIT** | CRDT pour la collaboration temps reel. Deja utilise dans SignApps. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop accessible React. Pattern pour le Kanban et le rearrangement d'elements. |
| **react-beautiful-dnd** (github.com/atlassian/react-beautiful-dnd) | **Apache-2.0** | Drag-and-drop pour les listes (Kanban). Pattern pour les colonnes et les cartes. |
| **Rough.js** (github.com/rough-stuff/rough) | **MIT** | Rendering hand-drawn style. Pattern pour un style visuel distinctive "croquis". |
| **Konva.js** (github.com/konvajs/konva) | **MIT** | Canvas 2D HTML5 avec event system. Pattern pour les formes, les transformations, le hit detection. |
| **Fabric.js** (github.com/fabricjs/fabric.js) | **MIT** | Canvas interactif (objets, groupes, events, serialization JSON). Pattern pour le canvas partage. |

### Pattern d'implementation recommande
1. **Canvas** : `tldraw` (Apache-2.0) ou `Excalidraw` (MIT) comme base canvas. Rendering via HTML5 Canvas ou SVG selon la complexite.
2. **Mind Map** : `markmap` (MIT) pour le rendu SVG + layout D3 custom. Donnees en arbre JSON synchronise via Yjs.
3. **Kanban** : `dnd-kit` (MIT) pour le drag-and-drop. State Zustand. Colonnes et cartes stockees en base (repository pattern).
4. **Collaboration** : Yjs (MIT) + y-websocket pour la synchronisation temps reel de tous les modes. Un document Yjs par board.
5. **Brainstorm** : sticky notes comme elements canvas avec proprietes (couleur, texte, position, votes). Voting via compteurs Yjs partages.
6. **Meeting Board** : template structure avec zones (agenda, notes, decisions, actions). Notes via Yjs shared text. Actions convertibles en taches via API Tasks.
7. **Export** : `html2canvas` (MIT) pour le PNG. SVG export natif. PDF via `jsPDF` (MIT).

---

## Assertions E2E cles (a tester)

- A mind map displays an editable root node centered on the canvas
- Tab on a selected node creates a connected child node
- Enter on a selected node creates a sibling node
- Double-click on a node activates inline text editing
- Drag-and-drop of a node onto another reparents it (visual feedback on drop target)
- Fold/Unfold hides/shows children of a node with animation
- The fold badge shows the count of hidden children
- Lite Mode simplifies display to text-only (no colors, no icons)
- Auto-layout reorganizes the mind map cleanly without node overlap
- Cross-branch link creates a dashed arrow between two nodes on different branches
- Kanban displays columns with cards in the correct order
- Dragging a card from one column to another changes its status
- Quick-add input at the bottom of a column creates a new card on Enter
- WIP limits show a warning when the column limit is reached
- Card filters by assignee/label dim non-matching cards
- Swimlanes divide the board horizontally with independent card placement
- Compact view shows only title and assignee; detailed view shows all fields
- Kanban automation rules execute correctly (e.g., move card when checklist complete)
- Sticky notes are created by double-clicking on the brainstorm canvas
- Color-category legend displays and filters notes by category
- Dot voting: clicking a note casts a vote; vote count badge updates
- "Sort by votes" rearranges notes in descending vote order
- Private mode hides others' notes; "Reveal All" shows them with animation
- Session timer counts down and alerts (visual + sound) when time expires
- AI ideation generates sticky notes with sparkle icon; accept/reject works
- "Convert to tasks" creates tasks in the Calendar module with back-link
- Session summary generates a structured text with themes, top ideas, and actions
- Meeting board displays Agenda, Notes, Decisions, Actions, and Parking Lot sections
- Agenda per-item timer alerts when time is exceeded
- Collaborative notes show multiple cursors with user names
- Action items created in meeting board sync with the Tasks module
- Canvas zoom (10%-400%) and pan work smoothly
- Geometric shapes are insertable, resizable, rotatable, and colorable
- Smart connectors between shapes follow element movements
- Freehand drawing creates vector strokes that are selectable and movable
- Frames group elements and move them together
- Presentation mode navigates frame-by-frame with smooth transitions
- Export PNG produces a high-resolution image of the canvas
- Export SVG produces an editable vector file
- Export PDF generates a document with one frame per page
- Real-time collaboration shows other participants' cursors
- Comments anchored on elements are visible in the side panel
- Offline editing works; changes sync on reconnection
- Undo (Ctrl+Z) reverses only the current user's actions
- Version history shows past versions; restore creates a new version
- Playback mode animates the board construction from start to current state
