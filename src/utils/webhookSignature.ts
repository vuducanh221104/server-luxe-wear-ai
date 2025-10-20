/**
 * @file webhookSignature.ts
 * @description Webhook signature verification utilities
 */

import crypto from "crypto";
import logger from "../config/logger";
import type {
  WebhookProvider,
  WebhookSignatureConfig,
  SignatureVerificationResult,
} from "../types/webhook";

/**
 * Verify webhook signature based on provider
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  config: WebhookSignatureConfig,
  timestamp?: string
): SignatureVerificationResult {
  try {
    switch (config.provider) {
      case "stripe":
        return verifyStripeSignature(payload, signature, config.secret, timestamp);
      case "github":
        return verifyGithubSignature(payload, signature, config.secret);
      case "shopify":
        return verifyShopifySignature(payload, signature, config.secret);
      case "generic":
      default:
        return verifyGenericSignature(
          payload,
          signature,
          config.secret,
          config.algorithm || "sha256"
        );
    }
  } catch (error) {
    logger.error("Signature verification error", {
      provider: config.provider,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Verify Stripe webhook signature (Stripe-Signature header)
 * Format: t=timestamp,v1=signature
 */
function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  timestamp?: string
): SignatureVerificationResult {
  const toleranceSeconds = 300; // 5 minutes

  // Parse signature header
  const signatures = signatureHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  const ts = signatures.t || timestamp;
  const v1 = signatures.v1;

  if (!ts || !v1) {
    return { valid: false, error: "Missing timestamp or signature" };
  }

  // Check timestamp tolerance
  const timestampNum = parseInt(ts, 10);
  const currentTime = Math.floor(Date.now() / 1000);

  if (Math.abs(currentTime - timestampNum) > toleranceSeconds) {
    return {
      valid: false,
      error: "Timestamp outside tolerance window",
      timestamp: timestampNum,
    };
  }

  // Compute expected signature
  const signedPayload = `${ts}.${payload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  // Compare signatures (constant-time comparison)
  const isValid = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature));

  return {
    valid: isValid,
    timestamp: timestampNum,
    error: isValid ? undefined : "Signature mismatch",
  };
}

/**
 * Verify GitHub webhook signature (X-Hub-Signature-256 header)
 * Format: sha256=signature
 */
function verifyGithubSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): SignatureVerificationResult {
  // GitHub sends: sha256=<signature>
  const [algorithm, signature] = signatureHeader.split("=");

  if (algorithm !== "sha256" || !signature) {
    return { valid: false, error: "Invalid signature format" };
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  return {
    valid: isValid,
    error: isValid ? undefined : "Signature mismatch",
  };
}

/**
 * Verify Shopify webhook signature (X-Shopify-Hmac-SHA256 header)
 * Base64-encoded HMAC-SHA256
 */
function verifyShopifySignature(
  payload: string,
  signature: string,
  secret: string
): SignatureVerificationResult {
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64");

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  return {
    valid: isValid,
    error: isValid ? undefined : "Signature mismatch",
  };
}

/**
 * Verify generic webhook signature
 * HMAC with configurable algorithm
 */
function verifyGenericSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256"
): SignatureVerificationResult {
  const expectedSignature = crypto.createHmac(algorithm, secret).update(payload).digest("hex");

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  return {
    valid: isValid,
    error: isValid ? undefined : "Signature mismatch",
  };
}

/**
 * Generate webhook signature for outgoing webhooks
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  provider: WebhookProvider = "generic"
): string {
  switch (provider) {
    case "stripe": {
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
      return `t=${timestamp},v1=${signature}`;
    }
    case "github": {
      const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      return `sha256=${signature}`;
    }
    case "shopify": {
      return crypto.createHmac("sha256", secret).update(payload).digest("base64");
    }
    case "generic":
    default: {
      return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    }
  }
}

/**
 * Get signature header name for provider
 */
export function getSignatureHeaderName(provider: WebhookProvider): string {
  switch (provider) {
    case "stripe":
      return "stripe-signature";
    case "github":
      return "x-hub-signature-256";
    case "shopify":
      return "x-shopify-hmac-sha256";
    case "generic":
    default:
      return "x-webhook-signature";
  }
}

/**
 * Get timestamp header name for provider
 */
export function getTimestampHeaderName(provider: WebhookProvider): string | null {
  switch (provider) {
    case "stripe":
      return null; // Included in signature header
    case "github":
      return "x-hub-signature";
    case "shopify":
      return null;
    default:
      return "x-webhook-timestamp";
  }
}
