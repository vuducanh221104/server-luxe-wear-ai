export interface TokenRecord {
  id: string;
  user_id: string;
  token_type: "access" | "refresh" | "password_reset" | "email_verification";
  token_value: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface CreateTokenData {
  userId: string;
  tokenType: "access" | "refresh" | "password_reset" | "email_verification";
  expiresInDays?: number;
  metadata?: Record<string, unknown>;
}
