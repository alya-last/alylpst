'use client'
// Personel yönetim uçlarına (/api/admin/personel) istemci çağrısı.
export async function personelIstek<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try { res = await fetch('/api/admin/personel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) }) }
  catch { throw new Error('Sunucuya ulaşılamadı') }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || 'İşlem başarısız')
  return j as T
}
