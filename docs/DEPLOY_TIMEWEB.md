# Ribes on Timeweb Cloud

The production migration uses four resources:

1. App Platform application built from the repository Dockerfile.
2. Managed PostgreSQL database.
3. Public S3-compatible bucket for generated visuals and uploaded brand files.
4. The Ribes domain with automatic TLS attached to the App Platform application.

Keep the Vercel deployment online until the Timeweb copy passes the complete smoke test.

## Required environment

Copy the application secrets from the current production environment without exposing them in Git or chat. Change only the infrastructure-specific values:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_PUBLIC_URL`
- `S3_FORCE_PATH_STYLE`

Keep `AUTH_SECRET` and `CHANNEL_CREDENTIAL_SECRET` unchanged. Rotating them during migration would invalidate sessions and make already connected channel credentials unreadable.

Update callback and webhook addresses after the domain is attached:

- Resend authentication domain and sender
- VK callback URL
- YooKassa webhook URL: `https://<domain>/api/billing/yookassa/webhook`
- Any n8n callbacks pointing at the old deployment

## Database

Use the same PostgreSQL major version as the source database. Restore a production dump into the new database, then run:

```sh
pnpm prisma migrate deploy
```

Do not point both production deployments at different writable databases after traffic switches. Put the old deployment into maintenance mode or disable it after DNS propagation.

## Files

New files are written to S3 whenever all S3 environment variables are present. Vercel Blob remains supported during the transition, so existing database URLs continue to render. Copy existing Blob objects to S3 separately, update their URLs in a transaction, and verify object counts before removing the old store.

## Verification before DNS switch

- `GET /api/health` returns HTTP 200.
- Passwordless email login returns to the Timeweb technical domain.
- Existing materials and images open.
- A new visual is stored in S3 and opens publicly.
- Telegram scheduled publishing works.
- VC.ru draft creation works.
- A YooKassa test payment webhook reaches the new application.

Only after these checks should the public domain be switched to Timeweb.
