import { createAdminClient } from "@timber/database";
import { NextRequest, NextResponse } from "next/server";

// Parse User-Agent string
function parseUserAgent(ua: string | null): {
  deviceType: string;
  browser: string;
  os: string;
  isBot: boolean;
} {
  if (!ua) {
    return { deviceType: "unknown", browser: "unknown", os: "unknown", isBot: false };
  }

  const uaLower = ua.toLowerCase();

  // Bot detection
  const botPatterns = [
    "bot", "crawler", "spider", "slurp", "bingpreview", "facebookexternalhit",
    "linkedinbot", "twitterbot", "whatsapp", "telegram", "googlebot",
    "baiduspider", "yandexbot", "duckduckbot", "headless", "puppeteer",
    "playwright", "lighthouse", "pagespeed", "pingdom", "uptimerobot"
  ];
  const isBot = botPatterns.some(pattern => uaLower.includes(pattern));

  // Device type
  let deviceType = "desktop";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = "mobile";
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = "tablet";
  }

  // Browser detection
  let browser = "unknown";
  if (uaLower.includes("edg/")) browser = "Edge";
  else if (uaLower.includes("opr/") || uaLower.includes("opera")) browser = "Opera";
  else if (uaLower.includes("chrome") && !uaLower.includes("chromium")) browser = "Chrome";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari";
  else if (uaLower.includes("firefox")) browser = "Firefox";
  else if (uaLower.includes("msie") || uaLower.includes("trident/")) browser = "IE";

  // OS detection
  let os = "unknown";
  if (uaLower.includes("windows")) os = "Windows";
  else if (uaLower.includes("mac os") || uaLower.includes("macos")) os = "macOS";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "iOS";
  else if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("linux")) os = "Linux";
  else if (uaLower.includes("chromeos")) os = "ChromeOS";

  return { deviceType, browser, os, isBot };
}

interface TrackingPayload {
  sessionId: string;
  eventName: string;
  eventCategory?: string;
  properties?: Record<string, unknown>;
  pagePath?: string;
  locale?: string;
  referrer?: string;
  userId?: string; // Authenticated user ID if available
  // Quote funnel specific
  funnelAction?: "view" | "field_focus" | "submit" | "success";
  fieldName?: string;
  selectedProductIds?: string[];
  timeOnFormMs?: number;
}

// Extract client IP from request headers
function getClientIp(request: NextRequest): string | null {
  // x-forwarded-for can contain multiple IPs (client, proxies)
  // The first one is the original client IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    return ips[0] || null;
  }

  // Fallback headers
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Vercel-specific header
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const ips = vercelIp.split(",").map(ip => ip.trim());
    return ips[0] || null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackingPayload = await request.json();
    const { sessionId, eventName, eventCategory, properties, pagePath, locale, referrer, userId } = payload;

    if (!sessionId || !eventName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Extract Vercel geo data from headers
    const countryCode = request.headers.get("x-vercel-ip-country") || null;
    const city = request.headers.get("x-vercel-ip-city") || null;
    const region = request.headers.get("x-vercel-ip-country-region") || null;

    // Extract client IP address
    const ipAddress = getClientIp(request);

    // Parse User-Agent
    const userAgent = request.headers.get("user-agent");
    const { deviceType, browser, os, isBot } = parseUserAgent(userAgent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // Upsert session
    const { error: sessionError } = await supabase
      .from("analytics_sessions")
      .upsert(
        {
          session_id: sessionId,
          country_code: countryCode,
          city: city,
          region: region,
          device_type: deviceType,
          browser: browser,
          os: os,
          is_bot: isBot,
          locale: locale || null,
          referrer: referrer || null,
          ip_address: ipAddress,
          user_id: userId || null,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id",
          ignoreDuplicates: false,
        }
      );

    if (sessionError) {
      console.error("Session upsert error:", sessionError);
      return NextResponse.json({ error: "Failed to track session" }, { status: 500 });
    }

    // Insert event
    const { error: eventError } = await supabase.from("analytics_events").insert({
      session_id: sessionId,
      event_name: eventName,
      event_category: eventCategory || null,
      properties: properties || {},
      page_path: pagePath || null,
    });

    if (eventError) {
      console.error("Event insert error:", eventError);
      return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
    }

    // Handle quote funnel tracking
    if (payload.funnelAction) {
      await handleQuoteFunnel(supabase, sessionId, payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics tracking error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleQuoteFunnel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
  payload: TrackingPayload
) {
  const { funnelAction, fieldName, selectedProductIds, timeOnFormMs } = payload;
  const now = new Date().toISOString();

  // First, try to get existing funnel record
  const { data: existing } = await supabase
    .from("analytics_quote_funnels")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (!existing) {
    // Create new funnel record
    const newRecord: Record<string, unknown> = {
      session_id: sessionId,
    };

    if (funnelAction === "view") {
      newRecord.form_viewed = true;
      newRecord.form_viewed_at = now;
      newRecord.selected_product_ids = selectedProductIds || [];
    }

    await supabase.from("analytics_quote_funnels").insert(newRecord);
    return;
  }

  // Update existing record
  const updates: Record<string, unknown> = {};

  switch (funnelAction) {
    case "view":
      if (!existing.form_viewed) {
        updates.form_viewed = true;
        updates.form_viewed_at = now;
        updates.selected_product_ids = selectedProductIds || [];
      }
      break;
    case "field_focus":
      if (!existing.fields_interacted) {
        updates.fields_interacted = true;
        updates.fields_interacted_at = now;
      }
      if (fieldName) {
        const currentFields = existing.fields_touched || [];
        if (!currentFields.includes(fieldName)) {
          updates.fields_touched = [...currentFields, fieldName];
        }
      }
      break;
    case "submit":
      updates.form_submitted = true;
      updates.form_submitted_at = now;
      if (timeOnFormMs) {
        updates.time_on_form_ms = timeOnFormMs;
      }
      break;
    case "success":
      updates.submission_success = true;
      updates.submission_success_at = now;
      if (timeOnFormMs) {
        updates.time_on_form_ms = timeOnFormMs;
      }
      break;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("analytics_quote_funnels")
      .update(updates)
      .eq("session_id", sessionId);
  }
}
