# Adaptive Presence OS

Sprint 0, Sprint 1, and Sprint 2 MVP for an adaptive AI-powered digital presence operating system.

The first working flows are:

Client Brief -> OpenAI structured analysis -> Client Presence Blueprint -> PostgreSQL via Prisma -> admin dashboard.

Client Presence Blueprint -> OpenAI structured planning -> Monthly Operating Plan -> PostgreSQL via Prisma -> admin dashboard.

Planned Content Item -> OpenAI structured draft generation -> Content Draft -> manager review.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- OpenAI API with Structured Outputs
- Zod validation before saving

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Update `.env`:

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adaptive_presence_os?schema=public"
   OPENAI_API_KEY="sk-proj-replace-me"
   TEXT_MODEL_DEFAULT="gpt-5.4"
   TEXT_MODEL_PREMIUM="gpt-5.5"
   TEXT_MODEL_FAST="gpt-5.4-mini"
   TEXT_MODEL_STRATEGY="gpt-5.5"
   TEXT_MODEL_MONTHLY_PLAN="gpt-5.5"
   TEXT_MODEL_CONTENT="gpt-5.4"
   TEXT_MODEL_CREATIVE_BRIEF="gpt-5.4"
   ```

4. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

5. Generate the Prisma client and create tables:

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

6. Start the dashboard:

   ```bash
   pnpm dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## What Sprint 0 Includes

- Create a client.
- Store the raw client brief.
- Generate a custom Client Presence Blueprint using OpenAI Structured Outputs.
- Validate the generated structure with Zod before persistence.
- Store the full raw structured blueprint and normalized child entities.
- View client summary, business goals, platform recommendations, selected modules, monthly scope, cadence, automations, risk rules, approval mode, and manager attention level.

## What Sprint 1 Includes

- Generate a Monthly Operating Plan from an existing Client Presence Blueprint.
- Block monthly plan generation when `nextRecommendedAction` is `request_more_brief_data`.
- Validate the generated monthly plan against the Blueprint before saving.
- Store the full raw structured monthly plan and normalized child entities.
- View active modules, selected platforms, planned content items, manager tasks, approval strategy, autopublish strategy, and risk summary.

Sprint 1 does not generate full post, article, email, or caption text. It only creates the operational plan and planned content items as structured data.

## Sprint 1 Acceptance

- Live Blueprint generation works.
- Live Monthly Plan generation works.
- Data persists in PostgreSQL via Prisma.
- Vercel deployment works.
- Neon database works.
- OpenAI Structured Outputs work after validation hardening.

## What Sprint 2 Includes

- Add the Content Draft Layer.
- Generate one structured Content Draft from one `PlannedContentItem`.
- Store drafts in PostgreSQL via Prisma and show them in the internal Manager Console.
- Keep drafts review-ready without publishing them automatically.
- Require manager or client approval when the plan or safety rules require it.
- Preserve safety rules for healthcare, legal, financial, regulated, and reputation-sensitive content.

## Sprint 2.1 Channel Orchestration

- Monthly Plans now include basic cross-channel orchestration.
- Planned content items can include week, campaign theme, content pillar, channel role, and sequence reason.
- This is the first step toward the future Marketing Brain.

## Sprint 2.2 Visual Product Foundation

- The internal app is framed as Adaptive Presence OS by Creative.
- The Manager Console now uses a premium dashboard shell with clearer workspace hierarchy.
- Blueprint, Monthly Plan, and Content Draft review areas are easier to scan during daily operations.
- Calendar and Events are visible future product areas without adding unfinished integrations or publishing logic.

## Sprint 2.3 Calendar-first Product UI

- The Manager Console now leads with a calendar-first operations view.
- Weekly and monthly previews are derived from existing Monthly Plan content items.
- A Client Preview panel shows the future approval-focused Client Portal direction.
- Calendar and Events areas clarify the next operational product layers without adding real auth or publishing.

## Sprint 2.4 Manager Console Polish

- The Manager Console now uses a stronger command-center hierarchy with a derived attention queue.
- Calendar cards and Client Preview are more product-like and easier to scan during daily operations.
- Intake forms remain available as secondary onboarding controls.
- No auth, publishing, or external integrations were added.

## Sprint 2.5 Dream Mockup Rebuild

- The UI was rebuilt toward premium SaaS product mockups while preserving the existing core flow.
- A denser Command Center and Operations Overview now lead the Manager Console.
- Content Calendar is the central production workspace with week columns and an item inspector.
- Client Portal Preview now communicates the future approval-focused client experience more clearly.

## Sprint 3A Approval Workflow Data Layer

