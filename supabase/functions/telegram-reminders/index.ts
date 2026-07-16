import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

type TelegramSetting = { user_id: string; chat_id: string; enabled: boolean }
type ReminderTask = { id: string; user_id: string; title: string; icon: string; date: string | null; start_min: number | null; telegram_remind_at: number }

function formatTime(startMin: number | null) {
  if (startMin === null) return ''
  const hours = Math.floor(startMin / 60)
  const minutes = startMin % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour = hours % 12 || 12
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: token, error: tokenError } = await admin.rpc('telegram_bot_token')
  if (tokenError || !token) return new Response(JSON.stringify({ error: 'Telegram bot is not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } })

  const now = Date.now()
  const [{ data: settings, error: settingsError }, { data: tasks, error: tasksError }] = await Promise.all([
    admin.from('telegram_settings').select('user_id,chat_id,enabled').eq('enabled', true),
    admin.from('tasks').select('id,user_id,title,icon,date,start_min,telegram_remind_at').eq('done', false).is('telegram_reminder_sent_at', null).not('telegram_remind_at', 'is', null).lte('telegram_remind_at', now).limit(50),
  ])
  if (settingsError || tasksError) return new Response(JSON.stringify({ error: settingsError?.message ?? tasksError?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  const chats = new Map((settings as TelegramSetting[]).map((item) => [item.user_id, item.chat_id]))
  let sent = 0
  for (const task of tasks as ReminderTask[]) {
    const chatId = chats.get(task.user_id)
    if (!chatId) continue
    const time = formatTime(task.start_min)
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `⏰ ${task.icon || '📝'} ${task.title}\n${task.date ?? ''}${time ? ` · ${time}` : ''}\nTime to focus.` }),
    })
    if (response.ok) {
      await admin.from('tasks').update({ telegram_reminder_sent_at: now }).eq('id', task.id)
      sent += 1
    }
  }
  return new Response(JSON.stringify({ checked: tasks?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } })
})
