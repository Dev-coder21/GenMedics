import React, { useEffect, useSyncExternalStore } from "react";

function current() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", qs };
}

let snap = current();
let key = location.hash;
function subscribe(cb: () => void) {
  const h = () => cb();
  window.addEventListener("hashchange", h);
  return () => window.removeEventListener("hashchange", h);
}
function getSnap() {
  if (location.hash !== key) { key = location.hash; snap = current(); }
  return snap;
}

export function useRoute() {
  const r = useSyncExternalStore(subscribe, getSnap);
  const parts = r.path.split("/").filter(Boolean);
  return { path: r.path, parts, query: new URLSearchParams(r.qs) };
}

export function href(to: string) { return "#" + (to.startsWith("/") ? to : "/" + to); }
export function navigate(to: string, replace = false) {
  const h = href(to);
  if (replace) history.replaceState(null, "", h), window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = h;
}

export function useScrollTop(path: string) {
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path]);
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };
export function Link({ to, ...rest }: LinkProps) {
  return React.createElement("a", { href: href(to), ...rest });
}