- Content Draft approval workflow statuses, review event storage, and server actions are available.
- Each workflow action updates the draft and stores an operational review event.
- Approval workflow UI comes next.

## Sprint 3B Review Queue UI

- Review Queue UI groups drafts by workflow status.
- Managers can move drafts through review states and inspect the review event timeline.
- No real client auth, notifications, or publishing were added.

## Sprint RU-1 Russian-first UI

- Russian-first UI copy was added for the Manager Console.
- Code, schemas, and API contracts remain in English.
- The product remains Adaptive Presence OS by Creative.
- The Russian market is the primary go-to-market context.

## Sprint 3C Review Workflow UX Stabilization

- Review Workflow UX was stabilized.
- Russian labels were added for approval statuses and actions.
- The workflow remains available in the Manager Console only.
- No real client auth, notifications, or publishing were added.

## Sprint 4A Scheduling Layer

- The Scheduling Layer was added.
- Approved and ready drafts can become scheduled publications.
- Scheduling is internal and manual for now.
- No real external publishing or automation was added.

## Sprint 4B Calendar Operations

- Calendar Operations were added.
- Scheduled publications can be updated, marked as needing assets, ready, skipped, or removed from the schedule.
- The calendar prioritizes scheduled publications and falls back to Monthly Plan previews when no schedule exists.
- No real external publishing or automation was added.

## Sprint 5A Creative Asset Layer

- The Creative Asset Layer was added.
- Scheduled publications can now have structured visual or video briefs.
- Creative assets have production statuses for preparation and approval.
- No real image or video generation and no external design integrations were added.

## Sprint 5B AI Creative Brief Generation

- AI Creative Brief Generation was added.
- The system can generate structured visual or video briefs for scheduled publications.
- Generated briefs remain editable and follow the same Creative Asset production workflow.
- Actual image or video generation was not added.

## Sprint 5B.1 Creative Brief UX Clarity

- Creative Brief UX clarity was improved.
- AI brief generation is now more visible when a publication needs a creative asset.
- Creative briefs can be regenerated through AI without creating duplicates.
- Creative Asset cards show whether a brief was created through AI or manually.
- Actual image generation was not added.

## Sprint 5C Visual Generation Layer

- The Visual Generation Layer was added.
- Creative Assets can generate one image variant at a time through the OpenAI Images API.
- Generated variants are stored as base64 in PostgreSQL for the MVP.
- Variants can be reviewed, approved, rejected, or deleted.
- No external object storage, publishing, Figma integration, or video generation was added.
- Set `OPENAI_IMAGE_MODEL` to choose the image model.

## Sprint 5C.1 Premium Visual Engine

- Premium Visual Engine was added.
- OpenAI visual generation now supports configurable provider, model, quality, size, and text rendering mode.
- `gpt-image-2` is the intended premium default where available.
- The provider abstraction is ready for a future Google Nano Banana / Gemini Image adapter.
- Generated variants store provider, model, quality, size, text mode, and manual quality-review metadata.
- Manual quality review was added before client-facing use.
- External object storage is still not added.

## Sprint UI-1 Manager Console Cleanup

- The Manager Console layout was stabilized without changing business logic.
- The Overview was simplified with compact operational previews and workspace shortcuts.
- Status colors were unified and the sidebar was softened.
- Review, scheduling, creative asset, and visual production sections were made more compact.
- Creative brief, prompt, metadata, and secondary controls are now disclosed progressively when needed.

## Sprint UI-2 Workspace Views

- The Manager Console was converted from one long page into focused workspace views.
- Sidebar navigation now switches URL-based views while preserving the selected client Blueprint and monthly plan.
- Client creation and client setup were separated from the Overview.
- Approvals, calendar operations, publication materials, creative assets, reports, and settings now have dedicated screens.
- AI creative actions remain visible in the Creative Assets view.
- The manager-facing workflow is publication-centric: internal `ContentDraft` records are presented as publication texts or materials.
- Publication cards show text readiness and provide visible actions to generate, regenerate, or open the material.
- No database schema, Prisma model, or OpenAI prompt changes were made.

## Sprint AI-1 Premium Text Model Router

- A configurable text model router was added for premium intelligence tasks.
- `gpt-4.1-mini` is no longer the default premium intelligence layer.
- Text generation now uses task-based model routing.
- Strategy and Monthly Plan generation can use `TEXT_MODEL_STRATEGY` and `TEXT_MODEL_MONTHLY_PLAN`, with `gpt-5.5` as the premium default.
- Publication texts and creative briefs use configurable `gpt-5.4` defaults.
- Fast or internal tasks can use `TEXT_MODEL_FAST`, with `gpt-5.4-mini` as the default.
- Reasoning effort can be tuned with `TEXT_REASONING_EFFORT_STRATEGY`, `TEXT_REASONING_EFFORT_CONTENT`, and `TEXT_REASONING_EFFORT_CREATIVE`.
- `OPENAI_MODEL` remains available as a backward-compatible fallback when the newer text model variables are not set.

