'use client'
// Yönetici paneli AI uçlarına (/api/admin/ai) istemci çağrısı. Hata ve "AI kapalı" durumunu Error olarak fırlatır.
export class AiKapali extends Error {}

export async function aiIstek<T = any>(action: string, payload: Record<string, unknown> = {}, endpoint = '/api/admin/ai'): Promise<T> {
  let res: Response
  try {
    res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) })
  } catch { throw new Error('Sunucuya ulaşılamadı') }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) { if (j.kapali) throw new AiKapali(j.error); throw new Error(j.error || 'AI işlemi başarısız') }
  return j as T
}
