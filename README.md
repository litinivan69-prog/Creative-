# Adaptive Presence OS

Sprint 0 MVP for an adaptive AI-powered digital presence operating system.

The first working flow is:

Client Brief -> OpenAI structured analysis -> Client Presence Blueprint -> PostgreSQL via Prisma -> admin dashboard.

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

## Data Model

The Prisma schema includes:

- `Client`
- `ClientBrief`
- `ClientPresenceBlueprint`
- `PresenceModule`
- `PlatformRecommendation`
- `AutomationPlan`
- `RiskRule`

The blueprint intentionally stores platform names and module names as generated data. There is no fixed platform list and no fixed deliverable package baked into the application.
