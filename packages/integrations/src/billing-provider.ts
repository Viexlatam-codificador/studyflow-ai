export interface CheckoutSessionRequest {
  userId: string;
  planKey: "PRO" | "CAMPUS";
  interval: "monthly" | "annual";
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
}

/**
 * Abstraction over the payment processor so StudyFlow's billing logic
 * (plans, subscriptions, entitlements) never depends on a specific vendor.
 * No real payment provider is wired up yet — BILLING_PROVIDER=mock until
 * Stripe credentials exist (see .env.example STRIPE_*). Never invent a
 * "successful payment" — mock mode must make that explicit to the caller.
 */
export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export class MockBillingProvider implements BillingProvider {
  readonly name = "mock";

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    throw new Error(
      "BILLING_PROVIDER=mock cannot process real payments. Configure Stripe credentials " +
        "(STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY) and set BILLING_PROVIDER=stripe to enable checkout. " +
        `Requested: user=${request.userId} plan=${request.planKey}.`
    );
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
}

export function getBillingProvider(): BillingProvider {
  const name = process.env.BILLING_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return new MockBillingProvider();
    // case "stripe": return new StripeBillingProvider(); — implement once
    // STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are provided.
    default:
      throw new Error(`Unknown BILLING_PROVIDER "${name}".`);
  }
}
