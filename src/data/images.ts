// Anasayfada GERÇEKTEN render edilen sabit vitrin/dekoratif görseller. Önceden burada 25+ eski
// Cloudinary stok fotoğrafı vardı; yalnızca 7'si (aşağıdaki anahtarlar) Hero/Why/FullscreenFeature
// içinde kullanılıyordu — geri kalanı hiçbir yerde render edilmiyordu ama "img" prop'u sunucu
// bileşeninden istemciye geçerken tüm objeyle birlikte sayfa verisine (RSC payload) gömülüyordu.
// Kullanılmayan anahtarlar kaldırıldı (bkz. TEMA_ALANLARI ile bire bir eşleşme).
export const IMG = {
  fikir:    "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/fikir/1790527824319.png",
  ufo:      "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/ufo/1790527881493.png",
  dantel:   "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/dantel/1790527954856.png",
  d3:       "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/d3/1790528029203.png",
  venusAsk: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/venusAsk/1790528088874.png",
  kordon:   "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/kordon/1790528232838.png",
  hero2:    "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/tema/hero2/1790528769900.png",
};

// "Tema Yönetimi" admin ekranında AI ile yeniden tasarlanabilen sabit vitrin/dekoratif görseller.
export const TEMA_ALANLARI: { key: keyof typeof IMG; ad: string; aciklama: string }[] = [
  { key: "fikir", ad: "Anasayfa — Hero Sol Zemin Dokusu", aciklama: "Hero bölümünün sol (metin) tarafında soluk arka plan dokusu olarak kullanılır." },
  { key: "ufo", ad: "Anasayfa — Hero Vitrin 1 / \"Neden Biz\"", aciklama: "Hero sağ 2×2 ızgaranın ilk karesi ve \"Neden Biz\" bölümünde tekrar kullanılır." },
  { key: "dantel", ad: "Anasayfa — Hero Vitrin 2", aciklama: "Hero sağ 2×2 ızgaranın ikinci karesi." },
  { key: "d3", ad: "Anasayfa — Hero Vitrin 3", aciklama: "Hero sağ 2×2 ızgaranın üçüncü karesi." },
  { key: "venusAsk", ad: "Anasayfa — Hero Vitrin 4", aciklama: "Hero sağ 2×2 ızgaranın dördüncü karesi." },
  { key: "kordon", ad: "Anasayfa — Mobil Hero Görseli", aciklama: "Mobil görünümde hero bölümünün sağında gösterilen tekil görsel." },
  { key: "hero2", ad: "Anasayfa — Tam Ekran Bölüm Arka Planı", aciklama: "\"Fikirden formaya\" tam ekran bölümünün arka plan fotoğrafı." },
];
export const TEMA_ALAN_ANAHTARLARI = TEMA_ALANLARI.map(a => a.key);

/** Varsayılan IMG üzerine (varsa) admin tarafından kaydedilmiş özel tema görsellerini bindirir. */
export function resolveImg(override?: Partial<Record<keyof typeof IMG, string>> | null): typeof IMG {
  return override && Object.keys(override).length ? { ...IMG, ...override } : IMG;
}
