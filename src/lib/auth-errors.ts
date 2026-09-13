/**
 * Safe Authentication Error Abstraction for DuoNexus.
 *
 * Ensures NO Firebase internals, Firestore errors, project IDs,
 * console URLs, stack traces, or sensitive security details are exposed
 * to end users or logged inappropriately.
 */

export interface SafeAuthError {
  title: string;
  message: string;
  isLocked?: boolean;
  retryAfterMs?: number;
  lockedUntil?: number;
}

/**
 * Maps raw backend responses, network failures, or Firebase errors into
 * clean, user-facing copy.
 */
export function mapToSafeAuthError(
  err: unknown,
  status?: number,
  responseData?: any
): SafeAuthError {
  // Check if server indicated lockout / rate limit
  if (status === 429 || responseData?.isLocked || responseData?.error === "Too many attempts") {
    return {
      title: "Too many attempts",
      message: "Please wait a moment before trying again.",
      isLocked: true,
      retryAfterMs: typeof responseData?.retryAfterMs === "number" ? responseData.retryAfterMs : 30000,
      lockedUntil: typeof responseData?.lockedUntil === "number" ? responseData.lockedUntil : Date.now() + 30000,
    };
  }

  // Check if server rejected with incorrect PIN (401)
  if (status === 401 || responseData?.error === "Incorrect PIN" || responseData?.valid === false) {
    return {
      title: "Incorrect PIN",
      message: "That PIN doesn't match. Please try again.",
      isLocked: false,
    };
  }

  // PIN format mismatch (400)
  if (status === 400) {
    return {
      title: "Invalid PIN",
      message: "Please enter a valid 4-digit PIN.",
      isLocked: false,
    };
  }

  // Network / connection drop
  if (
    err instanceof TypeError &&
    (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("Failed to fetch"))
  ) {
    return {
      title: "Connection issue",
      message: "Please check your network and try again.",
      isLocked: false,
    };
  }

  // Safe fallback for all other internal errors
  return {
    title: "Something went wrong",
    message: "Please try again.",
    isLocked: false,
  };
}

/**
 * Sanitized logging that never records plaintext PINs or credentials.
 */
export function logAuthEvent(eventName: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") {
    // Exclude any keys that might contain sensitive data
    const safeMeta: Record<string, unknown> = {};
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (!/pin|token|secret|password|credential/i.test(k)) {
          safeMeta[k] = v;
        }
      }
    }
    console.debug(`[Auth] ${eventName}`, safeMeta);
  }
}
