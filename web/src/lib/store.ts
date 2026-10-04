// GenMedics demo-mode data layer.
// Everything the FastAPI backend used to persist (users, carts, addresses, orders, prescriptions,
// inventory edits, settings) lives in the browser's localStorage, so the whole platform runs on
// GitHub Pages with no server. Shape mirrors the backend models so a real API can be swapped in.
import { useSyncExternalStore } from "react";

export type Brand = { name: string; maker?: string; mrp?: number; count?: number; unit?: number };
export type Category = "pain" | "bp" | "diab" | "acid" | "allergy" | "abx" | "chol" | "vit" | "skin" | "other";
export type Med = {
  id: number; name: string; full: string; salt: string; pack: string; count: number; price: number; unit: number;
  use: string; cat: Category; rx: boolean; form: string; brands: Brand[]; save: number; stock: number; custom?: boolean;
};
export type User = { id: string; name: string; email: string; phone?: string; pass: string; admin?: boolean; createdAt: string };
export type Address = { id: string; userId: string; label: string; name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string; isDefault?: boolean };
export type CartItem = { id: number; qty: number };
export type OrderItem = { id: number; name: string; price: number; qty: number; rx: boolean; pack: string };
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type Order = {
  id: number; userId: string; items: OrderItem[]; subtotal: number; delivery: number; total: number; brandTotal: number;
  address: Address; payment: "cod" | "upi"; rxId?: string; status: OrderStatus;
  history: { status: OrderStatus; at: string; note?: string }[]; tracking?: string; createdAt: string;
};
export type RxStatus = "pending" | "approved" | "rejected";
export type RxMatch = { medId: number; name: string; line: string; score: number; brand?: string };
export type Prescription = {
  id: string; userId: string; image?: string; text: string; matches: RxMatch[]; confidence: number;
  status: RxStatus; note?: string; createdAt: string; reviewedAt?: string;
};
export type Settings = { freeAbove: number; fee: number; portalTitle: string; rxCheck: boolean; cod: boolean; upi: boolean };
export type InvPatch = Partial<Pick<Med, "price" | "stock" | "rx" | "name" | "pack" | "use" | "cat">> & { deleted?: boolean };

export type DB = {
  v: 2; seeded: boolean; users: User[]; session: string | null; cart: CartItem[]; wishlist: Record<string, number[]>;
  addresses: Address[]; orders: Order[]; prescriptions: Prescription[]; inv: Record<number, InvPatch>; custom: Med[];
  settings: Settings; lang: "en" | "hi"; nextOrder: number;
};

const KEY = "genmedics:v2";
export const DEFAULT_SETTINGS: Settings = { freeAbove: 299, fee: 40, portalTitle: "GenMedics Admin", rxCheck: true, cod: true, upi: true };

// sha256("genmedics:" + password) of the two demo accounts — see README.
const ADMIN_HASH = "ec774be8edbfe68f221f6687306d132972a05a6cec79d320596ccb47479ab956";
const DEMO_HASH = "f67b2be1e8c08fe4ffa30e2dc8dff67d2a0d2f7c70d03166cad50989869d45ff";
export const DEMO_ACCOUNTS = { admin: { email: "admin@genmedics.in", password: "Admin@123" }, customer: { email: "demo@genmedics.in", password: "Demo@123" } };

function fresh(): DB {
  const now = new Date().toISOString();
  return {
    v: 2, seeded: false, session: null, cart: [], wishlist: {}, addresses: [], orders: [], prescriptions: [], inv: {}, custom: [],
    settings: { ...DEFAULT_SETTINGS }, lang: "en", nextOrder: 1001,
    users: [
      { id: "u_admin", name: "Pharmacist on duty", email: DEMO_ACCOUNTS.admin.email, pass: ADMIN_HASH, admin: true, createdAt: now },
      { id: "u_demo", name: "Demo Customer", email: DEMO_ACCOUNTS.customer.email, phone: "9800000000", pass: DEMO_HASH, createdAt: now },
    ],
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 2) return { ...fresh(), ...d, settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) } };
    }
  } catch {}
  return fresh();
}

let db: DB = load();
const subs = new Set<() => void>();

