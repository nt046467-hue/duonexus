import { NextRequest, NextResponse } from "next/server";

export interface LinkPreviewData {
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

// In-memory cache with 6-hour TTL to prevent redundant scraping of the same URLs
interface CacheEntry {
  data: LinkPreviewData;
  expiresAt: number;
}
const previewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE_SIZE = 500;

/** Decode common HTML entities into readable plain text */
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

/** Check if hostname is internal / private IP to prevent SSRF */
function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "local" ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 regex check for private ranges (10.x, 192.168.x, 172.16-31.x, 169.254.x)
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1, o2] = ipv4Match.map(Number);
    if (o1 === 10) return true;
    if (o1 === 127) return true;
    if (o1 === 169 && o2 === 254) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  }

  return false;
}

/** Extract meta tag contents from raw HTML string */
function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};

  // Find all <meta> tags
  const metaTagRegex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaTagRegex.exec(html)) !== null) {
    const attrsStr = match[1];
    let key: string | null = null;
    let content: string | null = null;

    // Extract property or name attribute
    const keyMatch = attrsStr.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    if (keyMatch) {
      key = keyMatch[1].toLowerCase();
    }

    // Extract content attribute
    const contentMatch = attrsStr.match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch) {
      content = contentMatch[1];
    }

    if (key && content !== null) {
      meta[key] = content;
    }
  }

  // Extract <link rel="image_src" ...>
  const linkImgMatch = html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
  if (linkImgMatch && !meta["og:image"]) {
    meta["link:image_src"] = linkImgMatch[1];
  }

  // Extract <title> tag
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTagMatch && !meta["title_tag"]) {
    meta["title_tag"] = titleTagMatch[1];
  }

  return meta;
}

