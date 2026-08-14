export const SELF_SERVICE_PAID_STATUSES = new Set(["active", "trialing"]);

export function hasSelfServicePaidAccess(subscription: { status: string } | null | undefined) {
  return Boolean(subscription && SELF_SERVICE_PAID_STATUSES.has(subscription.status));
}
