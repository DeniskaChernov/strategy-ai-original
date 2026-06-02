import React, { useEffect, useState } from "react";
import { login, register } from "../api";
import { useLang } from "../lang-context";

export function AuthFormContent({
  initialTab = "login",
  onAuth,
  theme: _theme = "dark",
  title = "",
  subtitle = "",
  variant = "modal",
  titleId = "auth-modal-title",
}: {
  initialTab?: "login" | "register";
  onAuth: (user: unknown, isNew: boolean) => void;
  theme?: string;
  title?: string;
  subtitle?: string;
  variant?: "modal" | "inline";
  titleId?: string;
}) {
  const { lang, setLang, t } = useLang();
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const pwStrength = (() => {
    const v = pw || "";
    if (!v) return { score: 0, label: "", color: "var(--b1)" };
    let s = 0;
    if (v.length >= 8) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    if (v.length >= 12 && s >= 3) s = 4;
    const map = [
      { label: t("pw_weak", "Слабый"), color: "#f04458" },
      { label: t("pw_weak", "Слабый"), color: "#f04458" },
      { label: t("pw_fair", "Средний"), color: "#f59e0b" },
      { label: t("pw_good", "Хороший"), color: "#3b82f6" },
      { label: t("pw_strong", "Надёжный"), color: "#12c482" },
    ];
    return { score: s, ...map[s] };
  })();

  async function submit() {
    if (!email || !pw || (tab === "register" && !name.trim())) {
      setErr(t("fill_fields", "Заполните все поля"));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErr(t("invalid_email", "Введите корректный email"));
      return;
    }
    if (tab === "register" && pw.length < 6) {
      setErr(t("pw_too_short", "Пароль не короче 6 символов"));
      return;
    }
    setLoading(true);
    setErr("");
    const res = tab === "login" ? await login(email, pw) : await register(email, pw, name);
    setLoading(false);
    if (res.error) setErr(res.error);
    else onAuth(res.user, res.isNew || false);
  }

  const inline = variant === "inline";
  const langs: Array<[string, string]> = [
    ["RU", "ru"],
    ["EN", "en"],
    ["UZ", "uz"],
  ];

  const LangSwitch = (
    <div
      className="sa-ws-lang-switch"
      role="group"
      aria-label={t("select_language", "Язык")}
      style={{ display: "inline-flex", background: "var(--inp)", border: ".5px solid var(--b1)", borderRadius: 22, padding: 3, gap: 1 }}
    >
      {langs.map(([label, code]) => (
        <button key={code} type="button" aria-pressed={lang === code} className={"land-lang-btn" + (lang === code ? " on" : "")} onClick={() => setLang(code)}>
          {label}
        </button>
      ))}
    </div>
  );

  const SegTabs = (
    <div
      role="tablist"
      aria-label={t("auth_tabs_aria", "Вход или регистрация")}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--inp)",
        border: ".5px solid var(--b1)",
        borderRadius: 14,
        padding: 4,
        gap: 0,
        width: "100%",
        maxWidth: 320,
        margin: "0 auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: tab === "login" ? 4 : "calc(50% + 0px)",
          width: "calc(50% - 4px)",
          borderRadius: 10,
          background: "linear-gradient(135deg,var(--accent-1),var(--accent-2))",
          boxShadow: "0 6px 18px rgba(104,54,245,.35),inset 0 1px 0 rgba(255,255,255,.18)",
          transition: "left .28s cubic-bezier(.34,1.56,.64,1)",
        }}
      />
      {(
        [
          ["login", t("login", "Войти")],
          ["register", t("register", "Регистрация")],
        ] as const
      ).map(([key, label]) => {
        const on = tab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              setTab(key);
              setErr("");
            }}
            style={{
              position: "relative",
              zIndex: 1,
              border: "none",
              background: "transparent",
              padding: "9px 10px",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: on ? 700 : 600,
              letterSpacing: "-0.01em",
              color: on ? "#fff" : "var(--t2)",
              transition: "color .22s ease",
              textShadow: on ? "0 1px 0 rgba(0,0,0,.18)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={inline ? "sa-ws-auth-form" : undefined}>
      {inline ? (
        <div className="sa-ws-auth-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          {SegTabs}
          {LangSwitch}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: 8, paddingRight: 44, minHeight: 30 }}>{LangSwitch}</div>
      )}
      {inline ? (
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div id={titleId} tabIndex={-1} className="modal-title" style={{ fontSize: "clamp(18px,3.8vw,22px)", marginTop: 0, marginBottom: subtitle ? 6 : 0, outline: "none", letterSpacing: "-0.02em" }}>
            {title || (tab === "login" ? t("welcome", "Добро пожаловать") : t("create_account", "Создать аккаунт"))}
          </div>
          {subtitle && <div className="modal-sub" style={{ marginBottom: 0 }}>{subtitle}</div>}
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div className="modal-gem" style={{ marginLeft: "auto", marginRight: "auto" }}>
            <img src="/logo.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />
          </div>
          <div id={titleId} className="modal-title" style={{ marginTop: 12, marginBottom: subtitle ? 4 : 0 }}>
            {title || (tab === "login" ? t("welcome", "Добро пожаловать") : t("create_account", "Создать аккаунт"))}
          </div>
          {subtitle && <div className="modal-sub">{subtitle}</div>}
        </div>
      )}
      {!inline && <div style={{ marginBottom: 18 }}>{SegTabs}</div>}
      {tab === "register" && <input className="modal-inp" placeholder={t("name", "Имя")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      <input
        type="email"
        className="modal-inp"
        placeholder={t("email", "Email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoComplete="email"
      />
      <div style={{ position: "relative", marginBottom: tab === "register" && pw ? 6 : err ? 8 : 4 }}>
        <input
          type={showPw ? "text" : "password"}
          className="modal-inp"
          placeholder={t("password", "Пароль")}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ marginBottom: 0, paddingRight: 46 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoComplete={tab === "login" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          aria-label={showPw ? t("pw_hide", "Скрыть пароль") : t("pw_show", "Показать пароль")}
          aria-pressed={showPw}
          title={showPw ? t("pw_hide", "Скрыть пароль") : t("pw_show", "Показать пароль")}
          style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--t3)", padding: 0, transition: "color .18s ease, transform .18s ease" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent-1)"; (e.currentTarget as HTMLElement).style.transform = "scale(1.12)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--t3)"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          {showPw ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M10.6 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-0.4 1-1.2 2.2-2.4 3.3M6.3 6.3C4 7.7 2.6 9.9 2 12c1 2.5 5 7 10 7 1.6 0 3-0.4 4.3-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.5 9.6a3.5 3.5 0 004.9 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7s-9-4.5-10-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8"/></svg>
          )}
        </button>
      </div>
      {tab === "register" && pw ? (
        <div style={{ marginBottom: err ? 8 : 6 }} aria-live="polite">
          <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < pwStrength.score ? pwStrength.color : "var(--b1)", transition: "background .3s ease" }} />
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: pwStrength.color, fontWeight: 600 }}>{t("pw_strength", "Надёжность")}: {pwStrength.label}</div>
        </div>
      ) : null}
      {err ? <div className="modal-err" style={{ marginBottom: 10 }}>{err}</div> : null}
      <button type="button" className="modal-btn" onClick={submit} disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}>
        {loading && (
          <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />
        )}
        {tab === "login" ? t("sign_in", "Войти") : t("sign_up", "Зарегистрироваться")}
      </button>
    </div>
  );
}