function persist() {
  for (let attempt = 0; attempt < 6; attempt++) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return; }
    catch {
      // Storage full: drop stored prescription images, oldest first, then retry.
      const withImg = db.prescriptions.filter((p) => p.image);
      if (!withImg.length) return;
      const oldest = withImg[withImg.length - 1].id;
      db = { ...db, prescriptions: db.prescriptions.map((p) => (p.id === oldest ? { ...p, image: undefined } : p)) };
    }
  }
}

function set(next: Partial<DB> | ((d: DB) => Partial<DB>)) {
  const patch = typeof next === "function" ? next(db) : next;
  db = { ...db, ...patch };
  persist();
  subs.forEach((f) => f());
}

// Keep tabs in sync (e.g. admin console in one tab, store in another).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { db = load(); subs.forEach((f) => f()); }
  });
}

export function useDB(): DB {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => db);
}
export const getDB = () => db;

const uid = (p: string) => p + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export async function hashPass(p: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("genmedics:" + p));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- session / users ----------
export const currentUser = (d: DB = db) => d.users.find((u) => u.id === d.session) || null;

export async function login(email: string, password: string, needAdmin = false) {
  const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || u.pass !== (await hashPass(password))) throw new Error("Incorrect email or password");
  if (needAdmin && !u.admin) throw new Error("This account doesn't have admin access");
  set({ session: u.id });
  return u;
}

export async function register(data: { name: string; email: string; phone?: string; password: string }) {
  const email = data.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address");
  if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!data.name.trim()) throw new Error("Enter your name");
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new Error("Email already registered");
  const u: User = { id: uid("u"), name: data.name.trim(), email, phone: data.phone?.trim(), pass: await hashPass(data.password), createdAt: new Date().toISOString() };
  set((d) => ({ users: [...d.users, u], session: u.id }));
  return u;
}

export const logout = () => set({ session: null });

export function updateProfile(p: { name: string; phone?: string }) {
  const me = currentUser(); if (!me) return;
  set((d) => ({ users: d.users.map((u) => (u.id === me.id ? { ...u, name: p.name.trim() || u.name, phone: p.phone?.trim() } : u)) }));
}

export async function changePassword(oldP: string, newP: string) {
  const me = currentUser(); if (!me) throw new Error("Not signed in");
  if (me.pass !== (await hashPass(oldP))) throw new Error("Current password is incorrect");
  if (newP.length < 6) throw new Error("New password must be at least 6 characters");
  const h = await hashPass(newP);
  set((d) => ({ users: d.users.map((u) => (u.id === me.id ? { ...u, pass: h } : u)) }));
}

// ---------- language ----------
export const setLang = (lang: "en" | "hi") => { set({ lang }); document.documentElement.lang = lang; };

// ---------- cart ----------
export function addToCart(id: number, qty = 1) {
  set((d) => {
    const ex = d.cart.find((c) => c.id === id);
    return { cart: ex ? d.cart.map((c) => (c.id === id ? { ...c, qty: Math.min(99, c.qty + qty) } : c)) : [...d.cart, { id, qty }] };
  });
}
export const setQty = (id: number, qty: number) => set((d) => ({ cart: d.cart.map((c) => (c.id === id ? { ...c, qty: Math.max(1, Math.min(99, qty)) } : c)) }));
export const removeFromCart = (id: number) => set((d) => ({ cart: d.cart.filter((c) => c.id !== id) }));
export const clearCart = () => set({ cart: [] });

// ---------- wishlist ----------
export function toggleWish(id: number) {
  const k = db.session || "guest";
  set((d) => {
    const cur = d.wishlist[k] || [];
    return { wishlist: { ...d.wishlist, [k]: cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur] } };
  });
}
export const wishOf = (d: DB) => d.wishlist[d.session || "guest"] || [];

