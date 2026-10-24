import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Oturumdaki kullanıcının rol modüllerini doğrular. mods boşsa "personel olmak" (rol atanmış olmak) yeterlidir.
// Yetki kontrolü kullanıcının KENDİ oturumuyla (RLS'e tabi) yapılır.
export async function modulGerekli(mods: string[] = []) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { hata: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) } as const

  const { data: profile } = await sb.from('admin_profiles').select('role_id').eq('id', user.id).single()
  if (!profile?.role_id) return { hata: NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 }) } as const
  const { data: role } = await sb.from('roller').select('moduller').eq('id', profile.role_id).single()
  const m: string[] = role?.moduller || []
  if (mods.length && !(m.includes('*') || mods.some(x => m.includes(x)))) return { hata: NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 }) } as const
  return { sb, user, moduller: m } as const
}