async function fetchLinkMetadata(targetUrl: string): Promise<LinkPreviewData> {
  const parsed = new URL(targetUrl);
  const hostname = parsed.hostname;
  const fallbackSiteName = hostname.replace(/^www\./i, "");

  // Initial fallback
  const fallbackResult: LinkPreviewData = {
    title: fallbackSiteName,
    siteName: fallbackSiteName,
    url: targetUrl,
  };

  if (isPrivateOrLocalHost(hostname)) {
    return fallbackResult;
  }

  /**
   * User-Agent strategies (tried in order):
   * 1. facebookexternalhit/1.1 — many sites (Facebook, news outlets, Shopify, etc.)
   *    serve complete og:title / og:description / og:image specifically to this UA.
   * 2. Chrome desktop — fallback for sites that block social crawlers but serve
   *    normal browser requests (e.g. some APIs, SPAs with SSR).
   */
  const USER_AGENTS = [
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; DuoNexus/2.0; +https://duonexus.com)",
  ];

  /** Fetch URL with a given UA and return parsed meta tags (or null on failure).
   *  Uses its own inner 3.5 s AbortController so one slow site can’t eat the
   *  full shared budget before attempt 2 gets a chance to run.
   */
  async function tryFetch(userAgent: string, _outerSignal: AbortSignal): Promise<Record<string, string> | null> {
    // Per-attempt timeout — independent of the outer budget
    const inner = new AbortController();
    const innerId = setTimeout(() => inner.abort(), 3500);
    // Also abort if the outer controller fires
    const onOuterAbort = () => inner.abort();
    _outerSignal.addEventListener("abort", onOuterAbort, { once: true });

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: inner.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
      });

      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") || "";

      // Direct image URL — treat as image preview, bypass meta parsing
      if (contentType.startsWith("image/")) {
        return { "__direct_image__": targetUrl };
      }

      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        return null;
      }

      // Stream up to 256KB, stop at </head> to minimise payload
      const reader = response.body?.getReader();
      let html = "";
      if (reader) {
        const decoder = new TextDecoder("utf-8");
        let bytesRead = 0;
        while (bytesRead < 256 * 1024) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          bytesRead += value.length;
          html += decoder.decode(value, { stream: true });
          if (html.includes("</head>")) break;
        }
        reader.cancel().catch(() => {});
      } else {
        html = await response.text();
      }

      return extractMetaTags(html);
    } catch {
      return null;
    } finally {
      clearTimeout(innerId);
      _outerSignal.removeEventListener("abort", onOuterAbort);
    }
  }


  /** Turn a parsed meta map into a structured LinkPreviewData */
  function buildResult(meta: Record<string, string>): LinkPreviewData {
    // Direct image shortcut
    if (meta["__direct_image__"]) {
      return { title: fallbackSiteName, image: meta["__direct_image__"], siteName: fallbackSiteName, url: targetUrl };
    }

    const rawTitle =
      meta["og:title"] || meta["twitter:title"] || meta["title_tag"] || meta["title"] || meta["name"] || fallbackSiteName;

    const rawDesc =
      meta["og:description"] || meta["twitter:description"] || meta["description"] || "";

    let rawImage =
      meta["og:image"] || meta["og:image:url"] || meta["og:image:secure_url"] ||
      meta["twitter:image"] || meta["twitter:image:src"] || meta["link:image_src"] || undefined;

    const rawSiteName = meta["og:site_name"] || meta["twitter:site"] || fallbackSiteName;

    // Resolve relative → absolute image URL
    if (rawImage) {
      try { rawImage = new URL(rawImage, targetUrl).href; } catch { rawImage = undefined; }
    }

    return {
      title: decodeHtmlEntities(rawTitle) || fallbackSiteName,
      description: rawDesc ? decodeHtmlEntities(rawDesc.length > 200 ? rawDesc.slice(0, 197) + "..." : rawDesc) : undefined,
      image: rawImage,
      siteName: decodeHtmlEntities(rawSiteName) || fallbackSiteName,
      url: targetUrl,
    };
  }

  /** True if a meta map produced no useful OG/Twitter data worth showing */
  function hasUsefulMeta(meta: Record<string, string>): boolean {
    return !!(meta["og:title"] || meta["og:image"] || meta["twitter:title"] || meta["twitter:image"]);
  }

  // Shared AbortController — total budget of 7 s for both attempts combined (client waits 8 s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    // Attempt 1 — Facebook crawler UA (unlocks OG tags on Facebook, news sites, etc.)
    const meta1 = await tryFetch(USER_AGENTS[0], controller.signal);

    if (meta1 && meta1["__direct_image__"]) {
      clearTimeout(timeoutId);
      return buildResult(meta1);
    }

    if (meta1 && hasUsefulMeta(meta1)) {
      clearTimeout(timeoutId);
      return buildResult(meta1);
    }

    // Attempt 2 — Chrome UA retry (for sites that block crawlers but serve browsers normally)
    const meta2 = await tryFetch(USER_AGENTS[1], controller.signal);
    clearTimeout(timeoutId);

    if (meta2 && (meta2["__direct_image__"] || hasUsefulMeta(meta2))) {
      return buildResult(meta2);
    }

    // If attempt 1 gave *something* (even just a <title>), prefer that over total fallback
    if (meta1) return buildResult(meta1);
    if (meta2) return buildResult(meta2);

    return fallbackResult;
  } catch {
    clearTimeout(timeoutId);
    return fallbackResult;
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body?.url || "").trim();

    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Check cache
    const now = Date.now();
    const cached = previewCache.get(targetUrl);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    const metadata = await fetchLinkMetadata(targetUrl);

    // Maintain cache size & save
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
    return NextResponse.json({ error: err?.message || "Failed to fetch link preview" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = (searchParams.get("url") || "").trim();

    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Check cache
    const now = Date.now();
    const cached = previewCache.get(targetUrl);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    const metadata = await fetchLinkMetadata(targetUrl);

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
    return NextResponse.json({ error: err?.message || "Failed to fetch link preview" }, { status: 500 });
  }
}
