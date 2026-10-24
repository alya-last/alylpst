// Gerçek Supabase browser client — @supabase/ssr, gerçek oturum/cookie yönetimi.
// Tüm .from() çağrıları doğrudan Supabase'e gider ve RLS (private.has_module vb.) tarafından korunur.
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
