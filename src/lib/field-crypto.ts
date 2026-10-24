// Alan-seviyesi şifreleme (TC kimlik no / vergi no gibi hassas kimlik alanları için).
// Anahtar SADECE sunucu ortam değişkeninde (FIELD_ENCRYPTION_KEY) tutulur, veritabanında hiç bulunmaz.
// Böylece service_role veya doğrudan DB erişimi olan biri bile bu alanları şifresiz göremez.
import crypto from 'crypto'

const KEY = process.env.FIELD_ENCRYPTION_KEY
  ? Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'hex')
  : null

const PREFIX = 'enc:v1:'

export function encryptField(plain: string | null | undefined): string | null {
  if (!plain) return plain ?? null
  if (!KEY) return plain // anahtar yoksa (örn. yerel geliştirme) düz geç, çökme
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  if (!value.startsWith(PREFIX)) return value // eski/şifrelenmemiş veri — olduğu gibi göster
  if (!KEY) return '••••••••' // anahtar yoksa çözemeyiz, düz metni asla yanlışlıkla sızdırma
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64')
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return '••••••••'
  }
}
