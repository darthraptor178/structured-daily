import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    tasks: {
      type: 'ARRAY',
      maxItems: 30,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Short clean task title without time or duration text.' },
          date: { type: 'STRING', description: 'ISO date YYYY-MM-DD.' },
          startMin: { type: 'INTEGER', description: 'Start time as minutes after midnight, from 0 to 1439.' },
          durationMin: { type: 'INTEGER', description: 'Duration in minutes, from 5 to 240.' },
          icon: { type: 'STRING', description: 'One relevant emoji.' },
          color: { type: 'STRING', description: 'One hex color from the allowed palette.' },
        },
        required: ['title', 'date', 'startMin', 'durationMin', 'icon', 'color'],
      },
    },
  },
  required: ['tasks'],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Sign in to use AI planning' }, 401)

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(projectUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser(token)
  if (userError || !user) return json({ error: 'Your session is no longer valid' }, 401)

  const admin = createClient(projectUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: apiKey, error: keyError } = await admin.rpc('planner_api_key', { p_user_id: user.id })
  if (keyError || !apiKey) return json({ error: 'AI planning is not configured for this account', code: 'AI_NOT_CONFIGURED' }, 503)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const text = String(body.text ?? '').trim()
  const date = String(body.date ?? '')
  const timezone = String(body.timezone ?? 'Asia/Kolkata').slice(0, 80)
  const defaultStart = Math.max(0, Math.min(1439, Math.round(Number(body.defaultStart ?? 540))))
  const existingTasks = Array.isArray(body.existingTasks) ? body.existingTasks.slice(0, 80) : []
  if (!text || text.length > 3000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Describe a day in 1–3000 characters and provide a valid date' }, 400)
  }

  const prompt = `You are a precise day-planning parser. Convert the user's description into scheduled tasks.

Selected date: ${date}
Timezone: ${timezone}
Default starting minute for flexible tasks: ${defaultStart}
Existing scheduled tasks (avoid overlaps when possible): ${JSON.stringify(existingTasks)}
Allowed colors: #6C5CE7, #A06EE1, #FF6BAD, #FF7F78, #FFB347, #FFD93D, #A8E063, #70E1B1, #4ECDC4, #4CC9F0, #4361EE, #778CA3

Rules:
- Preserve the user's task order and every explicit fixed time.
- Schedule flexible tasks consecutively from the default start, moving them into free gaps around fixed events.
- Resolve today/tomorrow relative to the selected date.
- If the description says "tomorrow" and does not also say "today", assign every requested task to the next calendar day (selected date + 1), even when no clock time is provided.
- A range such as "6-8 presentation" normally means 6 PM to 8 PM unless morning context says otherwise.
- Infer a sensible duration only when missing; default to 45 minutes.
- Never exceed 240 minutes for one task. Split clearly separate activities into separate tasks.
- Return only tasks the user requested. Do not add breaks or invented activities.

User description:
${text}`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(String(apiKey))}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('Gemini planning failed', response.status, detail.slice(0, 500))
    return json({ error: response.status === 429 ? 'Free AI limit reached. Try again shortly.' : 'AI planning failed' }, response.status === 429 ? 429 : 502)
  }

  try {
    const result = await response.json()
    const output = result?.candidates?.[0]?.content?.parts?.[0]?.text
    const plan = JSON.parse(output)
    return json(plan)
  } catch (error) {
    console.error('Invalid Gemini response', error)
    return json({ error: 'AI returned an invalid plan' }, 502)
  }
})
