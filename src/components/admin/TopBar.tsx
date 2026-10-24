'use client'
import { usePathname } from 'next/navigation'
import QuickActions from './QuickActions'
import MuhasebeRehberi from './MuhasebeRehberi'
import MuhasebeUyarilar from './MuhasebeUyarilar'
import GrupUyarilar from './GrupUyarilar'
import GrupRehberi from './GrupRehberi'
import { grupBul } from '@/lib/kontrol-gruplar'

export default function AdminTopBar({ title }: { title: string }) {
  const yol = usePathname() || ''
  const muhasebe = yol.includes('/muhasebe')
  const grup = muhasebe ? null : grupBul(yol)
  return (
    <div className="adm-topbar">
      <h1>{title}</h1>
      <div style={{marginLeft:'auto', display:'flex', alignItems:'center'}}>
        {muhasebe && <MuhasebeUyarilar/>}
        {muhasebe && <MuhasebeRehberi/>}
        {grup && <GrupUyarilar key={grup} grup={grup}/>}
        {grup && <GrupRehberi key={grup} grup={grup}/>}
        <QuickActions/>
      </div>
    </div>
  )
}
