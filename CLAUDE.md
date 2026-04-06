# CLAUDE.md — SSREI Real Estate Wholesaling CRM

> This file is the authoritative reference for AI-assisted development of this project.
> Read it fully before making any changes.

---

## 1. Project Overview

**SSREI** (Single-Family Real Estate Investment) is a full-stack real estate wholesaling CRM web application. It provides a complete workflow for managing leads, contacts, properties, buyers, sellers, and acquisition pipelines — with deep bidirectional synchronization to GoHighLevel (GHL) for pipeline and opportunity management.

### Purpose
- Import and score property/contact leads from CSV files (sourced from Deal Automator)
- Manage a contact database with rich property data, distress scoring, and DNC detection
- Sync leads into GHL as opportunities and maintain real-time bidirectional status/tag updates
- Support multi-user teams with role-based access (Admin, Agent, Viewer)

### Target Users
Real estate wholesaling teams — specifically acquisition managers, agents, and admins who need to track motivated sellers, manage pipeline stages, and coordinate with GHL-based marketing workflows.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3.1 + TypeScript, Vite 5.4.2, Tailwind CSS 3.4.1 |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth |
| CRM Integration | GoHighLevel (GHL) API v2 |
| Icons | Lucide React |
| Deployment | Vercel (frontend), Supabase (backend), GitHub Actions (CI/CD) |

---

## 2. Project Structure

```
project/
├── src/
│   ├── App.tsx                   # Root routing + auth orchestration
│   ├── main.tsx                  # React entry point
│   ├── components/               # Shared UI components
│   │   ├── detail/               # Contact detail section panels
│   │   └── ui/                   # Reusable primitives (AnimatedGradientText, BorderBeam, etc.)
│   ├── context/
│   │   ├── AuthContext.tsx       # Auth state, user roles, permissions
│   │   ├── RouterContext.tsx     # Client-side SPA routing
│   │   └── ThemeContext.tsx      # Theme management
│   ├── hooks/
│   │   ├── useLeads.ts
│   │   ├── useNotificationCount.ts
│   │   └── useSettings.ts
│   ├── lib/
│   │   ├── ghl.ts               # GHL API client (all GHL calls go here)
│   │   ├── scoring.ts           # Distress scoring algorithm
│   │   ├── csvParser.ts         # CSV-to-contact field mapping
│   │   ├── csvAnalyzer.ts       # CSV column detection and analysis
│   │   ├── duplicateDetection.ts# Duplicate contact matching
│   │   └── supabase.ts          # Supabase client singleton
│   ├── pages/                   # 11 page-level components
│   └── types/index.ts           # All TypeScript interfaces and enums
├── supabase/
│   ├── functions/
│   │   ├── ghl-proxy/           # Edge function: proxies GHL API calls from frontend
│   │   └── ghl-webhook/         # Edge function: receives inbound webhooks from GHL
│   └── migrations/              # 24 ordered SQL migration files
├── .github/workflows/
│   ├── deploy.yml               # Deploys ghl-proxy edge function
│   └── supabase-deploy.yml      # Deploys ghl-webhook edge function
├── vercel.json                  # Vercel routing + SPA rewrites
├── vite.config.ts               # Vite dev server + proxy config
├── tailwind.config.js
└── index.html
```

### Key Entry Points

| File | Role |
|---|---|
| `src/App.tsx` | Top-level routing, auth guard, layout shell |
| `src/lib/ghl.ts` | All GoHighLevel API interactions |
| `src/lib/scoring.ts` | Distress score calculation (Hot/Warm/Lukewarm/Cold) |
| `supabase/functions/ghl-proxy/index.ts` | Backend API gateway for GHL |
| `supabase/functions/ghl-webhook/index.ts` | Handles GHL-originated events |

---

## 3. Features Implemented

### Core CRM
- **Dashboard** — Real-time stats cards, recent activity feed, onboarding setup checklist
- **Contacts** — Full CRUD list with search, multi-filter, bulk operations, CSV export
- **Contact Detail** — Deep-dive view with tabbed panels: Overview, Comparables, Loans, Pre-Foreclosures, Property Insights, Transactions, Notes, Documents, Activity Log, Offers
- **Lead Import** — CSV batch upload with column detection, field mapping, validation, distress scoring, and DNC/litigator flagging on ingest
- **Pipeline (Kanban)** — Drag-and-drop board; stage changes sync bidirectionally with GHL
- **Opportunities** — GHL opportunity listing and management
- **Buyers** — Buyer profile management with property criteria matching
- **Sellers** — Seller network management

