export type IntegrationType =
  | "BLACKBOARD"
  | "EMAIL"
  | "GOOGLE_CALENDAR"
  | "MICROSOFT_CALENDAR"
  | "MANUAL"
  | "OTHER_LMS";

export interface ExternalTaskCandidate {
  externalId: string;
  title: string;
  description?: string;
  dueAt?: string;
  subjectExternalId?: string;
  sourceUrl?: string;
}

/**
 * Every institutional integration (Blackboard, calendars, email) implements
 * this so the sync pipeline never depends on a specific vendor. Nothing
 * implementing this may fabricate a connection — `connect()` must perform a
 * real OAuth handshake or throw NotAuthorizedError.
 */
export interface IntegrationProvider {
  readonly type: IntegrationType;
  isConfigured(): boolean;
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<{ encryptedCredentials: string }>;
  fetchTaskCandidates(encryptedCredentials: string): Promise<ExternalTaskCandidate[]>;
}

export class IntegrationNotAuthorizedError extends Error {
  constructor(type: IntegrationType) {
    super(
      `${type} integration is not authorized. StudyFlow never fabricates institutional access — ` +
        `see docs/duoc-integration/INTEGRATION_REQUEST.md for how to request official OAuth credentials.`
    );
    this.name = "IntegrationNotAuthorizedError";
  }
}

/**
 * Blackboard REST API adapter (OAuth 2.0 / 3LO). Disabled until the
 * institution grants a client id/secret — see BLACKBOARD_* in .env.example.
 * StudyFlow must keep working fully via manual entry, documents, and
 * authorized email/calendar while this stays disconnected.
 */
export class BlackboardIntegrationProvider implements IntegrationProvider {
  readonly type: IntegrationType = "BLACKBOARD";

  constructor(
    private readonly clientId: string | undefined = process.env.BLACKBOARD_CLIENT_ID,
    private readonly clientSecret: string | undefined = process.env.BLACKBOARD_CLIENT_SECRET,
    private readonly baseUrl: string | undefined = process.env.BLACKBOARD_BASE_URL
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.baseUrl);
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    if (!this.isConfigured()) throw new IntegrationNotAuthorizedError(this.type);
    const params = new URLSearchParams({
      client_id: this.clientId!,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
      scope: "read",
    });
    return `${this.baseUrl}/learn/api/public/v1/oauth2/authorizationcode?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{ encryptedCredentials: string }> {
    if (!this.isConfigured()) throw new IntegrationNotAuthorizedError(this.type);

    const res = await fetch(`${this.baseUrl}/learn/api/public/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });

    if (!res.ok) {
      throw new Error(`Blackboard token exchange failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    // Encryption of the raw token payload happens at the API-route layer
    // (server-side only) before this ever reaches the `integrations` table.
    return { encryptedCredentials: JSON.stringify(json) };
  }

  async fetchTaskCandidates(): Promise<ExternalTaskCandidate[]> {
    if (!this.isConfigured()) throw new IntegrationNotAuthorizedError(this.type);
    // Real Blackboard Content/Announcements API calls go here once the
    // institution has authorized the app. Intentionally unimplemented in
    // this pass — see docs/duoc-integration/INTEGRATION_REQUEST.md.
    throw new Error("Blackboard fetchTaskCandidates not yet implemented — requires institutional authorization.");
  }
}