## Sprint Product-1.1 Material Workspace Usability

- Material Workspace usability was improved around publication-centric cards.
- Publication text can be edited directly from a material card.
- Editing previously approved text returns the material to review.
- Every material now shows the next recommended operational action.
- Creative brief and premium visual generation actions are available from material details.
- No database schema or OpenAI prompt changes were made.

## Sprint Product-2A Prepare Month Autopilot MVP

- Prepare Month Autopilot MVP was added.
- Managers can generate missing publication texts for the selected monthly plan in controlled batches.
- Autopilot is idempotent and skips publication texts that already exist.
- Set `AUTOPILOT_TEXT_BATCH_LIMIT` to tune the batch size up to the safe maximum of `5`; the default is `5`.
- Batch visual generation is intentionally not included yet.
- Premium visual generation will move to background jobs or a queue in a later sprint.
- No database schema or OpenAI prompt changes were required.

## Sprint Product-2B Generation Jobs MVP

- Generation Jobs MVP was added.
- AI publication text, creative brief, and premium visual generation actions now create persistent production job records.
- The Materials view shows recent production jobs and related status inside publication cards.
- Premium visual generation records queued, running, completed, and failed states.
- This is not a full background worker yet.
- External queue and background processing will be added later.

## Sprint Product-3A Client Calendar Portal Preview

- Client Calendar Portal Preview was added.
- The client-facing view shows a monthly publication calendar, texts, visual previews, and simple statuses.
- Internal prompts, model names, provider metadata, Generation Jobs, raw Blueprint JSON, and manager tasks are hidden from the client view.
- This is not a public portal and does not include authentication yet.
- Real client approval actions will be added later.

## Sprint Product-3B Client Approval Workflow

- Client Approval Workflow was added.
- Client Portal Preview now supports approve and request changes actions.
- Optional client comments are recorded in Content Draft review events.
- Redirects preserve the selected Client Portal view, Blueprint, and monthly plan.
- Public authentication and external client links are still not included.

## Sprint Product-3C Secure Client Portal Share Links MVP

- Secure Client Portal share links were added.
- Managers can create and revoke tokenized links for one monthly plan.
- The public portal route shows only the client-facing calendar and materials.
- Clients can approve materials or request changes from a shared link.
- Raw portal tokens are not stored in the database.
- Full user authentication, video, and voice feedback are still not included.

## Sprint Product-4A Object Storage for Generated Visuals

- Generated visuals now support object storage.
- Vercel Blob is used when `BLOB_READ_WRITE_TOKEN` is configured.
- Existing base64 visuals remain supported.
- `imageBase64` is now a fallback instead of the desired production storage path.
- New visual records store `imageUrl`, `storageKey`, `storageProvider`, and `fileSize` when possible.

## Sprint Product-5A Monthly Client Report MVP

- Monthly Client Report MVP was added.
- The Reports view now summarizes production and approval status for the selected monthly plan.
- Metrics include planned materials, prepared texts, visuals, approvals, changes, scheduled items, and ready-to-publish items.
- The report includes attention items and a client-friendly summary.
- External analytics, social integrations, PDF export, and public report sharing are still not included.

## Sprint Product-6A Brand Asset Library MVP

- Brand Asset Library MVP was added.
- Clients can have a brand profile with tone, messages, colors, restrictions, visual style, and legal notes.
- Managers can upload and store brand assets using Vercel Blob.
- AI generation now receives compact brand context when available.
- Visual generation prompts use brand context and explicitly avoid fake logos.
- Google Drive sync, OCR, document parsing, and automated brandbook extraction are still not included.

## Sprint Product-7A Manager AI Copilot for Monthly Plan Revision

- Manager AI Copilot can propose monthly plan revisions from natural language instructions.
- Proposals are shown before applying, with remove, update, add, and protected item groups.
- Approved, scheduled, and visualized items are protected by default.
- This helps managers correct channel scope, abstract topics, and real operational context before production continues.
- This is not a general chat system, streaming assistant, auth layer, or publishing automation.

### Product-7A Hotfix

- The primary Copilot action now applies safe plan revisions directly from a manager instruction.
- Safe changes update planned content items and linked draft/calendar metadata when the material is not protected.
- Protected materials remain untouched and are counted in the manager notice.
- The older proposal-only flow remains available as a secondary review mode.

## Core-8A Manual Monthly Plan Editor

