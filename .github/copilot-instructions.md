# GitHub Copilot Instructions

You are a Senior Full-Stack Engineer and Productivity Systems Architect assisting with the "Life Operating System" project.

## 1. Project Context & User Persona
- **Goal:** Build a deterministic "Auto-Scheduler" (similar to Motion) for a busy Computer Engineering student (BYU), Entrepreneur, and Father.
- **Core Philosophy:** "Deterministic Execution, AI Reasoning." We use algorithms (Bin Packing) to place time blocks, and AI (Gemini) only to estimate durations and break down goals.
- **Critical Requirement:** The system must handle "Whole Semester" planning (90+ days) and prioritize Family Time above all else.

## 2. Tech Stack
- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS, ShadCN/UI.
- **Backend:** Next.js Server Actions, Supabase (PostgreSQL).
- **AI Engine:** Google Gemini 2.5 Flash (via `google-generativeai`).
- **Calendar Integrations:** Google Calendar API (Target), BYU Learning Suite iCal Feeds (Source).
- **Language:** TypeScript (Strict Mode).
- **Testing:** Jest (for algorithmic logic).

## 3. The "Whole Semester" Architecture
To handle 90-day planning without cluttering the user's life, we use a two-phase system:

### Phase A: Ingest & Enrich
- **Source:** Raw iCal feeds (Canvas/Learning Suite) are saved to Supabase first (Staging).
- **Enrichment:** A Gemini job analyzes assignment titles to:
  1. Estimate `duration_minutes` (e.g., "Final Project" -> 600 mins).
  2. Assign tags (e.g., `#deep-work`, `#exam-prep`).
  3. Set `can_split = true` for large items.

### Phase B: Soft vs. Hard Booking
- **Future (> 7 Days):** "Soft Planning." The algorithm calculates feasibility and stores "Virtual Blocks" in the database for heatmap visualization. These are NOT pushed to Google Calendar.
- **Current Week (0-7 Days):** "Hard Booking." Virtual blocks are converted to real Google Calendar events via a nightly Cron job or manual trigger.

## 4. Algorithmic Rules (The Scheduler)
The `scheduler.ts` logic must be a deterministic heuristic script adhering to these constraints:

### A. Variable Task Splitting (Chunking)
- **Logic:** If `Task.duration > 120 mins` AND `Task.canSplit === true`:
  - Split into chunks (Min: 30 mins, Max: 120 mins).
  - **Distribution:** Spread chunks across multiple days leading up to the deadline.
  - **Anti-Cramming:** Penalize scheduling >50% of the duration on the due date.

### B. Dependency & Exam Logic
- **Prerequisites:** If Task B depends on Task A, `Task B.start` MUST be `>= Task A.end`.
- **Exam Back-Planning:**
  - Input: "Midterm on Oct 20" (Fixed Event).
  - Action: Generate `Study Blocks` (Task) totaling X hours.
  - Distribution: Schedule these blocks in the 10 days *prior* to the event.

### C. Context & Location Awareness
- **Logic:** Check the `FixedEvent` immediately before/after a free slot to determine context.
  - **#campus:** Gap is between two BYU classes. Schedule: Lab reports, Library research.
  - **#home:** Gap is adjacent to "Home" block. Schedule: Deep coding, Recording videos.
  - **#anywhere:** Emails, Reading.

### D. Energy Profiles (Chronotypes)
- **Deep Work (Coding/Math):** Prioritize 08:00–12:00. Avoid post-14:00 if possible.
- **Shallow Work (Admin/Email):** Prioritize 13:00–15:00 (Post-lunch slump) or small gaps < 30 mins.

## 5. "Life Rules" (Constraints & Protections)
**These rules dictate the "Feasibility" of a schedule.**

### The "Family First" Protocol (Evening Protection)
- **Rule:** The time block `17:30` to `DayEnd` is **PROTECTED**.
- **Standard Behavior:** Treat this time as "Busy" for Business, Low Priority, and Standard Study tasks.
- **The Override Condition (Emergency Only):**
  - The algorithm may schedule a task here IF AND ONLY IF:
    1. The task is an `Assignment` (School).
    2. The task `deadline` is < 24 hours away.
    3. There are NO available slots between `08:00` and `17:30`.
- **Flag:** If this Override triggers, return a `warning_flag` ("Family Time Compromised").

### Hard Constraints
- **Sundays:** STRICTLY blocked for Faith/Family. No Business/School tasks allowed unless manually forced.
- **Date Night:** Fridays after 17:00 are blocked (Treat as Fixed Event).
- **Buffers:** Inject 15-min "Travel/Reset" buffer after every physical location change (e.g., Class -> Home).

## 6. Failsafes (Avoiding "Death Spirals")

### A. Anti-Fragmentation
- **Constraint:** Minimize splits. Prefer one 2-hour block over four 30-min blocks.
- **Rule:** If task is `#deep-work`, `min_chunk_size` must be >= 60 minutes. Do not schedule a 30-min coding block just because a gap exists.

### B. Overload Release Valve
- **Scenario:** `Total Duration` > `Free Time`.
- **Action:** Do NOT extend the day past `DayEnd`.
- **Logic:** Fill day to 100% with High Priority. Move remaining items to `Backlog` or `Next Day`. Return an `overloaded_tasks` array to the UI.

### C. Sync Conflict Resolution
- **Direction:** One-way Push (App -> Google Calendar).
- **Deletion Logic:** If user deletes a block in GCal -> Update Task status to `Skipped` (NOT `Done`). It returns to the pool for the next scheduling run.

## 7. Database Schema Hints
- **Table `goals`:** `id`, `category` (Spiritual, Business, etc.), `title`, `deadline`.
- **Table `tasks`:** - `id`, `goal_id`, `title`, `duration_minutes`, `deadline`, `priority`
  - `min_chunk_size`, `max_chunk_size`, `context_tags` (Array)
  - `is_assignment` (Boolean), `can_split` (Boolean)
  - `scheduled_start`, `scheduled_end` (Nullable)