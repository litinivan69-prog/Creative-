# Adaptive Presence — self-service pivot

## Product decision

Adaptive Presence becomes a lightweight self-service SaaS for one business owner or a small team.

The customer signs up, completes a short brand brief, chooses a calm publishing rhythm and receives a ready monthly content kit. Internal agency stages stay hidden. The product explains only what is ready, what is being prepared and what the customer can do next.

The existing manager system is legacy during the transition. It must not be deleted, moved or used as the foundation for the new navigation until the self-service flow is proven.

## Core monthly outputs

The first product version supports four core outputs:

1. VK posts.
2. Telegram posts.
3. Dzen articles.
4. VC.ru articles.

The default rhythm is deliberately small:

- one or two content themes per week;
- every theme is adapted to the selected social channels instead of copied verbatim;
- zero, one or two long-form articles per month;
- a visual is optional per material and generated only when the package includes it.

Two lightweight helper formats can be added without a separate production system:

- **Quick announcement** — a short urgent update or offer adapted for VK and/or Telegram.
- **Review reply** — the customer pastes a review and receives a concise brand-safe response.

These helpers are on-demand tools, not additional monthly-plan stages.

## Customer flow

```text
Landing
  -> email sign-in
  -> payment
  -> short brand brief
  -> choose channels and rhythm
  -> confirm brand profile
  -> generate the month
  -> home dashboard
  -> open/edit/copy/download a material
  -> mark as published or publish through a connected channel
```

The first useful moment must happen quickly: after the brief, the customer sees how the system understood the brand and can start the first month.

## Customer navigation

The signed-in product has no manager console and no client/manager split.

- **Главная** — the next action, month progress and the next publication.
- **Месяц** — a calm calendar and all materials.
- **Бренд** — the brief, voice, products, restrictions and brand files.
- **Настройки** — account, plan, billing and connected channels.

Materials open as a focused page or drawer. There is no separate approvals area, production queue, creative studio or client package in the customer navigation.

## What we reuse

| Existing capability | Self-service use |
| --- | --- |
| `Client` | Brand/workspace record for the first version |
| `ClientBrief` and `ClientBrandProfile` | Short onboarding brief and editable brand memory |
| `ClientBrandAsset` | Logo, references and product photos |
| `ClientPresenceBlueprint` | Hidden AI brand strategy; show only a short human summary |
| `MonthlyOperatingPlan` | Monthly content kit |
| `PlannedContentItem.deliverableKind` | Route posts to the draft engine and articles to the article engine |
| `pairGroupId` | Link one theme across VK and Telegram adaptations |
| `ContentDraft` and `telegramBody` | Social copy and Telegram-native adaptation |
| `Article` and article pipeline | Dzen and VC.ru long-form materials |
| `CreativeAsset` and variants | Optional material visuals |
| `MonthProductionRun` and tasks | Hidden generation engine and progress source |
| `ScheduledPublication` | Calendar and later publishing |
| `ClientChannel` | VK/Telegram connections |

## What stays hidden

The following can remain technically available but must not appear in the self-service UI:

- manager tasks and manager attention;
- approval queues and internal review states;
- production stages and raw queue tasks;
- client portal link administration;
- generation jobs and provider/model details;
- internal integrations, metrics collection and n8n controls;
- raw Blueprint JSON and operational risk wording.

Customer-facing progress is reduced to four states:

- **Готовим**;
- **Готово**;
- **Нужно ваше решение**;
- **Опубликовано**.

## Safe route architecture

During the transition the current `/` manager console remains unchanged.

```text
/start                         public product onboarding entry
/sign-in                       email sign-in (phase 2)
/checkout                      payment (phase 2)
/app                           authenticated customer home
/app/month                     current monthly kit
/app/materials/[materialId]    focused material editor
/app/brand                     brand memory and assets
/app/settings                  account, plan and channels
```

Implementation lives in a separate `(self-service)` route group and separate components. It consumes application services instead of importing manager UI components.

After the new flow is proven, `/` can become the landing page and the legacy manager console can move behind an internal route or be removed in a separate migration. That is explicitly not part of the first stages.

## Required application boundary

The current `src/app/page.tsx` and `src/app/actions.ts` are large manager-oriented modules. New self-service routes must not add more branches to them.

Create small use-case functions over the existing Prisma models:

```text
src/lib/self-service/
  product.ts
  access.ts
  onboarding.ts
  month.ts
  materials.ts
  usage.ts
```

The customer UI calls those use cases. The old manager actions continue to work unchanged.

## Identity and billing boundary

The current schema has no user account, workspace membership or subscription. Do not identify a customer by “latest client” and do not expose client selection through an unprotected query parameter.

Phase 2 should add provider-neutral records:

- user/account with unique email;
- workspace membership linking a user to a `Client`;
- subscription with provider IDs, plan code, status and billing period;
- monthly usage counters for generated text, articles, visuals and regenerations.

Authentication and payment providers are selected only when this boundary is implemented. Product logic must depend on our own subscription status and entitlements, not directly on provider payloads.

## Delivery stages

### Stage 1 — product foundation

- product contract and format catalogue;
- public `/start` experience;
- no customer data and no database changes;
- legacy system untouched.

### Stage 2 — accounts and payment

- email sign-in;
- workspace ownership;
- subscription state and entitlements;
- protected `/app` layout.

### Stage 3 — short self-service onboarding

- company basics;
- offer, audience and tone;
- restrictions and brand files;
- channels, rhythm and monthly themes;
- reuse existing brief, brand profile and Blueprint generation.

### Stage 4 — monthly kit

- fixed lightweight scope;
- hidden queue;
- 1–2 weekly themes;
- VK/Telegram adaptations;
- Dzen/VC.ru articles;
- clear generation progress.

### Stage 5 — material workspace

- edit and regenerate;
- copy text and download assets;
- optional VK/Telegram publication;
- mark manually published;
- quick announcement and review reply tools.

## Non-goals for the first release

- agency workspaces or multiple manager roles;
- an exposed production queue;
- complex approvals;
- unlimited generation;
- full analytics or GEO dashboard;
- n8n setup in the customer UI;
- automatic Dzen or VC.ru publication;
- deleting the current manager system.
