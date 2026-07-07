# Creative Command / Adaptive Presence OS

## Language and style

Respond to the user in Russian unless explicitly asked otherwise.

Style:

- direct;
- practical;
- entrepreneurial;
- no fluff;
- no vague generic advice;
- give executable prompts/plans/code changes.

When the user asks for a prompt, provide a ready-to-paste prompt for Claude Code / Codex / Cursor.

## Project

Adaptive Presence OS is the operating system for brand presence built by Creative Command.

It is not a post generator.
It is not just a content calendar.
It is not a CRM.

Main flow:

```text
client → brief → blueprint → monthly scope → monthly plan → month production → calendar → materials → visuals → client package → revisions → report
```

## Business goal

Creative Command uses Adaptive Presence OS as:

1. an internal agency production machine;
2. a premium client-facing differentiation;
3. a future SaaS/semi-SaaS foundation.

Current focus:
make the MVP flow reliable and make the client portal a premium product surface.

## Tech stack

- Next.js
- React
- Prisma
- Neon Postgres
- Vercel
- Vercel Blob
- OpenAI / image generation

Repo:

```text
litinivan69-prog/Creative-
```

Main branch:

```text
main
```

## Critical rules

Do not refactor working architecture unless explicitly required.

Do not break:

- manager console;
- monthly plan flow;
- production queue;
- auto-run queue;
- carousel logic;
- materials studio;
- calendar;
- Vercel deployment.

Prefer minimal, targeted patches.

All actions should be idempotent where possible.

Do not create duplicate monthly plans.

Do not show raw Prisma/OpenAI errors in UI. Use friendly user-facing messages.

## Build checks

After meaningful changes, run:

```bash
pnpm prisma validate
pnpm prisma generate
pnpm tsc --noEmit
pnpm build
```

If a command cannot run because of the environment, explain honestly.

## UI rules

Visual direction:

- light SaaS UI;
- white cards;
- soft warm-gray/lavender background;
- violet/lavender primary accent;
- subtle gradients;
- soft shadows;
- thin borders;
- rounded 20–28px cards;
- calm typography;
- lots of space.

Avoid:

- green/teal primary colors;
- colorful CRM noise;
- heavy borders;
- horizontal scrolls inside columns;
- huge bold noisy text;
- overloaded button groups;
- useless placeholders;
- raw technical errors.

Amber is only for real warnings.
Red is only for real errors.
Green can be used only as a small success signal, not as the main style.

## Design system (tokens)

Style: Calm Lavender SaaS. Subtle glass (`backdrop-blur`) only on chrome (sidebar, sticky header), not on content cards. Cards: white, soft shadow, 20–28px radius.

Color tokens (also defined as CSS variables in `src/app/globals.css`, prefix `--ap-`):

- primary / accent: `#7C3AED`
- secondary: `#8B5CF6`
- page background: `#FAF5FF`
- card: `#FFFFFF`
- muted bg / muted text: `#F7F3FD` / `#64748B`
- border: `#EFE7FC`
- ink (text): `#0F172A`
- warning (real only): amber `#F59E0B`
- error (real only): `#DC2626`
- success (small signal only): `#059669`

Never use green/teal as a primary or accent fill.

Typography (full Cyrillic support — required for Russian UI):

- headings: Manrope
- body: Inter

Both are wired via `next/font` in `src/app/layout.tsx` and exposed as `--font-heading` / `--font-sans`. Tailwind: `font-sans`, `font-heading`. Avoid Satoshi / General Sans (no Cyrillic).

Design tooling: the global `ui-ux-pro-max` skill (`~/.claude/skills`) holds the searchable style/palette/font database — use it for new screens. Its green-accent and Satoshi/General Sans suggestions are overridden by the rules above.

## Client portal

The client portal is the most important sales surface of the product.

It should show:

- monthly package status;
- KPI summary;
- calendar;
- materials list;
- selected material;
- publication text;
- visuals;
- carousel slides;
- comments/revisions;
- actions: approve, request revision, open material, download package.

Client portal must feel like a premium SaaS dashboard, not an internal admin panel.

## Carousel logic

One material can have multiple `carousel_slide` assets.

Correct logic:

- `carousel_slide` assets are active required visuals;
- each `carousel_slide` has its own visual job;
- if `carousel_slide` assets exist, use them for the material visual display;
- old combined carousel visual should not be treated as the active required visual;
- manager should not manually generate every slide.

## Working mode

Before coding:

1. inspect the existing implementation;
2. understand the current data model;
3. avoid guessing;
4. make a concise plan;
5. implement a targeted patch.

After coding:

1. summarize changed files;
2. explain what changed;
3. list commands run;
4. mention any remaining risks.

## Security

Do not print secrets, tokens, database URLs, environment variable values, API keys, SSH keys, or cookies.
