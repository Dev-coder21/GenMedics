import { useSyncExternalStore } from "react";

type Toast = { id: number; text: string; tone?: "ok" | "err"; action?: { label: string; to: string } };
type UI = { toasts: Toast[]; auth: null | "signin" | "register"; authNext?: () => void; chat: boolean; chatSeed?: string };
let ui: UI = { toasts: [], auth: null, chat: false };
const subs = new Set<() => void>();
const set = (p: Partial<UI>) => { ui = { ...ui, ...p }; subs.forEach((f) => f()); };
export const useUI = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => ui);

let n = 0;
export function toast(text: string, opts: { tone?: "ok" | "err"; action?: { label: string; to: string } } = {}) {
  const t = { id: ++n, text, ...opts };
  set({ toasts: [...ui.toasts.slice(-2), t] });
  setTimeout(() => set({ toasts: ui.toasts.filter((x) => x.id !== t.id) }), 3800);
}
export const dismissToast = (id: number) => set({ toasts: ui.toasts.filter((x) => x.id !== id) });
export const openAuth = (mode: "signin" | "register" = "signin", next?: () => void) => set({ auth: mode, authNext: next });
export const closeAuth = () => set({ auth: null, authNext: undefined });
export const openChat = (seed?: string) => set({ chat: true, chatSeed: seed });
export const closeChat = () => set({ chat: false, chatSeed: undefined });
