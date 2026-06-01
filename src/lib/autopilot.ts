const DEFAULT_AUTOPILOT_TEXT_BATCH_LIMIT = 5;
const MAX_AUTOPILOT_TEXT_BATCH_LIMIT = 5;

export function getAutopilotTextBatchLimit() {
  const configuredLimit = Number.parseInt(process.env.AUTOPILOT_TEXT_BATCH_LIMIT ?? "", 10);

  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, MAX_AUTOPILOT_TEXT_BATCH_LIMIT)
    : DEFAULT_AUTOPILOT_TEXT_BATCH_LIMIT;
}
