import dns from "dns/promises";
import net from "net";

/**
 * Validates if an IPv4 address belongs to a private, loopback, or reserved range.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP is treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 - Broadcast / local
  if (a === 0) return true;
  // 10.0.0.0/8 - Private
  if (a === 10) return true;
  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;
  // 169.254.0.0/16 - Link-local & Cloud Metadata (AWS/GCP/Azure)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 - Private (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 - Carrier Grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 - TEST-NET
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 - Multicast
  if (a >= 224) return true;

  return false;
}

/**
 * Validates if an IPv6 address belongs to a private, loopback, or link-local range.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") || // Link-local
    normalized.startsWith("fc00:") || // Unique local
    normalized.startsWith("fd00:")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
  }

  return false;
}

/**
 * Complete SSRF check: validates URL scheme, hostname, and resolved IP addresses.
 */
export async function validateSafeUrl(urlStr: string): Promise<{ safe: boolean; error?: string; parsedUrl?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, error: "Invalid URL syntax" };
  }

  // Strictly allow http and https protocols only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, error: "Only HTTP and HTTPS protocols are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Obvious hostname blacklist
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    return { safe: false, error: "Access to local or internal hosts is restricted" };
  }

  // Direct IP in hostname check
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { safe: false, error: "Access to private IP addresses is blocked" };
    }
    return { safe: true, parsedUrl: parsed };
  }

  if (net.isIPv6(hostname)) {
    if (isPrivateIPv6(hostname)) {
      return { safe: false, error: "Access to private IPv6 addresses is blocked" };
    }
    return { safe: true, parsedUrl: parsed };
  }

  // Resolve hostname via DNS to verify target IP is not private
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: "Hostname resolution failed" };
    }

    for (const record of addresses) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return { safe: false, error: `Host resolves to restricted private address (${record.address})` };
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return { safe: false, error: `Host resolves to restricted IPv6 address (${record.address})` };
      }
    }
  } catch (err: any) {
    return { safe: false, error: `DNS lookup failed: ${err?.message || "Unknown"}` };
  }

  return { safe: true, parsedUrl: parsed };
}
