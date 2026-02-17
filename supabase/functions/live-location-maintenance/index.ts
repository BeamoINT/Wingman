import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const maintenanceSecret = Deno.env.get("LIVE_LOCATION_MAINTENANCE_SECRET");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  if (maintenanceSecret) {
    const providedSecret = req.headers.get("x-maintenance-secret");
    if (!providedSecret || providedSecret !== maintenanceSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabaseAdmin.rpc("expire_live_location_state_v1");

    if (error) {
      console.error("live-location-maintenance rpc failure", {
        code: error.code || "unknown",
      });
      return jsonResponse({ error: "Failed to clean live location state" }, 500);
    }

    const row = Array.isArray(data) ? data[0] : data;
    const expiredSharesCount = Number((row as Record<string, unknown> | null)?.expired_shares_count || 0);
    const deletedPointsCount = Number((row as Record<string, unknown> | null)?.deleted_points_count || 0);

    console.log("live-location-maintenance cleanup", {
      expiredSharesCount,
      deletedPointsCount,
    });

    return jsonResponse({
      success: true,
      expiredSharesCount,
      deletedPointsCount,
    });
  } catch (error) {
    console.error("live-location-maintenance internal error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
