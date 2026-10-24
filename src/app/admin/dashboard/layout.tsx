'use client'
import { useState } from 'react'
import AdminSidebar from '@/components/admin/Sidebar'
import { Menu } from 'lucide-react'

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', position:'relative' }}>

      {/* Mobil overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:40, display:'block' }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s ease',
        width: 220,
      }} className="adm-sidebar-mobile">
        <AdminSidebar onClose={() => setOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="adm-sidebar-desktop">
        <AdminSidebar />
      </div>

      {/* Ana içerik */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Mobil topbar */}
        <div className="adm-mobile-topbar">
          <button onClick={() => setOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--adm-tx)', padding:'8px', display:'flex', alignItems:'center' }}>
            <Menu size={22}/>
          </button>
          <span style={{ fontSize:15, fontWeight:700, color:'var(--adm-tx)' }}>Alya Admin</span>
          <div style={{ width:38 }}/>
        </div>
        {children}
      </main>

      <style>{`
        .adm-sidebar-mobile { display: block; }
        .adm-sidebar-desktop { display: none; }
        .adm-mobile-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 12px; height: 52px;
          background: var(--adm-s1); border-bottom: 1px solid var(--adm-bdr);
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          .adm-sidebar-mobile { display: none !important; }
          .adm-sidebar-desktop { display: block; width: 220px; flex-shrink: 0; }
          .adm-mobile-topbar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
