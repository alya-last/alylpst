import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Sunucu tarafı bildirim gönderici.
// notification_settings tablosu RLS ile korunduğu için service_role ile okunur.
// E-posta: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
// WhatsApp: N8N_WHATSAPP_WEBHOOK_URL (+ opsiyonel N8N_WEBHOOK_SECRET)
// Tanımlı değilse ilgili kanal sessizce atlanır (loglanır), site akışı bozulmaz.

export type NotifyEvent = 'new_contact' | 'new_visit_milestone' | 'mevzuat_uyari' | 'gunluk_ozet' | 'yonetici_olay'

function admin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil')
  return createClient(url, key, { auth: { persistSession: false } })
}

export { admin as supabaseAdmin }

export function channelStatus() {
  const missingEmail = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(k => !process.env[k])
  return {
    email: { ok: missingEmail.length === 0, missing: missingEmail },
    whatsapp: { ok: !!process.env.N8N_WHATSAPP_WEBHOOK_URL, missing: process.env.N8N_WHATSAPP_WEBHOOK_URL ? [] : ['N8N_WHATSAPP_WEBHOOK_URL'] },
    // Sosyal medya n8n bağlantısı (yalnızca 'tanımlı mı' bilgisi; değerler hiçbir zaman istemciye gönderilmez)
    sosyalGelen: { ok: (process.env.N8N_SOSYAL_API_TOKEN || '').length >= 32, missing: (process.env.N8N_SOSYAL_API_TOKEN || '').length >= 32 ? [] : ['N8N_SOSYAL_API_TOKEN (en az 32 karakter)'] },
    potansiyel: { ok: (process.env.N8N_LEAD_API_TOKEN || process.env.N8N_SOSYAL_API_TOKEN || '').length >= 32, missing: (process.env.N8N_LEAD_API_TOKEN || process.env.N8N_SOSYAL_API_TOKEN || '').length >= 32 ? [] : ['N8N_LEAD_API_TOKEN (en az 32 karakter)'] },
    sosyalGiden: (() => { const m = ['N8N_SOSYAL_WEBHOOK_URL', 'N8N_SOSYAL_WEBHOOK_SECRET'].filter(k => !process.env[k]); return { ok: m.length === 0, missing: m } })(),
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP ayarı tanımlı değil (SMTP_HOST, SMTP_USER, SMTP_PASS)')
  const port = Number(SMTP_PORT || 465)
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text })
}

export async function sendWhatsApp(event: NotifyEvent | 'test', to: string, message: string, data: unknown) {
  const url = process.env.N8N_WHATSAPP_WEBHOOK_URL
  if (!url) throw new Error('N8N_WHATSAPP_WEBHOOK_URL tanımlı değil')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.N8N_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({ event, to, message, data }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`n8n webhook ${res.status}`)
}

export async function notify(event: NotifyEvent, subject: string, message: string, data: unknown = {}) {
  try {
    const { data: row, error } = await admin()
      .from('notification_settings')
      .select('*')
      .eq('event', event)
      .maybeSingle()
    if (error) throw error
    if (!row) return

    const jobs: Promise<unknown>[] = []
    if (row.email_enabled && row.email_to) jobs.push(sendEmail(row.email_to, subject, message))
    if (row.whatsapp_enabled && row.whatsapp_to) jobs.push(sendWhatsApp(event, row.whatsapp_to, message, data))

    const results = await Promise.allSettled(jobs)
    results.forEach(r => { if (r.status === 'rejected') console.error('[notify] gönderim hatası:', r.reason) })
  } catch (e) {
    console.error('[notify] hata:', e)
  }
}
