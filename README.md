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
- The calendar is now the primary full-width workspace, with material details moved below so the month grid is not squeezed.
- The material inspector was cleaned up around text, creative brief, visual, approval, and manual plan actions without changing product logic.

## UI-10C Calendar And Materials Split

- Calendar is now the dedicated full-page visual production calendar with dated material cards and visual previews.
- Materials is restored as the production workbench for editing text, creative briefs, visuals, approvals, and manual plan items.
- Calendar cards can open the related material directly in Materials for production work.

## UI-10D Calendar Navigation Cleanup

- Calendar header was tightened and now includes Month, Week, 3-day, and Day modes.
- The sidebar was reduced to a compact global icon rail so Calendar has more horizontal room.
- Materials no longer exposes calendar-like local navigation; production jobs and autopilot are tucked into advanced tasks.

## UI-11A Global Navigation Simplification

- The left sidebar is now a compact global rail for Overview, Clients, Settings, and manager profile only.
- Workspace tabs remain in the main content area for client-specific sections such as Calendar, Materials, Creative, Brand, Client View, and Reports.
- Calendar keeps the full visual workspace with compact controls and no KPI widgets above the grid.

## Core/UI-11B Calendar Navigation And Exact Planning Dates

- Calendar navigation now persists `calendarView` and `calendarDate` in the URL for Month, Week, 3-day, and Day modes.
- The Calendar workspace uses real previous, today, and next period links instead of decorative controls.
- Monthly plan generation now asks AI for exact `YYYY-MM-DD` planned dates, while a deterministic fallback normalizes vague legacy dates before saving.
- Existing month plans with week-only items can be repaired from Calendar with the “Расставить даты” action.
- The sidebar uses real SVG navigation icons and keeps only global destinations.

## Core/UI-12 Clients And Overview Styling

- Clients is now a dedicated client base screen without redundant workspace tabs.
- Overview shows the selected client context directly in the main header area.
- Letter placeholder badges in Overview metrics were replaced with real SVG icons.
- Clients and Overview accents were unified into a calmer lavender/purple visual system.

## UI-12B Materials Production Studio

- Materials is now a unified production studio for one selected material instead of fragmented text, brief, visual, and approval blocks.
- Managers can edit publication text, creative brief, visual generation/review, plan fields, and readiness from one screen.
- Month-level preparation now surfaces text, brief, visual, and monthly package actions in one compact area.
- Client approval is treated as a future monthly package step, not the default per-post action inside Materials.

## Product/UI-12C Revisions And Automatic Texts

- Approvals were reframed as `Правки`, a client revision inbox for comments and requested changes.
- Materials remains the primary production studio for text, creative briefs, visuals, and monthly package readiness.
- Monthly plan generation now starts automatic text draft preparation for planned materials, with safe batching and retry copy when items remain.
- The separate Creatives workspace is hidden from primary navigation because creative briefs and visuals are handled inside Materials.

## Core-14 Month Production Engine

- Month Production Engine prepares the monthly package from a strict production scope.
- `Scope месяца` defines allowed platforms, allowed deliverables, forbidden deliverables, cadence, strategic themes, and reputation tasks.
- Monthly plan generation sends this scope to OpenAI and then applies deterministic guardrails before saving.
- AI is constrained by allowed platforms and deliverables; forbidden items such as advertising mockups, site/landing work, Ozon Seller tasks, and email campaigns are removed or blocked unless explicitly allowed.
- `Подготовить месяц` runs the production chain for the selected plan: exact dates, text drafts, scheduled publication records, creative briefs, and a safe visual-generation chunk.
- Client approval remains package-level later; nothing is sent to the client automatically.

## Core-15 Background Month Production Queue

- `Подготовить месяц` now creates a persisted `MonthProductionRun` and task queue instead of blocking on the whole month in one request.
- Month production tasks are split by stage: texts, creative briefs, visuals, and AI quality check.
- The production panel auto-runs safe small batches while the manager watches progress, so ready materials appear progressively without repeated manual clicks.
- Failed tasks are saved independently and can be retried without rolling back completed texts, briefs, or visuals.
- Materials shows the current production run, progress counters, current task, errors, and per-material retry controls.
- Progress survives refresh and browser close; nothing is sent to the client automatically.

