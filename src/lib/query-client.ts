// Ortak istemci: /api/erp ve /api/muhasebe proxy'leri için supabase-benzeri sorgu API'si.
// Aynı filtre birden fazla kez zincirlenebilir (.eq().eq()), .in/.ilike/.neq/.gt/.lt/.is desteklenir.

type Filter = [string, string]

class Q {
  constructor(
    private ep: string,
    private base: Record<string, string>,
    private filters: Filter[] = [],
  ) {}
  private add(op: string, f: string, v: any) { return new Q(this.ep, this.base, [...this.filters, [op, `${f}:${v}`]]) }
  eq(f: string, v: any)    { return this.add('eq', f, v) }
  neq(f: string, v: any)   { return this.add('neq', f, v) }
  gte(f: string, v: any)   { return this.add('gte', f, v) }
  lte(f: string, v: any)   { return this.add('lte', f, v) }
  gt(f: string, v: any)    { return this.add('gt', f, v) }
  lt(f: string, v: any)    { return this.add('lt', f, v) }
  in(f: string, v: any[])  { return this.add('in', f, v.join('|')) }
  ilike(f: string, v: string) { return this.add('ilike', f, v) }
  search(term: string, fields: string[]) { return new Q(this.ep, this.base, [...this.filters, ['search', term], ['searchIn', fields.join(',')]]) }
  is(f: string, v: null | boolean) { return this.add('is', f, v === null ? 'null' : String(v)) }
  order(f: string, o?: { ascending?: boolean }) { return this.add('ord', f, o?.ascending === true ? 'asc' : 'desc') }
  limit(n: number)         { return new Q(this.ep, { ...this.base, limit: String(n) }, this.filters) }
  range(from: number, to: number) { return new Q(this.ep, { ...this.base, offset: String(from), limit: String(to - from + 1) }, this.filters) }
  exec(): Promise<any> {
    const sp = new URLSearchParams(this.base)
    this.filters.forEach(([k, v]) => sp.append(k, v))
    return fetch(`${this.ep}?${sp}`).then(r => r.json())
  }
}

const METHODS = ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'ilike', 'is', 'order', 'limit', 'range', 'search']
const wrap = (q: Q): any =>
  new Proxy(q, {
    get(t: any, prop: string) {
      if (prop === 'then')  return (fn: any, fe?: any) => t.exec().then(fn, fe)
      if (prop === 'catch') return (fe: any) => t.exec().catch(fe)
      if (METHODS.includes(prop)) return (...a: any[]) => wrap(t[prop](...a))
      return t[prop]?.bind?.(t) ?? t[prop]
    },
  })

export function makeClient(ep: string) {
  const post = (body: object) =>
    fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())

  return {
    from: (table: string) => ({
      select: (select = '*', opts?: any) => wrap(new Q(ep, { table, select, ...(opts?.count ? { count: 'true' } : {}), ...(opts?.total ? { total: opts.total === 'estimated' ? 'estimated' : 'exact' } : {}) })),
      insert: (data: any) => post({ table, op: 'insert', data }),
      update: (data: any) => ({ eq: (_: string, id: any) => post({ table, op: 'update', data, id }) }),
      delete: () => ({ eq: (_: string, id: any) => post({ table, op: 'delete', id }) }),
      upsert: (data: any) => post({ table, op: 'upsert', data }),
    }),
    // Sunucu tarafı rpc_* fonksiyonu (özet/toplam hesapları veritabanında yapılır)
    async rpc(name: string, args: Record<string, any> = {}): Promise<any> {
      const r = await post({ rpc: name, args })
      if (r?.error) throw new Error(r.error)
      return r?.data
    },
    // Sunucu tarafı sayfalama: yalnızca istenen sayfa + toplam satır sayısı gelir
    async page(table: string, select = '*', o: { build?: (q: any) => any; search?: string; searchIn?: string[]; sort?: { key: string; dir: 'asc' | 'desc' } | null; tieBreak?: string; page: number; size: number; total?: 'exact' | 'estimated' }) {
      let q: any = wrap(new Q(ep, { table, select, total: o.total || 'exact' }))
      if (o.build) q = o.build(q)
      if (o.search && o.searchIn?.length) q = q.search(o.search, o.searchIn)
      if (o.sort) q = q.order(o.sort.key, { ascending: o.sort.dir === 'asc' })
      if (o.tieBreak) q = q.order(o.tieBreak, { ascending: false })
      const res = await q.range(o.page * o.size, o.page * o.size + o.size - 1)
      if (res?.error) throw new Error(res.error)
      const rows = res?.data || []
      return { rows, total: typeof res?.count === 'number' ? res.count : rows.length }
    },
    // 1000 satır sınırını aşan tablolar için sayfalayarak hepsini getirir (üst sınır: 20.000 satır; aşılırsa uyarı yayınlanır)
    async all(table: string, select = '*', build?: (q: any) => any): Promise<any[]> {
      const out: any[] = []
      for (let off = 0; off < 20000; off += 1000) {
        let q: any = wrap(new Q(ep, { table, select }))
        if (build) q = build(q)
        const res = await q.range(off, off + 999)
        const rows = res?.data || []
        out.push(...rows)
        if (rows.length < 1000) break
        if (off + 1000 >= 20000 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adm:truncated', { detail: { table } }))
      }
      return out
    },
  }
}
