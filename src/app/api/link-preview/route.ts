import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl } from "@/lib/ssrf-protection";
import { getClientIp, checkRateLimit, recordFailedAttempt } from "@/lib/auth-security";

export interface LinkPreviewData {
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

// In-memory cache with 6-hour TTL
interface CacheEntry {
  data: LinkPreviewData;
  expiresAt: number;
}
const previewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE_SIZE = 500;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 256 * 1024; // 256KB max stream

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .trim();
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaTagRegex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaTagRegex.exec(html)) !== null) {
    const attrsStr = match[1];
    let key: string | null = null;
    let content: string | null = null;

    const keyMatch = attrsStr.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    if (keyMatch) {
      key = keyMatch[1].toLowerCase();
    }

    const contentMatch = attrsStr.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch) {
      content = contentMatch[1];
    }

    if (key && content !== null) {
      meta[key] = content;
    }
  }

  const linkImgMatch = html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
  if (linkImgMatch && !meta["og:image"]) {
    meta["link:image_src"] = linkImgMatch[1];
  }

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTagMatch && !meta["title_tag"]) {
    meta["title_tag"] = titleTagMatch[1];
  }

  return meta;
}

/**
 * Fetches link metadata while enforcing strict SSRF checks on every hop.
 */
async function fetchLinkMetadataSecure(initialUrl: string): Promise<LinkPreviewData> {
  let currentUrl = initialUrl;
  let redirects = 0;

  const fallbackSiteName = new URL(initialUrl).hostname.replace(/^www\./i, "");
  const fallbackResult: LinkPreviewData = {
    title: fallbackSiteName,
    siteName: fallbackSiteName,
    url: initialUrl,
  };

  const userAgent =
    "Mozilla/5.0 (compatible; DuoNexus/2.0; +https://duonexus.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  while (redirects <= MAX_REDIRECTS) {
    // Validate target URL and resolved destination IP before connection
    const ssrfCheck = await validateSafeUrl(currentUrl);
    if (!ssrfCheck.safe) {
      console.warn(`[link-preview] Blocked SSRF attempt: ${currentUrl} (${ssrfCheck.error})`);
      return fallbackResult;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "manual", // Prevent automatic unvalidated redirects
      });

      clearTimeout(timer);

      // Handle redirect status codes manually with SSRF validation on the destination
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).href;
        currentUrl = nextUrl;
        redirects++;
        continue;
      }

      if (!res.ok) return fallbackResult;

      const contentType = res.headers.get("content-type") || "";

      // Direct image preview
      if (contentType.startsWith("image/")) {
        return {
          title: fallbackSiteName,
          image: currentUrl,
          siteName: fallbackSiteName,
          url: initialUrl,
        };
      }

      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        return fallbackResult;
      }

      // Stream read with max size limit
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const decoder = new TextDecoder("utf-8");
        let bytesRead = 0;
        while (bytesRead < MAX_RESPONSE_BYTES) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          bytesRead += value.length;
          html += decoder.decode(value, { stream: true });
          if (html.includes("</head>")) break;
        }
        reader.cancel().catch(() => {});
      } else {
        html = await res.text();
      }

      const meta = extractMetaTags(html);

      const rawTitle =
        meta["og:title"] || meta["twitter:title"] || meta["title_tag"] || meta["title"] || fallbackSiteName;
      const rawDesc =
        meta["og:description"] || meta["twitter:description"] || meta["description"] || "";
      let rawImage =
        meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["link:image_src"] || undefined;
      const rawSiteName = meta["og:site_name"] || meta["twitter:site"] || fallbackSiteName;

      if (rawImage) {
        try {
          rawImage = new URL(rawImage, currentUrl).href;
          // Verify rawImage is also not targeting internal networks
          const imgCheck = await validateSafeUrl(rawImage);
          if (!imgCheck.safe) rawImage = undefined;
        } catch {
          rawImage = undefined;
        }
      }

      return {
        title: decodeHtmlEntities(rawTitle) || fallbackSiteName,
        description: rawDesc ? decodeHtmlEntities(rawDesc.length > 200 ? rawDesc.slice(0, 197) + "..." : rawDesc) : undefined,
        image: rawImage,
        siteName: decodeHtmlEntities(rawSiteName) || fallbackSiteName,
        url: initialUrl,
      };
    } catch {
      clearTimeout(timer);
      return fallbackResult;
    }
  }

  return fallbackResult;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`preview_${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body?.url || "").trim();

    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // SSRF pre-check
    const check = await validateSafeUrl(targetUrl);
    if (!check.safe) {
      recordFailedAttempt(`preview_${clientIp}`);
      return NextResponse.json({ error: check.error || "Restricted URL" }, { status: 400 });
    }

    const now = Date.now();
    const cached = previewCache.get(targetUrl);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    const metadata = await fetchLinkMetadataSecure(targetUrl);

    if (previewCache.size > MAX_CACHE_SIZE) {
      const firstKey = previewCache.keys().next().value;
      if (firstKey) previewCache.delete(firstKey);
    }
    previewCache.set(targetUrl, {
      data: metadata,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(metadata);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch link preview" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`preview_${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = (searchParams.get("url") || "").trim();

    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const check = await validateSafeUrl(targetUrl);
    if (!check.safe) {
      recordFailedAttempt(`preview_${clientIp}`);
      return NextResponse.json({ error: check.error || "Restricted URL" }, { status: 400 });
    }

    const now = Date.now();
    const cached = previewCache.get(targetUrl);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    const metadata = await fetchLinkMetadataSecure(targetUrl);

    if (previewCache.size > MAX_CACHE_SIZE) {
      const firstKey = previewCache.keys().next().value;
      if (firstKey) previewCache.delete(firstKey);
    }
    previewCache.set(targetUrl, {
      data: metadata,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(metadata);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch link preview" }, { status: 500 });
  }
}
