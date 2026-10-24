import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Oturumdaki kullanıcının kendi id'si — istemcinin "bu ben miyim" kontrolü için (ör. kendini pasife alamama).
export async function GET() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
  return NextResponse.json({ id: user.id, email: user.email })
}
