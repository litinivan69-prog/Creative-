const secret = process.env.CRON_SECRET?.trim();

if (!secret) {
  console.error("CRON_SECRET is not configured");
  process.exit(1);
}

const response = await fetch("http://127.0.0.1:3100/api/cron/autopublish", {
  headers: {
    authorization: `Bearer ${secret}`,
  },
  signal: AbortSignal.timeout(55_000),
});

const body = await response.text();

if (!response.ok) {
  console.error(`Autopublish failed with HTTP ${response.status}: ${body}`);
  process.exit(1);
}

console.log(body);
