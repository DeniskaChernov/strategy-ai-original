import React, { useState } from "react";
import { resetPassword } from "../api";
import { useLang } from "../lang-context";

export function ResetPasswordModal({ token, theme, onClose }: { token: string; theme: string; onClose: () => void }) {
  const { t } = useLang();
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = (() => {
    const v = pw || "";
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  })();
  const strColor = ["#f04458", "#f04458", "#f59e0b", "#3b82f6", "#12c482"][strength];

  async function submit() {
    if (pw.length < 6) { setErr(t("pw_too_short", "Пароль не короче 6 символов")); return; }
    if (pw !== cf) { setErr(t("pw_mismatch", "Пароли не совпадают")); return; }
    setLoading(true); setErr("");
    const res = await resetPassword(token, pw);
    setLoading(false);
    if (res.error) setErr(res.error);
    else setDone(true);
  }

  const inp: React.CSSProperties = { width: "100%", padding: "11px 44px 11px 14px", fontSize: 14, background: "var(--input-bg,var(--inp))", border: "1px solid var(--input-border,var(--b1))", borderRadius: 10, color: "var(--text,var(--t1))", outline: "none", fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" };

  return (
    <div className="modal-backdrop" data-theme={theme} style={{ position: "fixed", inset: 0, background: "var(--modal-overlay-bg,rgba(0,0,0,.75))", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(14px)", padding: 16 }}>
      <div className="glass-panel" role="dialog" aria-modal="true" aria-label={t("reset_pw_title", "Новый пароль")} data-theme={theme} style={{ width: "min(96vw,420px)", borderRadius: 18, padding: 26 }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 38, marginBottom: 8 }} aria-hidden>✅</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text,var(--t1))", marginBottom: 6 }}>{t("reset_pw_done", "Пароль обновлён")}</div>
            <div style={{ fontSize: 13.5, color: "var(--text3,var(--t3))", marginBottom: 20 }}>{t("reset_pw_done_desc", "Теперь войдите с новым паролем.")}</div>
            <button type="button" className="modal-btn" onClick={onClose}>{t("to_login", "Войти")}</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text,var(--t1))", marginBottom: 4 }}>🔐 {t("reset_pw_title", "Новый пароль")}</div>
            <div style={{ fontSize: 13.5, color: "var(--text3,var(--t3))", marginBottom: 18 }}>{t("reset_pw_desc", "Придумайте новый пароль для входа.")}</div>
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("new_password_label", "Новый пароль")} autoComplete="new-password" autoFocus style={inp} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t("pw_hide", "Скрыть пароль") : t("pw_show", "Показать пароль")} aria-pressed={show} style={{ position: "absolute", right: 6, top: 0, height: 44, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--text3,var(--t3))" }}>
                {show ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M10.6 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-0.4 1-1.2 2.2-2.4 3.3M6.3 6.3C4 7.7 2.6 9.9 2 12c1 2.5 5 7 10 7 1.6 0 3-0.4 4.3-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.5 9.6a3.5 3.5 0 004.9 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>) : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7s-9-4.5-10-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8"/></svg>)}
              </button>
            </div>
            {pw ? (
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {[0, 1, 2, 3].map((i) => (<span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < strength ? strColor : "var(--border2,var(--b1))", transition: "background .3s ease" }} />))}
              </div>
            ) : null}
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} value={cf} onChange={(e) => setCf(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t("confirm_password", "Повторите пароль")} autoComplete="new-password" style={inp} />
            </div>
            {err ? <div className="modal-err" style={{ marginBottom: 10 }}>{err}</div> : null}
            <button type="button" className="modal-btn" onClick={submit} disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}>
              {loading && <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />}
              {t("reset_pw_btn", "Сохранить пароль")}
            </button>
            <button type="button" onClick={onClose} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: "var(--text3,var(--t3))", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t("cancel", "Отмена")}</button>
          </>
        )}
      </div>
    </div>
  );
}
