import React, { useState } from "react";
import { Address, saveAddress } from "../lib/store.js";
import { Spinner } from "./bits.js";
import { useT } from "../lib/i18n.js";
import { Field } from "./bits.js";

const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

export function AddressForm({ initial, onSaved, onCancel, defaultName = "", defaultPhone = "" }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void; defaultName?: string; defaultPhone?: string }) {
  const t = useT();
  const [f, setF] = useState({ label: initial?.label || "Home", name: initial?.name || defaultName, phone: initial?.phone || defaultPhone, line1: initial?.line1 || "", line2: initial?.line2 || "", city: initial?.city || "", state: initial?.state || "", pincode: initial?.pincode || "", isDefault: initial?.isDefault || false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const u = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { onSaved(await saveAddress({ ...f, id: initial?.id })); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" noValidate>
      <Field label={t("addr_name")}><input className="input" value={f.name} onChange={u("name")} autoComplete="name" /></Field>
      <Field label={t("addr_phone")}><input className="input" type="tel" inputMode="numeric" value={f.phone} onChange={u("phone")} autoComplete="tel" /></Field>
      <div className="sm:col-span-2"><Field label={t("addr_line1")}><input className="input" value={f.line1} onChange={u("line1")} autoComplete="address-line1" /></Field></div>
      <div className="sm:col-span-2"><Field label={t("addr_line2")}><input className="input" value={f.line2} onChange={u("line2")} autoComplete="address-line2" /></Field></div>
      <Field label={t("addr_city")}><input className="input" value={f.city} onChange={u("city")} autoComplete="address-level2" /></Field>
      <Field label={t("addr_state")}>
        <select className="input" value={f.state} onChange={u("state")} autoComplete="address-level1">
          <option value="">—</option>{STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label={t("addr_pin")}><input className="input" inputMode="numeric" maxLength={6} value={f.pincode} onChange={u("pincode")} autoComplete="postal-code" /></Field>
      <Field label={t("addr_label")}>
        <select className="input" value={f.label} onChange={u("label")}>{["Home", "Work", "Other"].map((l) => <option key={l}>{l}</option>)}</select>
      </Field>
      {err && <p role="alert" className="sm:col-span-2 text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err}</p>}
      <div className="sm:col-span-2 flex flex-wrap gap-3">
        <button className="btn-primary h-12 px-6" disabled={busy}>{busy && <Spinner />}{t("addr_save")}</button>
        {onCancel && <button type="button" className="btn-ghost h-12" onClick={onCancel}>{t("cancel")}</button>}
      </div>
    </form>
  );
}
