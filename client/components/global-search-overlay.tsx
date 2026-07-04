import React from "react";

export function GlobalSearchOverlay({
  open,
  onClose,
  search,
  onSearchChange,
  searching,
  searchResults,
  onSelectResult,
  t,
  variant = "desktop",
}: {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  searching: boolean;
  searchResults: any[];
  onSelectResult: (r: any) => void;
  t: (key: string, fallback?: string) => string;
  variant?: "desktop" | "mobile";
}) {
  if (!open) return null;

  if (variant === "mobile") {
    return (
      <div
        id="search-overlay"
        className="open"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 420,
          padding: 0,
          background: "var(--modal-overlay-bg,rgba(0,0,0,.72))",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("search_projects_hint", "Search projects and maps…")}
          style={{ width: "100%", maxWidth: "100%", height: "100%", background: "var(--bg)", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("search_projects_hint", "Search projects and maps…")}
              className="input-smooth"
              style={{ flex: 1, padding: "11px 14px", fontSize: 14, background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: 12, color: "var(--text)", outline: "none", fontFamily: "inherit" }}
            />
            <button type="button" className="btn-g" onClick={onClose} style={{ height: 36, padding: "0 12px", fontSize: 12.5 }}>
              {t("close", "Close")}
            </button>
          </div>
          <SearchResultsBody searching={searching} search={search} searchResults={searchResults} onSelectResult={onSelectResult} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div
      id="search-overlay"
      className={open ? "open" : ""}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <div className="search-inp-row">
          <span style={{ fontSize: 16, color: "var(--t3)", flexShrink: 0 }} aria-hidden>
            🔍
          </span>
          <input
            autoFocus
            className="search-inp-main"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder={t("search_global_ph", "Search projects, nodes, scenarios…")}
          />
          <span className="search-kbd" onClick={onClose} role="button" tabIndex={0}>
            Esc
          </span>
        </div>
        <div className="search-results">
          <SearchResultsBody searching={searching} search={search} searchResults={searchResults} onSelectResult={onSelectResult} t={t} shell />
        </div>
      </div>
    </div>
  );
}

function SearchResultsBody({
  searching,
  search,
  searchResults,
  onSelectResult,
  t,
  shell = false,
}: {
  searching: boolean;
  search: string;
  searchResults: any[];
  onSelectResult: (r: any) => void;
  t: (key: string, fallback?: string) => string;
  shell?: boolean;
}) {
  const q = (search || "").trim();
  const canSearch = q.length >= 2;

  if (!canSearch) {
    return <div style={{ padding: shell ? "14px 18px" : "10px 6px", fontSize: 13, color: shell ? "var(--t3)" : "var(--text5)" }}>{t("search_type_more", "Type at least 2 characters")}</div>;
  }
  if (searching && searchResults.length === 0) {
    return <div style={{ padding: shell ? "14px 18px" : "10px 6px", fontSize: 13, color: shell ? "var(--t3)" : "var(--text5)" }}>{t("loading_short", "Loading…")}</div>;
  }
  if (searchResults.length === 0) {
    return <div style={{ padding: shell ? "14px 18px" : "10px 6px", fontSize: 13, color: shell ? "var(--t3)" : "var(--text5)" }}>{t("search_empty", "Nothing found")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: shell ? 0 : 8, padding: shell ? 0 : "10px 12px 16px" }}>
      {searchResults.slice(0, shell ? 24 : 30).map((r: any) =>
        shell ? (
          <button
            key={`${r.type}:${r.id}`}
            type="button"
            className="search-item"
            onClick={() => onSelectResult(r)}
            style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span className="search-item-type">{r.type === "map" ? "Map" : r.type === "node" ? "Node" : r.type}</span>
            <span className="search-item-title">{r.title || t("untitled", "Untitled")}</span>
            {r.subtitle ? <span className="search-item-sub">{r.subtitle}</span> : null}
          </button>
        ) : (
          <button
            key={`${r.type}:${r.id}`}
            type="button"
            className="btn-interactive"
            onClick={() => onSelectResult(r)}
            style={{ textAlign: "left", padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, color: "var(--text4)" }}>
              {r.type === "map" ? "M" : "N"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || t("untitled", "Untitled")}</div>
              <div style={{ fontSize: 12.5, color: "var(--text5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle || ""}</div>
              {r.highlight ? <div style={{ fontSize: 12.5, color: "var(--text4)", marginTop: 6, lineHeight: 1.4, opacity: 0.95 }}>{String(r.highlight)}</div> : null}
            </div>
          </button>
        )
      )}
    </div>
  );
}