## Hotfix/Product Client Test Duplication And Month Rebuild

- Clients can be duplicated for testing with `Дублировать для теста`.
- Test duplicates copy the client basics, latest brief, Blueprint configuration, brand profile, brand asset metadata/references, and saved production scope when available.
- Test duplicates do not copy monthly plans, generated texts, visuals, scheduled publications, or client portal links.
- `Переделать месяц` creates a new monthly plan version for the same client/month, marks the previous active plan as `replaced`, starts a fresh production run, and preserves old work.
- The dashboard selects the latest non-replaced month by default, so managers can test or rebuild without manually re-entering the original brief.

## Critical Hotfix Month Preparation State

- Month preparation now uses one safe `prepareOrContinueMonthProduction` flow for creating/opening a plan, creating/reusing a production run, and recovering missing tasks.
- Repeated clicks no longer create duplicate monthly plans or duplicate production runs; existing runs are opened and existing artifacts are preserved.
- Partial months are recoverable: the queue inspects existing texts, creative briefs, and visuals, then enqueues only missing steps.
- Materials shows a clear `Подготовка месяца` progress panel with plan status, date status, text/TZ/visual counters, current task, error count, and recovery actions.
- Raw duplicate-plan and timeout/quota errors are converted into manager-friendly Russian messages.
- Test clients can safely reset and rebuild the test month without affecting the original client.

## Critical Hotfix Automatic Month Production

- After one click on `Подготовить месяц`, the production panel automatically processes queued batches for texts, creative briefs, visuals, and quality check while the screen is open.
- The manager no longer has to click `Продолжить` for each batch; normal running state shows `Подготовка идёт...` with percentage progress.
- Refreshing or reopening the Materials screen resumes unfinished queued work without creating duplicate plans, runs, texts, briefs, or visuals.
- Critical quota/billing/rate-limit errors pause production with a Russian message; ordinary task failures are saved and can be retried.
- The MVP uses client-side polling instead of an external queue service; if the browser is closed, preparation continues automatically after the manager returns to the production screen.

## UI/Production Materials Polish And Carousel Visuals

- Materials Studio now uses a calmer lavender/gray visual language instead of green/turquoise accents.
- The Materials workspace layout is tightened into stable list/editor/preview columns with compact material cards and no horizontal list scrolling.
- Text and creative brief editing fields are larger and wrap long content naturally.
- Carousel-style materials can create multiple `carousel_slide` creative assets for one publication, so each card/slide receives its own visual task and generated variant.
- Carousel visual generation is guarded so AI creates only one standalone slide per `carousel_slide`, never one combined collage with all cards inside it.
- Legacy combined carousel briefs can be rebuilt into separate slide assets with `Пересобрать как карусель`; the old combined asset is preserved as a rejected legacy record.
- After carousel rebuild, missing slide visuals are added to the active month production queue automatically and the Materials auto-runner continues generation without manual per-slide clicks.
- Calendar cards show the first visual thumbnail for carousel materials plus a compact slide-count label.

## Premium Client Portal Shell

- Public client portal links now open a dedicated premium monthly package surface, separate from the Manager Console.
- The client view shows monthly KPIs, a clean calendar, selected material detail, month materials list, visuals, carousel slide previews, and comments/revision controls.
- Carousel materials use `carousel_slide` assets as the active client-facing visuals, while legacy combined carousel visuals stay out of the primary preview.
- Client approval and change-request actions continue to use the existing review workflow and stored review events.

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
- Self-service checkout uses YooKassa when `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` are set.
- Configure YooKassa notifications for `payment.succeeded` and `payment.canceled` at `https://<production-domain>/api/billing/yookassa/webhook`.
- Payment notifications are never trusted on their own: the app fetches the payment from YooKassa and verifies the amount, currency, client metadata, and local payment id before activating access.
- `YOOKASSA_VAT_CODE` is optional and should be set only when receipt items must be sent by the application according to the shop's YooKassa/online-cash-register configuration.

## Data Model

The Prisma schema includes:

- `Client`
- `WorkspaceMembership`
- `Subscription`
- `BillingPayment`
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
- `MonthProductionRun`
- `MonthProductionTask`

The blueprint intentionally stores platform names and module names as generated data. There is no fixed platform list and no fixed deliverable package baked into the application.
