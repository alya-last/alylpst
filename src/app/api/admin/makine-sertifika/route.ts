import { NextResponse } from 'next/server'
import net from 'node:net'
import tls from 'node:tls'
import { modulGerekli } from '@/lib/yetki'

export const runtime = 'nodejs'
export const maxDuration = 30

// GEÇİCİ: makine veritabanı sunucusunun SSL sertifikasını okur (şifre/kimlik bilgisi GÖNDERMEZ — yalnızca PostgreSQL SSL el sıkışması).
// Yalnızca tam yetkili (*) yönetici. Parmak izi doğrulandıktan sonra bu uç kaldırılacak.
const HOST = '195.201.236.135', PORT = 54320

export async function GET() {
  const y = await modulGerekli(['*']); if (y.hata) return y.hata
  try {
    const bilgi = await new Promise<any>((resolve, reject) => {
      const sock = net.connect({ host: HOST, port: PORT, timeout: 10000 })
      sock.once('timeout', () => { sock.destroy(); reject(new Error('Bağlantı zaman aşımı')) })
      sock.once('error', reject)
      sock.once('connect', () => sock.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]))) // PostgreSQL SSLRequest
      sock.once('data', (b: Buffer) => {
        if (b.toString('latin1', 0, 1) !== 'S') { sock.destroy(); return reject(new Error('Sunucu SSL desteklemiyor (yanıt: ' + b.toString('latin1', 0, 1) + ')')) }
        const t = tls.connect({ socket: sock, rejectUnauthorized: false }, () => {
          const c: any = t.getPeerCertificate(true)
          const out = { konu: c.subject, veren: c.issuer, gecerlilik_bas: c.valid_from, gecerlilik_bit: c.valid_to, alt_adlar: c.subjectaltname || null, parmak_izi_sha256: c.fingerprint256, kendi_imzali: JSON.stringify(c.subject) === JSON.stringify(c.issuer), sertifika_pem: c.raw ? '-----BEGIN CERTIFICATE-----\n' + (c.raw as Buffer).toString('base64').replace(/(.{64})/g, '$1\n') + '\n-----END CERTIFICATE-----' : null, protokol: t.getProtocol() }
          t.end(); resolve(out)
        })
        t.once('error', reject)
      })
    })
    return NextResponse.json({ ok: true, host: HOST, port: PORT, ...bilgi }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, hata: String(e?.message || e).slice(0, 200) }, { status: 502 })
  }
}
