import React, { useState } from "react";

const EMOJIS = ["🚀", "📊", "🎯", "💡", "🛡️", "🔗", "⚡", "🌍", "💰", "📈", "🏆", "🔬", "🌱", "🎪", "🏗️", "🎨"];
const COLORS = [
  "rgba(104,54,245,.2)",
  "rgba(18,196,130,.15)",
  "rgba(240,148,40,.15)",
  "rgba(6,182,212,.15)",
  "rgba(240,68,88,.12)",
  "rgba(168,85,247,.15)",
];

export function NewProjectModal({
  onClose,
  onCreate,
  t,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; icon?: string; color?: string }) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selEmoji, setSelEmoji] = useState("🚀");
  const [selColor, setSelColor] = useState(COLORS[0]);

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(8px)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("new_project", "New project")}
        style={{
          width: "min(96vw,460px)",
          background: "var(--sb)",
          backdropFilter: "blur(50px)",
          border: ".5px solid var(--b2)",
          borderRadius: 18,
          padding: 26,
          boxShadow: "0 28px 70px rgba(0,0,0,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: selColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
              transition: "background .2s",
            }}
          >
            {selEmoji}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)" }}>{t("new_project", "New project")}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
              {t("new_project_sub", "Create a strategic planning workspace")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close", "Close")}
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              borderRadius: 22,
              background: "var(--inp)",
              border: ".5px solid var(--b1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--t2)",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--t2)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".07em",
            marginBottom: 6,
          }}
        >
          {t("project_name_required", "Project name *")}
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onCreate({ name: name.trim(), description: desc.trim() || undefined, icon: selEmoji, color: selColor });
          }}
          style={{
            width: "100%",
            background: "var(--inp)",
            border: ".5px solid var(--b1)",
            borderRadius: 10,
            padding: "10px 13px",
            fontSize: 13,
            color: "var(--t1)",
            fontFamily: "inherit",
            outline: "none",
            marginBottom: 14,
            boxSizing: "border-box",
          }}
          placeholder={t("new_project_name_ph", "e.g. Q3 2025 Strategy, Product Roadmap…")}
        />
        <div
          style={{
            fontSize: 10,
            color: "var(--t2)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".07em",
            marginBottom: 6,
          }}
        >
          {t("description", "Description")}
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{
            width: "100%",
            background: "var(--inp)",
            border: ".5px solid var(--b1)",
            borderRadius: 10,
            padding: "10px 13px",
            fontSize: 13,
            color: "var(--t1)",
            fontFamily: "inherit",
            outline: "none",
            resize: "none",
            lineHeight: 1.5,
            marginBottom: 14,
            boxSizing: "border-box",
          }}
          rows={2}
          placeholder={t("new_project_desc_ph", "What is this project about?")}
        />
        <div
          style={{
            fontSize: 10,
            color: "var(--t2)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".07em",
            marginBottom: 8,
          }}
        >
          {t("icon", "Icon")}
        </div>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <div
              key={e}
              className={"emoji-opt" + (e === selEmoji ? " on" : "")}
              onClick={() => setSelEmoji(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") setSelEmoji(e);
              }}
              role="button"
              tabIndex={0}
            >
              {e}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--t2)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".07em",
            marginBottom: 8,
          }}
        >
          {t("color", "Color")}
        </div>
        <div className="color-row">
          {COLORS.map((c) => (
            <div
              key={c}
              className={"color-opt" + (c === selColor ? " on" : "")}
              style={{ background: c }}
              onClick={() => setSelColor(c)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") setSelColor(c);
              }}
              role="button"
              tabIndex={0}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onCreate({ name: name.trim(), description: desc.trim() || undefined, icon: selEmoji, color: selColor })}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 22,
              background: "linear-gradient(135deg,#6836f5,#a050ff)",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(104,54,245,.38)",
              opacity: name.trim() ? 1 : 0.55,
            }}
          >
            {t("create_project", "Create project")}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 42,
              padding: "0 18px",
              borderRadius: 22,
              background: "var(--bg-btn)",
              color: "var(--col-btn)",
              border: ".5px solid var(--brd-btn)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
