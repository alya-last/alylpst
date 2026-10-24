// OpenAI istemcisi — yalnızca sunucu tarafında kullanılır (API anahtarı tarayıcıya asla gitmez).
// OPENAI_API_KEY tanımlı değilse tüm AI özellikleri sessizce devre dışı kalır.
//
// Ortam değişkenleri:
//   OPENAI_API_KEY   (zorunlu)
//   OPENAI_MODEL     (opsiyonel, varsayılan gpt-4.1-mini) — metin/görsel/araç çağrısı için
//   OPENAI_BASE_URL  (opsiyonel, varsayılan https://api.openai.com/v1)

export const aiAktif = () => !!process.env.OPENAI_API_KEY
export const AI_MODEL = () => process.env.OPENAI_MODEL || 'gpt-4.1-mini'

export class AiHata extends Error {
  constructor(message: string, public durum = 502) { super(message) }
}

export type AiMesaj =
  | { role: 'system' | 'user' | 'assistant'; content: string | AiIcerik[] | null; tool_calls?: AiAracCagrisi[] }
  | { role: 'tool'; tool_call_id: string; content: string }
export type AiIcerik =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  | { type: 'file'; file: { filename: string; file_data: string } }
export type AiAracCagrisi = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type AiArac = { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }

type CagriSecenek = {
  messages: AiMesaj[]
  tools?: AiArac[]
  json?: { name: string; schema: Record<string, unknown> }
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  model?: string
}

export async function aiCagir(o: CagriSecenek) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AiHata('AI özelliği yapılandırılmamış (OPENAI_API_KEY tanımlı değil).', 503)
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')

  const body: Record<string, unknown> = {
    model: o.model || AI_MODEL(),
    messages: o.messages,
    max_completion_tokens: o.maxTokens ?? 900,
  }
  if (o.temperature !== undefined) body.temperature = o.temperature
  if (o.tools?.length) { body.tools = o.tools; body.tool_choice = 'auto' }
  if (o.json) body.response_format = { type: 'json_schema', json_schema: { name: o.json.name, strict: true, schema: o.json.schema } }

  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(o.timeoutMs ?? 45000),
    })
  } catch (e: any) {
    throw new AiHata(e?.name === 'TimeoutError' ? 'AI yanıtı zaman aşımına uğradı.' : 'AI servisine ulaşılamadı.', 504)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('[ai] OpenAI hata', res.status, t.slice(0, 500))
    if (res.status === 401) throw new AiHata('OpenAI API anahtarı geçersiz.', 502)
    if (res.status === 429) throw new AiHata('OpenAI kotası/istek limiti doldu, biraz sonra tekrar deneyin.', 429)
    throw new AiHata('AI isteği başarısız oldu.', 502)
  }
  const j = await res.json()
  const msg = j?.choices?.[0]?.message
  if (!msg) throw new AiHata('AI boş yanıt döndürdü.')
  return msg as { content: string | null; tool_calls?: AiAracCagrisi[]; refusal?: string | null }
}

// Yapılandırılmış (JSON şemalı) çıktı — şema strict olmalı: tüm alanlar required, additionalProperties:false.
export async function aiJson<T>(messages: AiMesaj[], name: string, schema: Record<string, unknown>, opt: { maxTokens?: number; timeoutMs?: number; model?: string } = {}): Promise<T> {
  const msg = await aiCagir({ messages, json: { name, schema }, maxTokens: opt.maxTokens, timeoutMs: opt.timeoutMs, model: opt.model })
  if (msg.refusal) throw new AiHata('AI bu isteği reddetti.', 422)
  try { return JSON.parse(msg.content || '') as T } catch { throw new AiHata('AI yanıtı çözümlenemedi.') }
}

// Kullanıcı kaynaklı (güvenilmeyen) metni modele "veri" olarak verirken kullanılır.
export const veriBlok = (etiket: string, metin: string) => `<${etiket}>\n${String(metin).replace(/<\/?[a-z_]+>/gi, ' ').slice(0, 6000)}\n</${etiket}>`

// Şema kısayolları (strict mod için)
export const S = {
  str: { type: 'string' } as const,
  num: { type: 'number' } as const,
  bool: { type: 'boolean' } as const,
  nullNum: { type: ['number', 'null'] } as const,
  nullStr: { type: ['string', 'null'] } as const,
  enum: (...v: string[]) => ({ type: 'string', enum: v }),
  arr: (items: Record<string, unknown>) => ({ type: 'array', items }),
  obj: (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }),
}
