import { createClient } from "@supabase/supabase-js";

const URL  = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(URL, ANON);

// ─── Types ──────────────────────────────────────────────
export type Product = {
  id: string;
  code: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string | null;
  mekan?: 'ic' | 'dis';
  description: string | null;
  image_url: string;
  images: string[];
  gorunum_360: string[];
  model_3d_url: string | null;
  specs: Record<string, string>;
  paket_bilgisi: { kod: string; adet: string; kutu_hacmi: string; kutu_agirligi: string; olculer: string; hacim: string }[] | null;
  renkler: { hex: string; ad: string; gorsel: string }[];
  tags: string[];
  is_featured: boolean;
  is_new: boolean;
  sort_order: number;
  created_at: string;
  name_i18n?: Record<string, string> | null;
  description_i18n?: Record<string, string> | null;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type Settings = {
  company: string;
  founded: number;
  address: string;
  phone: string;
  whatsapp: string;
  export_phone: string;
  email: string;
  export_email: string;
  working_hours: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
};

// Sosyal medya bağlantıları yalnızca https:// ile başlıyorsa kullanılır (javascript: vb. engellenir)
export const guvenliUrl = (u?: string | null) => (typeof u === "string" && /^https:\/\/[^\s]+$/.test(u.trim()) ? u.trim() : null);

export type Stats = {
  years: number;
  countries: number;
  models: number;
  local_production: number;
};

// ─── Queries ─────────────────────────────────────────────
export async function getFeaturedProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_featured", true)
    .order("sort_order");
  return data ?? [];
}

export async function getAllProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function getSettings(): Promise<Settings | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "site")
    .single();
  return data?.value ?? null;
}

export async function getStats(): Promise<Stats | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "stats")
    .single();
  return data?.value ?? null;
}

export async function getExportCountries(): Promise<string[]> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "export_countries")
    .single();
  return data?.value ?? [];
}

// "Tema Yönetimi" — admin panelde AI ile yeniden tasarlanmış sabit vitrin görsellerinin override URL'leri.
export async function getTemaGorselleri(): Promise<Record<string, string> | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "tema_gorselleri")
    .maybeSingle();
  return data?.value ?? null;
}

export type Katalog = { url: string; boyut?: number; guncellenme: string } | null;

// PDF katalog (dijital flipbook) — admin panelde yüklenen dosyanın URL'i ve güncellenme tarihi.
export async function getKatalog(): Promise<Katalog> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "katalog")
    .maybeSingle();
  return data?.value ?? null;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function submitContact(payload: {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}) {
  const { error } = await supabase
    .from("contact_submissions")
    .insert(payload);
  return { error };
}