- Manual monthly plan editing was added for managers.
- Managers can add, edit, duplicate, and safely delete planned content items before production starts.
- Protected materials are not deleted or overwritten when they are approved, sent to client, published, visualized, or already have creative assets.
- Manual updates synchronize linked draft and non-published calendar metadata so the calendar reflects changed platform, topic, and date after refresh.
- This gives managers reliable control over AI-generated plans without requiring AI Copilot.

## UI-9A Compact Overview Dashboard

- The Overview screen was redesigned as a compact no-scroll manager dashboard.
- The visual direction now uses a unified light SaaS style with white cards, subtle borders, soft shadows, and lavender accents.
- Key counters, monthly readiness, active client context, queue, activity, and next actions are visible above the fold on desktop.
- Sidebar and workspace tabs were lightly cleaned up without changing product logic or other workflows.

## UI-9B Overview Noise Cleanup

- Overview empty states and lower cards were tightened to reduce visual noise.
- Decorative placeholders and repeated activity icons were removed.
- The lower Overview area now focuses on one action card, queue counts, and three recent activity items.
- The lavender SaaS direction remains, with fewer competing colors and less explanatory copy.

## UI-10A Materials Calendar Workbench

- Materials was redesigned into a calendar-based production workbench.
- Managers can scan planned materials by week/date, use compact filters, and open a selected material inspector.
- The inspector shows text, creative brief, visual, approval status, next action, and manual plan controls in one place.
- The old endless Materials page is reduced to a compact fallback list and advanced sections.

## UI-10B Real Materials Calendar

- Materials now uses a real month-style calendar surface with weekday columns and dated material chips.
- Week-only items stay in a compact “Без точной даты” area grouped by week.
- Material cards now show one clear next-action chip instead of several noisy technical badges.
- The material inspector was cleaned up around text, creative brief, visual, approval, and manual plan actions without changing product logic.

## Automation Sprint 0

- GitHub Actions CI runs automatically on pushes to `main` and on pull requests.
- CI starts PostgreSQL 16 as a service, applies Prisma migrations, generates the Prisma client, typechecks, and builds the app.
- Local Docker is no longer required for CI because GitHub Actions provides the PostgreSQL service.
- The CI build uses a placeholder `OPENAI_API_KEY`; real OpenAI end-to-end tests require adding `OPENAI_API_KEY` as a GitHub secret.
- Vercel and Neon provide the live deployment and cloud database.

## Vercel Deployment

- Vercel requires `DATABASE_URL` to point to a real cloud PostgreSQL database, not `localhost`.
- Vercel build runs `prisma migrate deploy` before `next build`.
- `NEXT_PUBLIC_APP_URL` should point to the public production app domain so client portal links do not use protected preview or deployment URLs.
- `OPENAI_API_KEY` must be set in Vercel environment variables for real Blueprint generation.
- `TEXT_MODEL_DEFAULT`, `TEXT_MODEL_PREMIUM`, `TEXT_MODEL_FAST`, `TEXT_MODEL_STRATEGY`, `TEXT_MODEL_MONTHLY_PLAN`, `TEXT_MODEL_CONTENT`, and `TEXT_MODEL_CREATIVE_BRIEF` can be set in Vercel environment variables to tune the text intelligence layer.
- `AUTOPILOT_TEXT_BATCH_LIMIT` controls how many missing publication texts Prepare Month Autopilot creates per run; the default is `5`.
- `VISUAL_PROVIDER`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`, `OPENAI_IMAGE_SIZE`, and `VISUAL_TEXT_MODE` can be set in Vercel environment variables for visual generation.
- `BLOB_READ_WRITE_TOKEN` is required for Vercel Blob uploads. Without it, generated visuals temporarily fall back to database base64 storage.
- The premium defaults are `openai`, `gpt-image-2`, `high`, `auto`, and `image_text`.

## Data Model

The Prisma schema includes:

- `Client`
- `ClientBrandProfile`
- `ClientBrandAsset`
- `ClientBrief`
- `ClientPresenceBlueprint`
- `PresenceModule`
- `PlatformRecommendation`
- `AutomationPlan`
- `RiskRule`
- `MonthlyOperatingPlan`
- `MonthlyPlanRevisionProposal`
- `MonthlyPlanModule`
- `MonthlyPlanPlatform`
- `PlannedContentItem`
- `ManagerTask`
- `ContentDraft`
- `ContentDraftReviewEvent`
- `ScheduledPublication`
- `CreativeAsset`
- `GeneratedCreativeVariant`
- `GenerationJob`

The blueprint intentionally stores platform names and module names as generated data. There is no fixed platform list and no fixed deliverable package baked into the application.
