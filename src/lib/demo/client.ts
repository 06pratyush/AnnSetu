// The part of the supabase-js client AnnSetu uses, answered by the demo database in this browser.
// Every request runs as the signed-in user (see asUser), so the database's own rules decide what
// each person can see and change, exactly as on Supabase.
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Transaction } from "@electric-sql/pglite";
import { asOwner, asUser, flushDemo } from "./db";

type Row = Record<string, unknown>;
type PgError = { message: string; details: string | null; hint: string | null; code: string };
type Result<T> = { data: T; error: PgError | null; count?: number | null; status?: number };

function toError(err: unknown): PgError {
  const e = err as { message?: string; detail?: string; hint?: string; code?: string };
  return { message: e?.message ?? String(err), details: e?.detail ?? null, hint: e?.hint ?? null, code: e?.code ?? "" };
}

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`invalid_identifier ${name}`);
  return name;
}

/** Objects go to jsonb as JSON text; arrays (text[]) and plain values as they are. */
function param(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

// ------------------------------------------------------------------ session

const SESSION_KEY = "annsetu.demo.session";
type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "PASSWORD_RECOVERY" | "TOKEN_REFRESHED";
type AuthListener = (event: AuthEvent, session: Session | null) => void;
const authListeners = new Set<AuthListener>();

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function writeSession(s: Session | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: the session lasts for this page only */
  }
  memorySession = s;
}
let memorySession: Session | null = typeof window === "undefined" ? null : readSession();
const currentUserId = () => memorySession?.user.id ?? null;
const announce = (event: AuthEvent, s: Session | null) => authListeners.forEach((cb) => cb(event, s));

function makeSession(id: string, email: string, meta: Row, createdAt: string): Session {
  const user = {
    id,
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: meta,
    identities: [{ id, identity_id: id, user_id: id, provider: "email", identity_data: { email }, created_at: createdAt, last_sign_in_at: createdAt, updated_at: createdAt }],
    created_at: createdAt,
  } as unknown as User;
  return { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 31_536_000, expires_at: Math.floor(Date.now() / 1000) + 31_536_000, user };
}

async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$100000$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}
async function checkPassword(password: string, stored: string | null): Promise<boolean> {
  const [, , saltHex] = (stored ?? "").split("$");
  if (!saltHex) return false;
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return (await hashPassword(password, salt)) === stored;
}

const authError = (message: string, status = 400) => ({ name: "AuthApiError", message, status, code: undefined });

// ------------------------------------------------------------------ live order updates

type Channel = { cb?: (payload: { eventType: string; new: Row; old: Row }) => void };
const channels = new Set<Channel>();
const ORDER_CHANGES = new Set(["place_order", "update_order_status", "update_batch_status", "release_due_batches"]);
/** Functions that change data; the rest only read. */
const WRITES = new Set([...ORDER_CHANGES, "adjust_stock"]);
/** Orders changed in this tab: pages listening for order changes refetch. */
function ordersChanged() {
  for (const ch of channels) ch.cb?.({ eventType: "UPDATE", new: {}, old: {} });
}

// ------------------------------------------------------------------ query builder

// The embedded selects AnnSetu uses, as PostgREST would answer them.
const EMBEDS: Record<string, Record<string, (alias: string) => string>> = {
  profiles: {
    farmer_details: (a) => `(select to_json(e) from public.farmer_details e where e.user_id = t.id) as ${a}`,
    buyer_details: (a) => `(select to_json(e) from public.buyer_details e where e.user_id = t.id) as ${a}`,
  },
  orders: {
    order_items: (a) => `coalesce((select json_agg(e order by e.id) from public.order_items e where e.order_id = t.id), '[]'::json) as ${a}`,
    reviews: (a) => `(select to_json(e) from public.reviews e where e.order_id = t.id) as ${a}`,
    delivery_batches: (a) => `(select to_json(e) from public.delivery_batches e where e.id = t.batch_id) as ${a}`,
  },
};

function projection(table: string, cols: string): string {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts
    .map((p) => {
      if (p === "*") return "t.*";
      const embed = /^(?:([a-z_]+):)?([a-z_]+)\(\*\)$/.exec(p);
      if (embed) {
        const make = EMBEDS[table]?.[embed[2]];
        if (!make) throw new Error(`demo: no embed ${table}.${embed[2]}`);
        return make(ident(embed[1] ?? embed[2]));
      }
      return `t.${ident(p)}`;
    })
    .join(", ");
}