// ---------- addresses ----------
export function saveAddress(a: Omit<Address, "id" | "userId"> & { id?: string }) {
  const me = currentUser(); if (!me) throw new Error("Sign in to save an address");
  for (const k of ["name", "phone", "line1", "city", "state", "pincode"] as const) if (!String(a[k] || "").trim()) throw new Error("Please fill in all required address fields");
  if (!/^\d{6}$/.test(a.pincode.trim())) throw new Error("PIN code must be 6 digits");
  if (!/^[6-9]\d{9}$/.test(a.phone.replace(/\D/g, "").slice(-10))) throw new Error("Enter a valid 10-digit mobile number");
  const mine = db.addresses.filter((x) => x.userId === me.id);
  const id = a.id || uid("a");
  const isDefault = a.isDefault || mine.length === 0 || (a.id ? mine.find((x) => x.id === a.id)?.isDefault : false);
  const rec: Address = { ...a, id, userId: me.id, isDefault: !!isDefault } as Address;
  set((d) => {
    let list = d.addresses.filter((x) => x.id !== id);
    if (rec.isDefault) list = list.map((x) => (x.userId === me.id ? { ...x, isDefault: false } : x));
    return { addresses: [...list, rec] };
  });
  return rec;
}
export function deleteAddress(id: string) {
  set((d) => {
    const gone = d.addresses.find((a) => a.id === id);
    let list = d.addresses.filter((a) => a.id !== id);
    if (gone?.isDefault) { const first = list.find((a) => a.userId === gone.userId); if (first) list = list.map((a) => (a.id === first.id ? { ...a, isDefault: true } : a)); }
    return { addresses: list };
  });
}
export const setDefaultAddress = (id: string) => set((d) => {
  const t = d.addresses.find((a) => a.id === id); if (!t) return {};
  return { addresses: d.addresses.map((a) => (a.userId === t.userId ? { ...a, isDefault: a.id === id } : a)) };
});

// ---------- prescriptions ----------
export function savePrescription(p: Omit<Prescription, "id" | "userId" | "status" | "createdAt">) {
  const me = currentUser(); if (!me) throw new Error("Sign in to save a prescription");
  const rec: Prescription = { ...p, id: "RX-" + Date.now().toString(36).toUpperCase(), userId: me.id, status: "pending", createdAt: new Date().toISOString() };
  set((d) => ({ prescriptions: [rec, ...d.prescriptions] }));
  return rec;
}
export function reviewPrescription(id: string, status: RxStatus, note?: string) {
  set((d) => ({ prescriptions: d.prescriptions.map((p) => (p.id === id ? { ...p, status, note: note?.trim() || p.note, reviewedAt: new Date().toISOString() } : p)) }));
}
export const deletePrescription = (id: string) => set((d) => ({ prescriptions: d.prescriptions.filter((p) => p.id !== id) }));

// ---------- orders ----------
export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export function quote(lines: { med: Med; qty: number }[], s: Settings = db.settings) {
  const subtotal = round(lines.reduce((t, l) => t + l.med.price * l.qty, 0));
  const brandTotal = round(lines.reduce((t, l) => {
    const priced = l.med.brands.filter((b) => b.unit);
    const bu = priced.length ? Math.min(...priced.map((b) => b.unit!)) : l.med.unit;
    return t + Math.max(bu, l.med.unit) * l.med.count * l.qty;
  }, 0));
  const delivery = subtotal === 0 || subtotal >= s.freeAbove ? 0 : s.fee;
  return { subtotal, delivery, total: round(subtotal + delivery), brandTotal, savings: round(Math.max(0, brandTotal - subtotal)) };
}
const round = (n: number) => Math.round(n * 100) / 100;

export function placeOrder(opts: { lines: { med: Med; qty: number }[]; addressId: string; payment: "cod" | "upi"; rxId?: string }) {
  const me = currentUser(); if (!me) throw new Error("Please sign in to place an order");
  if (!opts.lines.length) throw new Error("Your cart is empty");
  const address = db.addresses.find((a) => a.id === opts.addressId && a.userId === me.id);
  if (!address) throw new Error("Choose a delivery address");
  for (const l of opts.lines) if (l.qty > l.med.stock) throw new Error(`Only ${l.med.stock} left of ${l.med.name}`);
  const needsRx = opts.lines.some((l) => l.med.rx);
  if (needsRx && db.settings.rxCheck) {
    const rx = db.prescriptions.find((p) => p.id === opts.rxId && p.userId === me.id);
    if (!rx || rx.status === "rejected") throw new Error("Attach a valid prescription for the Rx medicines in your cart");
  }
  const q = quote(opts.lines);
  const now = new Date().toISOString();
  const order: Order = {
    id: db.nextOrder, userId: me.id, payment: opts.payment, rxId: needsRx ? opts.rxId : undefined, address: { ...address },
    items: opts.lines.map((l) => ({ id: l.med.id, name: l.med.name, price: l.med.price, qty: l.qty, rx: l.med.rx, pack: l.med.pack })),
    subtotal: q.subtotal, delivery: q.delivery, total: q.total, brandTotal: q.brandTotal, status: "pending",
    history: [{ status: "pending", at: now }], createdAt: now,
  };
  set((d) => {
    const inv = { ...d.inv };
    for (const l of opts.lines) inv[l.med.id] = { ...(inv[l.med.id] || {}), stock: l.med.stock - l.qty };
    return { orders: [order, ...d.orders], nextOrder: d.nextOrder + 1, cart: [], inv };
  });
  return order;
}

