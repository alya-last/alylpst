import { notify } from '@/lib/notify'

// Yönetici paneli güvenlik olayları: şifre/2FA değişikliği, kullanıcı ekleme-silme, rol değişikliği.
// Bildirimler sayfasındaki "Yönetici Güvenlik Olayı" alıcılarına gider (tanımlı değilse sessizce atlanır).
export const OLAY_AD = {
  sifre_degisti: 'Şifre değiştirildi',
  mfa_acildi: 'İki adımlı doğrulama AÇILDI',
  mfa_kapandi: 'İki adımlı doğrulama KAPATILDI',
  mfa_sifirlandi: 'Bir kullanıcının iki adımlı doğrulaması SIFIRLANDI',
  kullanici_eklendi: 'Yeni personel eklendi',
  sifre_sifirlandi: "Bir kullanıcının şifresi admin tarafından sıfırlandı",
  rol_degisti: 'Kullanıcının rolü değiştirildi',
  kullanici_pasif: 'Kullanıcı pasife alındı',
  kullanici_aktif: 'Kullanıcı yeniden aktifleştirildi',
  kullanici_silindi: 'Kullanıcı SİLİNDİ',
  yedek_alindi: 'Tüm veri yedeği indirildi',
  veriler_silindi: 'Tüm tablo verileri silindi',
  sistem_imha_edildi: 'SİSTEM İMHA EDİLDİ: tüm veri, dosya ve hesaplar silindi',
} as const
export type Olay = keyof typeof OLAY_AD
export const ISTEMCI_OLAYLARI: Olay[] = ['sifre_degisti', 'mfa_acildi', 'mfa_kapandi']

export async function yoneticiOlayi(kim: string, olay: Olay, detay = '', ip = '') {
  const zaman = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const satirlar: (string | false)[] = ['Alya Plastik panel güvenlik bildirimi', '', OLAY_AD[olay], `İşlemi yapan: ${kim}`, !!detay && `Ayrıntı: ${detay}`, !!ip && `IP: ${ip}`, `Zaman: ${zaman}`, '', 'Bu işlemi siz yapmadıysanız şifreleri değiştirin ve Kullanıcılar sayfasından hesapları kontrol edin.']
  const metin = satirlar.filter((x): x is string => x !== false).join('\n')
  await notify('yonetici_olay', `Panel güvenlik: ${OLAY_AD[olay]}`, metin, { olay, kim })
}
