'use client'
import { useEffect, useState } from 'react'
import { createClient } from './supabase/client'

// Oturumdaki yöneticinin rol modüllerini döndürür (Sidebar ile aynı mantık). '*' = tam yetki.
export function useModuller() {
  const [moduller, setModuller] = useState<string[] | null>(null)
  const [email, setEmail] = useState('')
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setModuller([])
      setEmail(user.email || '')
      const { data: profile } = await sb.from('admin_profiles').select('role_id').eq('id', user.id).single()
      if (!profile?.role_id) return setModuller([])
      const { data: role } = await sb.from('roller').select('moduller').eq('id', profile.role_id).single()
      setModuller(role?.moduller || [])
    }).catch(() => setModuller([]))
  }, [])
  const has = (...m: string[]) => !!moduller && (moduller.includes('*') || m.some(x => moduller.includes(x)))
  return { moduller, has, email, ready: moduller !== null }
}
