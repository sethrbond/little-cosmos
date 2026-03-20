// Supabase Edge Function: daily-digest
// Runs daily via Supabase cron to send "On This Day" push notifications.
//
// Setup:
// 1. Deploy: supabase functions deploy daily-digest
// 2. Create cron job in Supabase dashboard:
//    SELECT cron.schedule('daily-otd', '0 9 * * *',
//      $$SELECT net.http_post(
//        url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/daily-digest',
//        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
//      )$$
//    );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const thisYear = now.getFullYear();

  // Find all entries from today's date in previous years
  const { data: entries } = await supabase
    .from("entries")
    .select("id, city, date_start, world_id, user_id")
    .like("date_start", `%-${mm}-${dd}`);

  if (!entries || entries.length === 0) {
    return new Response(JSON.stringify({ message: "No On This Day entries", sent: 0 }));
  }

  // Group by user_id and filter out current year
  const byUser: Record<string, Array<{ city: string; yearsAgo: number; worldId: string }>> = {};
  for (const e of entries) {
    const entryYear = parseInt(e.date_start.slice(0, 4));
    if (entryYear >= thisYear) continue;

    const userId = e.user_id;
    if (!byUser[userId]) byUser[userId] = [];
    byUser[userId].push({
      city: e.city || "a special place",
      yearsAgo: thisYear - entryYear,
      worldId: e.world_id,
    });
  }

  // Send push to each user
  let totalSent = 0;
  const sendPushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;

  for (const [userId, memories] of Object.entries(byUser)) {
    const topMemory = memories[0];
    const body = memories.length === 1
      ? `${topMemory.yearsAgo} year${topMemory.yearsAgo !== 1 ? "s" : ""} ago: ${topMemory.city}`
      : `${topMemory.yearsAgo}y ago in ${topMemory.city} + ${memories.length - 1} more`;

    try {
      await fetch(sendPushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title: "\u{1F4CD} On This Day",
          body,
          tag: `otd-${mm}${dd}`,
          data: { worldId: topMemory.worldId },
        }),
      });
      totalSent++;
    } catch (err) {
      console.error(`[daily-digest] Failed for user ${userId}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, users: Object.keys(byUser).length }));
});
