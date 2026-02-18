import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 180;
const rateLimitStore = new Map<string, RateLimitEntry>();

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return true;
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return false;
}

function renderViewerHtml(params: {
  token: string;
  googleMapsApiKey?: string | null;
}): string {
  const googleMapsScript = params.googleMapsApiKey
    ? `<script async src="https://maps.googleapis.com/maps/api/js?key=${params.googleMapsApiKey}"></script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wingman Live Location</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1220; color: #e5e7eb; }
    .shell { max-width: 900px; margin: 0 auto; padding: 20px; }
    .card { border: 1px solid #1f2937; border-radius: 14px; background: #111827; padding: 16px; }
    .status { margin: 0 0 10px; font-size: 15px; color: #93c5fd; }
    .meta { margin: 0; font-size: 13px; color: #9ca3af; }
    #map { height: 65vh; border-radius: 12px; margin-top: 14px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #9ca3af; }
    .error { color: #fca5a5; }
  </style>
  ${googleMapsScript}
</head>
<body>
  <div class="shell">
    <div class="card">
      <p id="status" class="status">Loading live location...</p>
      <p id="meta" class="meta">Waiting for latest location update.</p>
      <div id="map">Preparing map...</div>
    </div>
  </div>

  <script>
    const token = ${JSON.stringify(params.token)};
    const statusEl = document.getElementById('status');
    const metaEl = document.getElementById('meta');
    const mapEl = document.getElementById('map');
    let map = null;
    let marker = null;

    function setStatus(text, isError = false) {
      statusEl.textContent = text;
      statusEl.className = isError ? 'status error' : 'status';
    }

    function updateMap(lat, lng) {
      const hasGoogle = !!window.google && !!window.google.maps;
      if (!hasGoogle) {
        mapEl.textContent = 'Latest coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
        return;
      }

      if (!map) {
        map = new window.google.maps.Map(mapEl, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: false,
        });

        marker = new window.google.maps.Marker({
          map,
          position: { lat, lng },
          title: 'Current location',
        });
        return;
      }

      marker.setPosition({ lat, lng });
      map.panTo({ lat, lng });
    }

    async function refresh() {
      try {
        const url = window.location.pathname + '?token=' + encodeURIComponent(token) + '&view=json';
        const response = await fetch(url, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          setStatus(payload.error || 'Unable to load location', true);
          metaEl.textContent = 'This link may have expired or been revoked.';
          return;
        }

        if (!payload.active) {
          setStatus('Live sharing is not active');
          metaEl.textContent = 'This sharing session has ended.';
          mapEl.textContent = 'No active location data';
          return;
        }

        if (!payload.location) {
          setStatus('Live sharing is active');
          metaEl.textContent = 'Waiting for next location update...';
          mapEl.textContent = 'No location sample yet';
          return;
        }

        setStatus('Live sharing is active');
        metaEl.textContent = 'Updated at: ' + new Date(payload.location.capturedAt).toLocaleString();
        updateMap(payload.location.latitude, payload.location.longitude);
      } catch {
        setStatus('Network error while loading location', true);
      }
    }

    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const signingSecret = Deno.env.get("EMERGENCY_LINK_SIGNING_SECRET");
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_WEB_API_KEY") || null;

  if (!supabaseUrl || !supabaseServiceRoleKey || !signingSecret) {
    return jsonResponse({ error: "Live location viewer is unavailable" }, 500);
  }

  try {
    const url = new URL(req.url);
    const token = toTrimmed(url.searchParams.get("token"));
    const view = toTrimmed(url.searchParams.get("view")).toLowerCase();

    if (!token) {
      return view === "json"
        ? jsonResponse({ error: "Missing token" }, 400)
        : htmlResponse("<h1>Missing token</h1>", 400);
    }

    const tokenHash = await sha256Hex(`${signingSecret}:${token}`);

    if (isRateLimited(tokenHash)) {
      return view === "json"
        ? jsonResponse({ error: "Too many requests" }, 429)
        : htmlResponse("<h1>Too many requests</h1>", 429);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("emergency_live_location_view_tokens")
      .select("id,share_id,status,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return view === "json"
        ? jsonResponse({ error: "Invalid link" }, 404)
        : htmlResponse("<h1>Invalid link</h1>", 404);
    }

    const nowIso = new Date().toISOString();
    const tokenExpired = tokenRow.status !== "active" || tokenRow.expires_at <= nowIso;

    if (tokenExpired) {
      await supabaseAdmin
        .from("emergency_live_location_view_tokens")
        .update({
          status: "expired",
          updated_at: nowIso,
        })
        .eq("id", tokenRow.id);

      return view === "json"
        ? jsonResponse({ active: false, expired: true })
        : htmlResponse(renderViewerHtml({ token, googleMapsApiKey }), 200);
    }

    await supabaseAdmin
      .from("emergency_live_location_view_tokens")
      .update({
        last_accessed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", tokenRow.id);

    const { data: shareRow } = await supabaseAdmin
      .from("emergency_live_location_shares")
      .select("id,status,expires_at,booking_id,user_id")
      .eq("id", tokenRow.share_id)
      .maybeSingle();

    const isActiveShare = !!shareRow
      && shareRow.status === "active"
      && String(shareRow.expires_at) > nowIso;

    const { data: pointRow } = isActiveShare
      ? await supabaseAdmin
        .from("emergency_live_location_points")
        .select("latitude,longitude,accuracy_m,captured_at,updated_at,expires_at")
        .eq("share_id", tokenRow.share_id)
        .gt("expires_at", nowIso)
        .maybeSingle()
      : { data: null };

    if (view === "json") {
      return jsonResponse({
        active: isActiveShare,
        expiresAt: shareRow?.expires_at || tokenRow.expires_at,
        location: pointRow
          ? {
            latitude: pointRow.latitude,
            longitude: pointRow.longitude,
            accuracyM: pointRow.accuracy_m,
            capturedAt: pointRow.captured_at || pointRow.updated_at,
          }
          : null,
      });
    }

    return htmlResponse(renderViewerHtml({
      token,
      googleMapsApiKey,
    }));
  } catch (error) {
    console.error("emergency-live-location-view internal error", {
      message: error instanceof Error ? error.message : "unknown",
    });

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
