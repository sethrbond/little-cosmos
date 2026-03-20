// Supabase Edge Function: monthly-recap
// Sends monthly recap email digest to users.
//
// Setup:
// 1. Sign up for Resend (resend.com) and get API key
// 2. Set secret: supabase secrets set RESEND_API_KEY=re_xxx
// 3. Deploy: supabase functions deploy monthly-recap
// 4. Create cron job:
//    SELECT cron.schedule('monthly-recap', '0 10 1 * *',
//      $$SELECT net.http_post(
//        url := 'https://neduoxnmlotrygulngrv.supabase.co/functions/v1/monthly-recap',
//        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
//      )$$
//    );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Little Cosmos <hello@littlecosmos.app>";

serve(async () => {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthName = lastMonth.toLocaleString("en", { month: "long", year: "numeric" });
  const startDate = lastMonth.toISOString().slice(0, 10);
  const endDate = lastMonthEnd.toISOString().slice(0, 10);

  // Get all entries created last month, grouped by world
  const { data: entries } = await supabase
    .from("entries")
    .select("id, city, country, date_start, world_id, user_id, created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59Z");

  if (!entries || entries.length === 0) {
    return new Response(JSON.stringify({ message: "No entries last month", sent: 0 }));
  }

  // Group by user
  const byUser: Record<string, typeof entries> = {};
  for (const e of entries) {
    if (!byUser[e.user_id]) byUser[e.user_id] = [];
    byUser[e.user_id].push(e);
  }

  // Get user emails
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  const nameMap: Record<string, string> = {};
  for (const u of users || []) {
    emailMap[u.id] = u.email || "";
    nameMap[u.id] = u.user_metadata?.display_name || u.email?.split("@")[0] || "Traveler";
  }

  let sent = 0;

  for (const [userId, userEntries] of Object.entries(byUser)) {
    const email = emailMap[userId];
    if (!email) continue;

    const name = nameMap[userId];
    const cities = [...new Set(userEntries.map(e => e.city).filter(Boolean))];
    const countries = [...new Set(userEntries.map(e => e.country).filter(Boolean))];

    const html = generateRecapEmail({
      name,
      monthName,
      entryCount: userEntries.length,
      cities,
      countries,
    });

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `Your ${monthName} in Little Cosmos`,
          html,
        }),
      });

      if (res.ok) sent++;
      else console.error(`[monthly-recap] Resend error for ${email}:`, await res.text());
    } catch (err) {
      console.error(`[monthly-recap] Failed for ${email}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent, total: Object.keys(byUser).length }));
});

function generateRecapEmail({ name, monthName, entryCount, cities, countries }: {
  name: string;
  monthName: string;
  entryCount: number;
  cities: string[];
  countries: string[];
}) {
  const cityList = cities.slice(0, 5).join(", ") + (cities.length > 5 ? ` +${cities.length - 5} more` : "");
  const countryList = countries.length > 0 ? countries.join(", ") : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0a12;font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">

  <div style="text-align:center;margin-bottom:32px">
    <div style="font-size:32px;margin-bottom:8px">\uD83C\uDF0D</div>
    <h1 style="font-size:20px;font-weight:300;color:#e8e0d0;letter-spacing:1px;margin:0">
      Your ${monthName}
    </h1>
    <p style="font-size:13px;color:rgba(200,170,110,0.6);margin:6px 0 0">in Little Cosmos</p>
  </div>

  <div style="background:rgba(30,25,48,0.8);border:1px solid rgba(200,170,110,0.12);border-radius:16px;padding:24px;margin-bottom:20px">
    <p style="font-size:14px;color:#e8e0d0;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:14px;color:rgba(232,224,208,0.7);line-height:1.7;margin:0 0 20px">
      Here's what happened in your cosmos last month:
    </p>

    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;text-align:center;padding:16px;background:rgba(200,170,110,0.06);border-radius:12px;border:1px solid rgba(200,170,110,0.1)">
        <div style="font-size:28px;font-weight:300;color:#c9a96e">${entryCount}</div>
        <div style="font-size:10px;color:rgba(200,170,110,0.5);letter-spacing:.1em;text-transform:uppercase;margin-top:4px">
          ${entryCount === 1 ? "memory" : "memories"}
        </div>
      </div>
      ${countries.length > 0 ? `
      <div style="flex:1;text-align:center;padding:16px;background:rgba(196,138,168,0.06);border-radius:12px;border:1px solid rgba(196,138,168,0.1)">
        <div style="font-size:28px;font-weight:300;color:#c48aa8">${countries.length}</div>
        <div style="font-size:10px;color:rgba(196,138,168,0.5);letter-spacing:.1em;text-transform:uppercase;margin-top:4px">
          ${countries.length === 1 ? "country" : "countries"}
        </div>
      </div>` : ""}
    </div>

    ${cities.length > 0 ? `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;color:rgba(200,170,110,0.5);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Places</div>
      <p style="font-size:13px;color:rgba(232,224,208,0.6);line-height:1.6;margin:0">${cityList}</p>
    </div>` : ""}

    ${countryList ? `
    <div>
      <div style="font-size:10px;color:rgba(196,138,168,0.5);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Countries</div>
      <p style="font-size:13px;color:rgba(232,224,208,0.6);line-height:1.6;margin:0">${countryList}</p>
    </div>` : ""}
  </div>

  <div style="text-align:center;margin-bottom:32px">
    <a href="https://littlecosmos.app" style="display:inline-block;padding:12px 36px;background:linear-gradient(135deg,#c9a96e,#b8944f);color:#1a1520;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;letter-spacing:.3px">
      Open Your Cosmos
    </a>
  </div>

  <p style="text-align:center;font-size:11px;color:rgba(200,170,110,0.3);line-height:1.6">
    Little Cosmos \u00B7 A universe you fill with your story
    <br><a href="https://littlecosmos.app/settings" style="color:rgba(200,170,110,0.3)">Unsubscribe</a>
  </p>

</div>
</body>
</html>`;
}