### Data Intelligence
- **Distress Scoring** — Automated algorithm producing Hot / Warm / Lukewarm / Cold / No Signal tier per contact
- **DNC Detection** — Per-phone DNC flagging; aggregated at the property/contact level
- **Litigator Detection** — Flag contacts identified as litigators during import
- **Duplicate Detection** — Address and phone-based deduplication on import
- **LTV / AVM / Mortgage Balance** — Calculated and displayed per property

### GHL Bidirectional Sync (latest major feature)
- Push local contacts to GHL as Opportunities (with custom field mapping)
- Pull GHL Opportunity stage changes back into local DB via webhook
- Bidirectional tag synchronization (local tags ↔ GHL contact tags)
- DNC/litigator status sync to GHL
- Bulk GHL push operations
- Opportunity deletion from GHL

### Bulk Email
- **BulkEmailModal** — Select specific contacts (with checkboxes), enter additional addresses, pick batch or individual mode, sends via `mailto:` to user's local email client. Triggered from the bulk action bar when contacts are selected.

### Administration
- **User Roles** — Admin, Agent, Viewer with granular permission checks
- **Settings Page** — Store and update GHL API key, Location ID, Pipeline ID
- **Team Invitations** — Invite users to the workspace
- **Notifications** — In-app alerts with unread count badge
- **Activity Logging** — Full audit trail per contact

---

## 4. Recent Updates / Changelog