export function setOrderStatus(id: number, status: OrderStatus, note?: string) {
  set((d) => ({
    orders: d.orders.map((o) => {
      if (o.id !== id || o.status === status) return o;
      const tracking = status === "shipped" && !o.tracking ? "GM" + String(id).padStart(6, "0") + "IN" : o.tracking;
      return { ...o, status, tracking, history: [...o.history, { status, at: new Date().toISOString(), note: note?.trim() || undefined }] };
    }),
  }));
  // Cancelling returns stock to inventory.
  if (status === "cancelled") {
    const o = db.orders.find((x) => x.id === id);
    if (o) set((d) => { const inv = { ...d.inv }; for (const it of o.items) { const cur = inv[it.id]?.stock; if (cur != null) inv[it.id] = { ...inv[it.id], stock: cur + it.qty }; } return { inv }; });
  }
}
export const cancelOrder = (id: number) => setOrderStatus(id, "cancelled", "Cancelled by customer");

// ---------- inventory (admin) ----------
export function patchMed(id: number, patch: InvPatch) {
  set((d) => (d.custom.some((m) => m.id === id)
    ? { custom: d.custom.map((m) => (m.id === id ? { ...m, ...patch } as Med : m)) }
    : { inv: { ...d.inv, [id]: { ...(d.inv[id] || {}), ...patch } } }));
}
export function addMed(m: Omit<Med, "id" | "custom" | "brands" | "save" | "unit" | "full" | "salt"> & { salt?: string }) {
  const id = 900000 + db.custom.length + 1 + Math.floor(Math.random() * 1000);
  const rec: Med = { ...m, id, full: m.name, salt: m.salt || m.name, brands: [], save: 0, unit: round(m.price / Math.max(1, m.count)), custom: true };
  set((d) => ({ custom: [rec, ...d.custom] }));
  return rec;
}
export function deleteMed(id: number) {
  set((d) => (d.custom.some((m) => m.id === id) ? { custom: d.custom.filter((m) => m.id !== id) } : { inv: { ...d.inv, [id]: { ...(d.inv[id] || {}), deleted: true } } }));
  removeFromCart(id);
}
export const updateSettings = (s: Partial<Settings>) => set((d) => ({ settings: { ...d.settings, ...s } }));

export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch {}
  db = fresh();
  persist();
  subs.forEach((f) => f());
}