class Query<T = unknown> implements PromiseLike<Result<T>> {
  private kind: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private cols = "*";
  private count = false;
  private returning = false;
  private values: Row | Row[] | null = null;
  private conflict: string | null = null;
  private where: { sql: string; params: unknown[] }[] = [];
  private orderBy: string[] = [];
  private limitN: number | null = null;
  private offsetN = 0;
  private shape: "many" | "single" | "maybe" = "many";

  constructor(private table: string) {
    ident(table);
  }

  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.kind === "select") this.count = Boolean(opts?.count);
    else this.returning = true;
    this.cols = cols;
    return this;
  }
  insert(values: Row | Row[]) {
    this.kind = "insert";
    this.values = values;
    return this;
  }
  update(values: Row) {
    this.kind = "update";
    this.values = values;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.kind = "upsert";
    this.values = values;
    this.conflict = opts?.onConflict ?? null;
    return this;
  }
  delete() {
    this.kind = "delete";
    return this;
  }
  eq(col: string, value: unknown) {
    this.where.push(value === null ? { sql: `t.${ident(col)} is null`, params: [] } : { sql: `t.${ident(col)} = ?`, params: [param(value)] });
    return this;
  }
  neq(col: string, value: unknown) {
    this.where.push({ sql: `t.${ident(col)} <> ?`, params: [param(value)] });
    return this;
  }
  in(col: string, values: unknown[]) {
    this.where.push({ sql: `t.${ident(col)} = any(?)`, params: [values] });
    return this;
  }
  /** PostgREST "or" filters of the form `col.ilike.pattern,col.eq.value`. */
  or(expr: string) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const part of expr.split(",")) {
      const m = /^([a-z_]+)\.(eq|ilike|like)\.(.*)$/.exec(part.trim());
      if (!m) throw new Error(`demo: unsupported filter ${part}`);
      clauses.push(`t.${ident(m[1])} ${m[2] === "eq" ? "=" : m[2]} ?`);
      params.push(m[3].replace(/\*/g, "%"));
    }
    this.where.push({ sql: `(${clauses.join(" or ")})`, params });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? "desc" : "asc";
    const nulls = opts?.nullsFirst === undefined ? "" : opts.nullsFirst ? " nulls first" : " nulls last";
    this.orderBy.push(`t.${ident(col)} ${dir}${nulls}`);
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  single() {
    this.shape = "single";
    return this as unknown as Query<T>;
  }
  maybeSingle() {
    this.shape = "maybe";
    return this as unknown as Query<T>;
  }

  then<A = Result<T>, B = never>(onOk?: ((v: Result<T>) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(onOk, onErr);
  }

  /** Numbers each ? as $1, $2, … in order. */
  private sqlWith(base: string, params: unknown[]) {
    const all = [...params];
    let where = "";
    for (const w of this.where) all.push(...w.params);
    if (this.where.length) where = ` where ${this.where.map((w) => w.sql).join(" and ")}`;
    let n = 0;
    const sql = (base + where).replace(/\?/g, () => `$${++n}`);
    return { sql, params: all };
  }

  private async run(): Promise<Result<T>> {
    try {
      const result = await asUser(currentUserId(), (tx) => this.exec(tx));
      if (this.kind !== "select") await flushDemo();
      return result;
    } catch (err) {
      return { data: null as T, error: toError(err), count: null };
    }
  }

  private async exec(tx: Transaction): Promise<Result<T>> {
    const table = `public.${this.table}`;
    let rows: Row[] = [];
    let count: number | null = null;
    if (this.kind === "select") {
      const order = this.orderBy.length ? ` order by ${this.orderBy.join(", ")}` : "";
      const page = `${this.limitN !== null ? ` limit ${Math.max(0, Math.floor(this.limitN))}` : ""}${this.offsetN ? ` offset ${Math.floor(this.offsetN)}` : ""}`;
      const q = this.sqlWith(`select ${projection(this.table, this.cols)} from ${table} t`, []);
      rows = (await tx.query<Row>(q.sql + order + page, q.params)).rows;
      if (this.count) {
        const c = this.sqlWith(`select count(*) as n from ${table} t`, []);
        count = Number((await tx.query<{ n: number }>(c.sql, c.params)).rows[0].n);
      }
    } else if (this.kind === "delete") {
      const q = this.sqlWith(`delete from ${table} t`, []);
      rows = (await tx.query<Row>(q.sql + (this.returning ? " returning t.*" : ""), q.params)).rows;
    } else if (this.kind === "update") {
      const entries = Object.entries(this.values as Row);
      const set = entries.map(([k]) => `${ident(k)} = ?`).join(", ");
      const q = this.sqlWith(`update ${table} t set ${set}`, entries.map(([, v]) => param(v)));
      rows = (await tx.query<Row>(q.sql + (this.returning ? " returning t.*" : ""), q.params)).rows;
    } else {
      const list = Array.isArray(this.values) ? this.values : [this.values as Row];
      const cols = [...new Set(list.flatMap((r) => Object.keys(r)))].map(ident);
      const params: unknown[] = [];
      const tuples = list.map((r) => `(${cols.map((c) => (c in r ? (params.push(param(r[c])), "?") : "default")).join(", ")})`);
      let sql = `insert into ${table} as t (${cols.join(", ")}) values ${tuples.join(", ")}`;
      if (this.kind === "upsert") {
        const keys = (this.conflict ?? "id").split(",").map((c) => ident(c.trim()));
        const updates = cols.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`);
        sql += ` on conflict (${keys.join(", ")}) ${updates.length ? `do update set ${updates.join(", ")}` : "do nothing"}`;
      }
      let n = 0;
      rows = (await tx.query<Row>(sql.replace(/\?/g, () => `$${++n}`) + (this.returning ? " returning t.*" : ""), params)).rows;
    }

    if (this.kind !== "select" && !this.returning) return { data: null as T, error: null, count };
    if (this.shape === "single") {
      if (rows.length !== 1) return { data: null as T, error: { message: "JSON object requested, multiple (or no) rows returned", details: null, hint: null, code: "PGRST116" } };
      return { data: rows[0] as T, error: null, count };
    }
    if (this.shape === "maybe") return { data: (rows[0] ?? null) as T, error: null, count };
    return { data: rows as T, error: null, count };
  }
}

// ------------------------------------------------------------------ the client

const setReturning = new Map<string, boolean>();
async function returnsSet(tx: Transaction, fn: string) {
  if (!setReturning.has(fn)) {
    const r = await tx.query<{ s: boolean }>(
      `select p.proretset as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`,
      [fn],
    );
    setReturning.set(fn, Boolean(r.rows[0]?.s));
  }
  return setReturning.get(fn)!;
}

const photoUrls = new Map<string, string>();
const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export function createDemoClient(): SupabaseClient {
  const client = {
    from: (table: string) => new Query(table),

    async rpc(fn: string, args: Row = {}) {
      try {
        const names = Object.keys(args).map(ident);
        const call = `public.${ident(fn)}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
        const data = await asUser(currentUserId(), async (tx) => {
          const many = await returnsSet(tx, fn);
          const r = await tx.query<Row>(many ? `select * from ${call}` : `select ${call} as result`, names.map((n) => param(args[n])));
          return many ? r.rows : (r.rows[0]?.result ?? null);
        });
        // Like Supabase realtime, only for real changes: release_due_batches runs on every order
        // list fetch and usually releases nothing (announcing that would refetch in a loop).
        const changed = WRITES.has(fn) && !(fn === "release_due_batches" && !data);
        if (changed) await flushDemo();
        if (changed && ORDER_CHANGES.has(fn)) ordersChanged();
        return { data, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    auth: {
      async getSession() {
        return { data: { session: memorySession }, error: null };
      },
      async getUser() {
        return { data: { user: memorySession?.user ?? null }, error: null };
      },
      onAuthStateChange(cb: AuthListener) {
        authListeners.add(cb);
        queueMicrotask(() => cb("INITIAL_SESSION", memorySession));
        // A session left from a demo database that no longer exists (a new version, cleared data) ends here.
        const id = currentUserId();
        if (id) {
          void asOwner((tx) => tx.query(`select 1 from auth.users where id = $1`, [id]))
            .then((r) => {
              if (!r.rows.length && currentUserId() === id) {
                writeSession(null);
                announce("SIGNED_OUT", null);
              }
            })
            .catch(() => {});
        }
        return { data: { subscription: { id: "demo", callback: cb, unsubscribe: () => authListeners.delete(cb) } } };
      },
      async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
        const address = email.trim().toLowerCase();
        try {
          const id = crypto.randomUUID();
          const hash = await hashPassword(password);
          const meta = options?.data ?? {};
          const created = await asOwner(async (tx) => {
            const taken = await tx.query(`select 1 from auth.users where lower(email) = $1`, [address]);
            if (taken.rows.length) return null;
            const r = await tx.query<{ created_at: string }>(
              `insert into auth.users (id, email, raw_user_meta_data, password_hash) values ($1, $2, $3, $4) returning created_at`,
              [id, address, JSON.stringify(meta), hash],
            );
            return r.rows[0].created_at;
          });
          if (!created) return { data: { user: null, session: null }, error: authError("User already registered", 422) };
          await flushDemo();
          const session = makeSession(id, address, meta, created);
          writeSession(session);
          announce("SIGNED_IN", session);
          return { data: { user: session.user, session }, error: null };
        } catch (err) {
          return { data: { user: null, session: null }, error: authError(toError(err).message, 500) };
        }
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const address = email.trim().toLowerCase();
        try {
          const user = await asOwner(
            async (tx) =>
              (await tx.query<{ id: string; email: string; raw_user_meta_data: Row; password_hash: string | null; created_at: string }>(
                `select id, email, raw_user_meta_data, password_hash, created_at from auth.users where lower(email) = $1`,
                [address],
              )).rows[0],
          );
          if (!user || !(await checkPassword(password, user.password_hash))) {
            return { data: { user: null, session: null }, error: authError("Invalid login credentials") };
          }
          const session = makeSession(user.id, user.email, user.raw_user_meta_data, user.created_at);
          writeSession(session);
          announce("SIGNED_IN", session);
          return { data: { user: session.user, session }, error: null };
        } catch (err) {
          return { data: { user: null, session: null }, error: authError(toError(err).message, 500) };
        }
      },
      async signOut() {
        writeSession(null);
        announce("SIGNED_OUT", null);
        return { error: null };
      },
      async updateUser(attrs: { password?: string; data?: Row }) {
        const id = currentUserId();
        if (!id || !memorySession) return { data: { user: null }, error: authError("Auth session missing!", 401) };
        if (attrs.password) {
          const hash = await hashPassword(attrs.password);
          await asOwner((tx) => tx.query(`update auth.users set password_hash = $2 where id = $1`, [id, hash]));
          await flushDemo();
        }
        announce("USER_UPDATED", memorySession);
        return { data: { user: memorySession.user }, error: null };
      },
      async resetPasswordForEmail() {
        return { data: null, error: authError("Password reset by email isn't available in demo mode.") };
      },
    },

    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: Blob) {
            try {
              const url = await readAsDataUrl(file);
              await asUser(currentUserId(), (tx) => tx.query(`insert into storage.objects (bucket_id, name, data) values ($1, $2, $3)`, [bucket, path, url]));
              photoUrls.set(`${bucket}/${path}`, url);
              await flushDemo();
              return { data: { id: path, path, fullPath: `${bucket}/${path}` }, error: null };
            } catch (err) {
              return { data: null, error: { name: "StorageError", message: toError(err).message } };
            }
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: photoUrls.get(`${bucket}/${path}`) ?? "" } };
          },
          async remove(paths: string[]) {
            try {
              await asUser(currentUserId(), (tx) => tx.query(`delete from storage.objects where bucket_id = $1 and name = any($2)`, [bucket, paths]));
              await flushDemo();
              return { data: [], error: null };
            } catch (err) {
              return { data: null, error: { name: "StorageError", message: toError(err).message } };
            }
          },
        };
      },
    },

    channel() {
      const ch: Channel & { on: (...a: unknown[]) => typeof ch; subscribe: () => typeof ch } = {
        on(_type: unknown, _filter: unknown, cb?: unknown) {
          ch.cb = cb as Channel["cb"];
          return ch;
        },
        subscribe() {
          channels.add(ch);
          return ch;
        },
      };
      return ch;
    },
    async removeChannel(ch: Channel) {
      channels.delete(ch);
      return "ok";
    },
  };
  return client as unknown as SupabaseClient;
}

/** The signed-in demo user, for the demo-only helpers. */
export const demoUserId = currentUserId;
