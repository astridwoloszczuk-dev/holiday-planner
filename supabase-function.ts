// Supabase Edge Function — holiday-ai
// Deploy: paste this into Supabase Dashboard → Edge Functions → New function → name it "holiday-ai"
// Then set secret: ANTHROPIC_API_KEY in Dashboard → Settings → Edge Functions → Secrets

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
  const { action, holiday_id } = await req.json();

  // ── Parse itinerary ─────────────────────────────────────────────────────────
  if (action === 'parse_itinerary') {
    const { data: h } = await db.from('holidays').select('*').eq('id', holiday_id).single();
    if (!h?.itinerary_raw) {
      return new Response(JSON.stringify({ error: 'No itinerary text saved' }), { status: 400, headers: CORS });
    }

    const msg = await callClaude('claude-haiku-4-5-20251001', 2048, `
Parse this holiday itinerary and return a JSON array of day objects.

Holiday: ${h.name}
Destination: ${h.destination}${h.country ? ', ' + h.country : ''}
Departure: ${h.depart_date ?? 'unknown'} — Return: ${h.return_date ?? 'unknown'}

Itinerary text:
${h.itinerary_raw}

Return ONLY a JSON array, no other text. Each element:
{
  "day_date": "YYYY-MM-DD",
  "day_number": 1,
  "accommodation": "Hotel name or null",
  "accommodation_city": "City or null",
  "morning": "Description or null",
  "morning_status": "planned|to_book|free",
  "lunch": "Description or null",
  "lunch_status": "planned|to_book|free",
  "afternoon": "Description or null",
  "afternoon_status": "planned|to_book|free",
  "evening": "Description or null",
  "evening_status": "planned|to_book|free"
}

Rules:
- "planned" = confirmed/booked in the text
- "to_book" = mentioned but not yet booked
- "free"    = nothing mentioned for that slot
- Include every day from departure to return (inclusive)
- If departure date unknown, number days 1, 2, 3… and estimate dates if possible
`);

    let days;
    try { days = JSON.parse(msg); } catch {
      const match = msg.match(/\[[\s\S]*\]/);
      days = match ? JSON.parse(match[0]) : [];
    }

    await db.from('holiday_days').delete().eq('holiday_id', holiday_id);
    for (const day of days) {
      await db.from('holiday_days').insert({ ...day, holiday_id });
    }

    return new Response(JSON.stringify({ success: true, days_created: days.length }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ── Generate packing list ────────────────────────────────────────────────────
  if (action === 'generate_packing') {
    const { data: h } = await db.from('holidays').select('*').eq('id', holiday_id).single();
    const { data: days } = await db.from('holiday_days').select('*').eq('holiday_id', holiday_id).order('day_date');

    const itinerarySummary = days?.length
      ? days.map(d => {
          const slots = [d.morning, d.lunch, d.afternoon, d.evening].filter(Boolean).join(' · ');
          return `Day ${d.day_number} (${d.day_date}): ${slots || 'Free day'}`;
        }).join('\n')
      : h.itinerary_raw || 'No itinerary yet';

    const msg = await callClaude('claude-sonnet-4-6', 4096, `
Generate a comprehensive packing list for this family holiday.
Emphasise NON-OBVIOUS items — things specific to the activities, destination, or season that people often forget.

Holiday: ${h.name}
Destination: ${h.destination}${h.country ? ', ' + h.country : ''}
Dates: ${h.depart_date ?? '?'} to ${h.return_date ?? '?'} (${days?.length ?? '?'} days)
Travellers: Family — adults (Astrid, Niko) + children/teens (Max, Alex, Vicky)

Itinerary:
${itinerarySummary}

Return ONLY a JSON array, no other text. Each element:
{
  "category": "clothing|toiletries|documents|gear|beach|health|kids|misc",
  "item": "Specific item name",
  "reason": "One sentence explaining WHY this is needed for this specific trip — only for non-obvious items, null for obvious ones",
  "is_obvious": true or false,
  "person": "all|Astrid|Niko|Max|Alex|Vicky"
}

Guidelines:
- is_obvious=false for items most people wouldn't automatically think of
- Be specific to activities (e.g. if paddle boarding: mention the headband to keep sunglasses on)
- Include obvious necessities too (is_obvious=true) for a complete list
- person = specific name only if that item is clearly just for one person
`);

    let items;
    try { items = JSON.parse(msg); } catch {
      const match = msg.match(/\[[\s\S]*\]/);
      items = match ? JSON.parse(match[0]) : [];
    }

    await db.from('holiday_packing').delete().eq('holiday_id', holiday_id).eq('ai_generated', true);
    for (const item of items) {
      await db.from('holiday_packing').insert({ ...item, holiday_id, ai_generated: true, checked: false });
    }

    return new Response(JSON.stringify({ success: true, items_created: items.length }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
});

async function callClaude(model: string, max_tokens: number, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}