// ---------- first-run demo data (needs the catalogue to price items) ----------
export function seedDemo(meds: Med[]) {
  if (db.seeded) return;
  const byFull = (f: string) => meds.find((m) => m.full === f);
  const pick = (f: string, qty: number) => { const m = byFull(f); return m ? { med: m, qty } : null; };
  const addr: Address = { id: "a_demo", userId: "u_demo", label: "Home", name: "Demo Customer", phone: "9800000000", line1: "12, Demo Residency, MG Road", city: "Ahmedabad", state: "Gujarat", pincode: "380009", isDefault: true };
  const day = 86400000;
  const mk = (id: number, ls: ({ med: Med; qty: number } | null)[], status: OrderStatus, daysAgo: number, payment: "cod" | "upi"): Order | null => {
    const lines = ls.filter(Boolean) as { med: Med; qty: number }[];
    if (!lines.length) return null;
    const q = quote(lines, DEFAULT_SETTINGS);
    const t0 = Date.now() - daysAgo * day;
    const flow = ORDER_FLOW.slice(0, ORDER_FLOW.indexOf(status) + 1);
    return {
      id, userId: "u_demo", payment, address: addr, status, subtotal: q.subtotal, delivery: q.delivery, total: q.total, brandTotal: q.brandTotal,
      items: lines.map((l) => ({ id: l.med.id, name: l.med.name, price: l.med.price, qty: l.qty, rx: l.med.rx, pack: l.med.pack })),
      history: flow.map((s, i) => ({ status: s, at: new Date(t0 + i * 0.35 * day).toISOString() })),
      tracking: ORDER_FLOW.indexOf(status) >= 3 ? "GM" + String(id).padStart(6, "0") + "IN" : undefined,
      createdAt: new Date(t0).toISOString(),
    };
  };
  const orders = [
    mk(1003, [pick("Paracetamol Tablets IP 500 mg", 2), pick("Omeprazole Gastro-Resistant Capsules IP 20 mg", 1)], "confirmed", 0.2, "upi"),
    mk(1002, [pick("Atorvastatin Tablets IP 10 mg", 3), pick("Pantoprazole Gastro Resistant Tablets IP 40 mg", 3)], "shipped", 2, "cod"),
    mk(1001, [pick("Telmisartan Tablets IP 40 mg", 3), pick("Metformin Hydrochloride Tablets IP 500 mg", 6)], "delivered", 9, "upi"),
  ].filter(Boolean) as Order[];
  const rxPending: Prescription[] = [
    { id: "RX-DEMO2", userId: "u_demo", text: "Tab Pantocid 40  1-0-0 x 30d\nTab Storvas 10  0-0-1 x 30d\nTab Losar 50  1-0-0 x 30d", confidence: 0.89, status: "pending", createdAt: new Date(Date.now() - 3600_000).toISOString(),
      matches: ["Pantoprazole Gastro Resistant Tablets IP 40 mg", "Atorvastatin Tablets IP 10 mg", "Losartan Tablets IP 50 mg"].map((f, i) => { const m = byFull(f); return m ? { medId: m.id, name: m.name, line: ["Tab Pantocid 40", "Tab Storvas 10", "Tab Losar 50"][i], score: [0.94, 0.92, 0.81][i], brand: ["Pantocid", "Storvas", "Losar"][i] } : null; }).filter(Boolean) as RxMatch[] },
    { id: "RX-DEMO1", userId: "u_demo", text: "Tab Telma 40  1-0-0\nTab Glycomet 500  1-0-1", confidence: 0.86, status: "approved", createdAt: new Date(Date.now() - 10 * day).toISOString(), reviewedAt: new Date(Date.now() - 9.8 * day).toISOString(),
      matches: ["Telmisartan Tablets IP 40 mg", "Metformin Hydrochloride Tablets IP 500 mg"].map((f, i) => { const m = byFull(f); return m ? { medId: m.id, name: m.name, line: ["Tab Telma 40", "Tab Glycomet 500"][i], score: [0.9, 0.84][i], brand: ["Telma", "Glycomet"][i] } : null; }).filter(Boolean) as RxMatch[] },
  ];
  orders.find((o) => o.id === 1002) && (orders.find((o) => o.id === 1002)!.rxId = "RX-DEMO1");
  orders.find((o) => o.id === 1001) && (orders.find((o) => o.id === 1001)!.rxId = "RX-DEMO1");
  // a few SKUs below threshold so the admin "running low" panel has something real to show
  const low: Record<number, InvPatch> = {};
  ["Atorvastatin Tablets IP 10 mg", "Azithromycin Tablets IP 500 mg", "Pantoprazole Gastro Resistant Tablets IP 40 mg", "Amlodipine Tablets IP 5 mg"].forEach((f, i) => { const m = byFull(f); if (m) low[m.id] = { stock: [18, 9, 26, 12][i] }; });
  set((d) => ({ seeded: true, addresses: d.addresses.some((a) => a.id === addr.id) ? d.addresses : [...d.addresses, addr], orders: [...d.orders, ...orders], prescriptions: [...d.prescriptions, ...rxPending], inv: { ...low, ...d.inv }, nextOrder: Math.max(d.nextOrder, 1004) }));
}

export const LOW_STOCK = 30;
