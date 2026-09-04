import { createCipheriv, publicEncrypt, randomBytes, constants } from "node:crypto";
import { auth } from "@/auth";
import { isRibesAdminEmail } from "@/lib/self-service/admin-access";

export const runtime = "nodejs";

const MIGRATION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAppDy+o/vmVNqFGJfGa46
rN8lm4P2RE/Gt4HkRPeB563UvspMBOQkGdveNQv3BiDqO2Z6GUhzsBmwxhmtjPkF
ZbM/52Ep4ZVxdBG0nuy272/oMD1NSqVD9VbMQ1bVEdTZBBhArbe5IYkaEvJIpTu9
9Lf5ME2cKwBh0CrWz5jUrO3hILkKKxZ+E/8bVrsUFHdCGBxeYSPo+5oeGugA0eEW
w2/dSPcAmHQGVoWIo318O8Xbn7s8/XwZ5fJeKfHL2Cbln9Io92LDkl0+u4ZUlZyW
XdEXGfDW0KEJq3BJ/WnNmdf8xvWfd+lGgjo4HTTFYVhqriAm2hdITWfzyk0ZKNKm
wlzUtsxYSK749csZd4RogdjmPGtUN4PThs7C0OZ+dS7vEsyx5hgTdaNsp69fwlmP
MBcwt0ixv0uSv1gtg/woeKp2rcYpnLNgs4OKHS4OJRqClgL5PQKw6G/JnP4sG6eu
bLPnE4MoyleQe68bGWXU4g189h1mNP0RSRHGaz8BdluxAgMBAAE=
-----END PUBLIC KEY-----`;

const MIGRATION_KEYS = [
  "ANTHROPIC_API_KEY",
  "ARTICLE_MODEL_ANTHROPIC",
  "ARTICLE_MODEL_OPENAI",
  "AUTH_EMAIL_FROM",
  "AUTH_RESEND_KEY",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "CHANNEL_CREDENTIAL_SECRET",
  "CRON_SECRET",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "N8N_SHARED_SECRET",
  "N8N_WEBHOOK_URL",
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_IMAGE_QUALITY",
  "OPENAI_IMAGE_SIZE",
  "OPENAI_MODEL",
  "RIBES_ADMIN_EMAILS",
  "SELF_SERVICE_MONTH_VISUAL_BUDGET_USD",
  "TEXT_MODEL_CONTENT",
  "TEXT_MODEL_CREATIVE_BRIEF",
  "TEXT_MODEL_DEFAULT",
  "TEXT_MODEL_FAST",
  "TEXT_MODEL_MONTHLY_PLAN",
  "TEXT_MODEL_PREMIUM",
  "TEXT_MODEL_STRATEGY",
  "TEXT_REASONING_EFFORT_CONTENT",
  "TEXT_REASONING_EFFORT_CREATIVE",
  "TEXT_REASONING_EFFORT_STRATEGY",
  "VISUAL_ALLOW_GENERATED_TEXT",
  "VISUAL_PROVIDER",
  "VISUAL_TEXT_MODE",
  "VK_APP_ID",
  "VK_APP_SECRET",
  "YOOKASSA_SECRET_KEY",
  "YOOKASSA_SHOP_ID",
  "YOOKASSA_TEST_MODE",
  "YOOKASSA_VAT_CODE",
] as const;

export async function GET() {
  const session = await auth();
  if (!isRibesAdminEmail(session?.user?.email) || process.env.VERCEL_ENV !== "production") {
    return new Response("Not found", { status: 404 });
  }

  const values = Object.fromEntries(
    MIGRATION_KEYS.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
  );
  const plaintext = Buffer.from(JSON.stringify(values), "utf8");
  const encryptionKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const wrappedKey = publicEncrypt(
    {
      key: MIGRATION_PUBLIC_KEY,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptionKey,
  );

  return Response.json(
    {
      wrappedKey: wrappedKey.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
