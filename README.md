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
   OPENAI_MODEL="gpt-4.1-mini"
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

## Automation Sprint 0

- GitHub Actions CI runs automatically on pushes to `main` and on pull requests.
- CI starts PostgreSQL 16 as a service, applies Prisma migrations, generates the Prisma client, typechecks, and builds the app.
- Local Docker is no longer required for CI because GitHub Actions provides the PostgreSQL service.
- The CI build uses a placeholder `OPENAI_API_KEY`; real OpenAI end-to-end tests require adding `OPENAI_API_KEY` as a GitHub secret.
- Vercel and Neon provide the live deployment and cloud database.

## Vercel Deployment

- Vercel requires `DATABASE_URL` to point to a real cloud PostgreSQL database, not `localhost`.
- Vercel build runs `prisma migrate deploy` before `next build`.
- `OPENAI_API_KEY` must be set in Vercel environment variables for real Blueprint generation.

## Data Model

The Prisma schema includes:

- `Client`
- `ClientBrief`
- `ClientPresenceBlueprint`
- `PresenceModule`
- `PlatformRecommendation`
- `AutomationPlan`
- `RiskRule`
- `MonthlyOperatingPlan`
- `MonthlyPlanModule`
- `MonthlyPlanPlatform`
- `PlannedContentItem`
- `ManagerTask`
- `ContentDraft`

The blueprint intentionally stores platform names and module names as generated data. There is no fixed platform list and no fixed deliverable package baked into the application.
