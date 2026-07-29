import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { title, body, segment, target_user_id } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSegments = ["all", "premium", "free", "specific"];
    const effectiveSegment = segment || "specific";

    if (!validSegments.includes(effectiveSegment)) {
      return new Response(
        JSON.stringify({ error: `segment must be one of: ${validSegments.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (effectiveSegment === "specific" && !target_user_id) {
      return new Response(
        JSON.stringify({ error: "target_user_id is required when segment is 'specific'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target users based on segment
    let targetUserIds: string[] = [];

    if (effectiveSegment === "specific") {
      targetUserIds = [target_user_id];
    } else if (effectiveSegment === "all") {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id");
      targetUserIds = (profiles || []).map((p: { id: string }) => p.id);
    } else if (effectiveSegment === "premium") {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("is_premium", true);
      targetUserIds = (profiles || []).map((p: { id: string }) => p.id);
    } else if (effectiveSegment === "free") {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("is_premium", false);
      targetUserIds = (profiles || []).map((p: { id: string }) => p.id);
    }

    // Get the sender from the Authorization header
    const authHeader = req.headers.get("Authorization");
    let sentBy: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await userClient.auth.getUser(token);
      sentBy = user?.id || null;
    }

    // Insert notification rows for each target user
    const notificationRows = targetUserIds.map((userId: string) => ({
      target_user_id: userId,
      segment: effectiveSegment,
      title,
      body: body || null,
      sent_by: sentBy,
    }));

    // For segment-based notifications with no profiles yet, insert a single
    // row without target_user_id so it can still be queried by segment
    if (targetUserIds.length === 0 && effectiveSegment !== "specific") {
      notificationRows.push({
        target_user_id: null as unknown as string,
        segment: effectiveSegment,
        title,
        body: body || null,
        sent_by: sentBy,
      });
    }

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notificationRows);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Broadcast via Supabase Realtime to each target user's channel
    for (const userId of targetUserIds) {
      const channel = supabase.channel(`user-notifications:${userId}`);
      await channel.send({
        type: "broadcast",
        event: "new-notification",
        payload: { title, body, segment: effectiveSegment },
      });
      supabase.removeChannel(channel);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_to: targetUserIds.length,
        segment: effectiveSegment,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