### 2026-04-07 — Bulk Email Modal (Bolt.new update)
- Added `BulkEmailModal` component to `ContactsPage.tsx`
- Per-contact checkbox selection (all selected by default) with Select All / Deselect All toggle
- Additional email address input (supports comma, semicolon, or newline-separated entries with live validation)
- Send mode toggle: "Batch (All at once)" vs "Individual (Personalized)"
- Real-time recipient counter in header and on Send button
- Green pill previews for parsed additional email addresses
- Send opens `mailto:` with all recipient addresses (uses user's local email client)
- "Email" button added to the bulk action bar (visible when contacts are selected)

| Commit | Change |
|---|---|
| `12e75ed` | feat: complete GHL bidirectional tag sync and final refinements |
| `04e3c31` | feat: enable GHL dual-sync and final webhook refinements |
| `91e05b9` | Add GitHub Actions workflow for deployment |
| `5f06c1f` | chore: update supabase project reference in vercel.json |
| `97dfcff` | fix: resolve duplicate type definitions in src/types/index.ts |
| `8ffe9a7` | feat: sync GHL custom fields and restore inbound webhook |
| `7bae485` | Add backend diagnostic scripts |
| `708a7e5` | Add SQL to fix RLS policies for anonymous access |
| `5ea4265` | Add Supabase schema master setup script and missing columns |

**Recent focus:** GHL synchronization completeness (tags, custom fields, webhook reliability), schema stabilization, CI/CD automation, and bulk email UX.

---

## 5. In-Progress / Pending Features

- No explicit TODO comments exist in source as of last review
- Areas likely to need continued work based on codebase shape:
  - Advanced saved search / filter presets
  - Analytics / reporting dashboards beyond the dashboard stats cards
  - Document management (upload/download is scaffolded but may be incomplete)
  - Mobile responsiveness audit
  - Follow-up automation triggers from within the CRM
  - Expanded GHL custom field mappings as field list grows

---

## 6. Development Guidelines

### Running Locally

```bash
# Install dependencies
npm install

# Start dev server (includes Vite proxy for GHL and Supabase)
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

Vite dev server runs at `http://localhost:5173`. GHL API calls are proxied through `/api/ghl-proxy` → Supabase edge function.

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GHL_API_KEY=<pit-...>
VITE_GHL_LOCATION_ID=<location-id>
VITE_GHL_PIPELINE_ID=<pipeline-id>
```

All `VITE_` prefixed variables are exposed to the frontend bundle. Do not store secrets beyond what GHL and Supabase require here.

Edge functions receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically from the Supabase runtime.

### Coding Conventions
- **TypeScript strict mode** — All types live in `src/types/index.ts`; don't scatter inline type declarations
- **All GHL API calls** route through `src/lib/ghl.ts` — never call the GHL API directly from a component
- **Supabase calls** should use the singleton from `src/lib/supabase.ts`
- **Permissions** are checked via `AuthContext` — use the `hasPermission()` helper, not raw role string comparisons
- Component files follow PascalCase; hooks are `useXxx.ts`; lib files are camelCase
- Tailwind utility classes only — no custom CSS files

### Database Migrations
- All schema changes go in `/supabase/migrations/` as numbered SQL files
- Run locally with `supabase db push` or apply via Supabase dashboard
- RLS policies are critical — always verify anonymous and authenticated access after schema changes

---

## 7. Key Integrations

### GoHighLevel (GHL) API v2
- **Base URL:** `https://services.leadconnectorhq.com`
- **Auth:** Bearer token (`VITE_GHL_API_KEY`)
- **Proxy:** All frontend GHL calls go through the `ghl-proxy` Supabase edge function to avoid CORS and protect the API key
- **Webhook:** GHL sends contact/opportunity update events to the `ghl-webhook` edge function (deployed with `--no-verify-jwt` for public access)
- **Scope:** Contacts, Opportunities, Pipelines, Tags, Custom Fields

### Supabase
- **Database:** PostgreSQL with 15+ tables, JSONB fields, GIN indexes
- **Auth:** Supabase Auth with JWT; user profiles stored in `user_profiles` table with role column
- **Edge Functions:** Deno-based serverless functions for backend logic
- **RLS:** Row-level security enabled; anon key has restricted read/write access

### Deal Automator
- External property data source
- Contacts imported via CSV export from Deal Automator
- `src/lib/csvParser.ts` maps Deal Automator CSV columns to the internal contact schema

---

## 8. Deployment

### Frontend — Vercel
- Auto-deployed on push to `main`
- `vercel.json` rewrites `/api/ghl-proxy` to the Supabase edge function URL
- SPA fallback: all routes rewrite to `/index.html`
- Supabase project reference for Vercel deployment: `wcrcjmhgoukgpqqyfoma`

### Backend — GitHub Actions

**`deploy.yml`** — triggers on changes to `supabase/functions/**`:
```bash
supabase functions deploy ghl-proxy --use-api --debug
```

**`supabase-deploy.yml`** — triggers on push to `main`:
```bash
supabase functions deploy ghl-webhook --no-verify-jwt
```

Both workflows require the following GitHub secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

### Database Migrations
Apply via Supabase CLI:
```bash
supabase db push
```
Or manually via the Supabase SQL editor for hotfixes. 24 migration files exist; run in order.

---

## 9. Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `contacts` | Core entity — property + owner data, 60+ columns + JSONB |
| `import_batches` | Tracks each CSV import session |
| `user_profiles` | Extends Supabase auth with role and workspace info |
| `buyers` | Buyer profiles for deal matching |
| `sellers` | Seller network |
| `leads` | Acquisition/commercial lead records |
| `contact_notes` | Per-contact communication notes |
| `contact_documents` | File attachment metadata |
| `contact_activity_log` | Immutable audit trail |
| `notifications` | User alert queue |
| `app_settings` | GHL credentials and app-level configuration |
| `offers` | Offer tracking per contact |

---

## 10. Key Notes for AI Agents

- **Do NOT overwrite `vercel.json`** from Bolt.new exports. The local version contains the critical `/api/ghl-proxy` → Supabase rewrite rule that Bolt drops. Losing it silently breaks all GHL API calls in production.
- **Do NOT overwrite `.env`** from Bolt.new exports. Bolt strips the GHL credentials (`VITE_GHL_API_KEY`, `VITE_GHL_LOCATION_ID`, `VITE_GHL_PIPELINE_ID`). The local `.env` has them.
- **Bolt.new exports** typically only include root-level config files. Actual feature changes land in `src/` — read the changelog description and implement manually.
- **Email sending** uses `mailto:` (opens the user's local email client). There is no SMTP or transactional email service wired up.
- **Bulk action bar** (`ContactsPage.tsx`) is only visible when `selected.size > 0`. New bulk actions must add both a button there and a modal/state pair below.
- **Pre-existing TypeScript errors** exist in `LeadImportPage.tsx`, `LeadListPage.tsx`, and `SellersPage.tsx` — do not treat these as regressions from new changes.
- **Contact email field** is `contact1_email1` (flat column). Additional contacts may have emails in `contacts_json[].emails[]`.

---

## 9. Database Schema (Key Tables)

Notable column patterns on `contacts`:
- `contacts_json` (JSONB) — flexible overflow storage for contact sub-records
- `dnc_flags` (array) — per-phone DNC status
- `ghl_contact_id`, `ghl_opportunity_id` — GHL sync foreign keys
- `distress_score`, `distress_tier` — computed scoring output
