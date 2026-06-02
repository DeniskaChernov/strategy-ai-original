import React, { useState } from "react";
import { getProjects, patchUser, saveProject } from "../api";
import { deleteMap, getMaps, saveMap } from "../lib/maps-api";
import { SavingScreen } from "../components/saving-screen";
import { TierSelectionScreen } from "../components/tier-selection-screen";
import { useLang } from "../lang-context";
import { TIERS } from "../lib/tiers";
import { uid } from "../lib/util";
import { AuthModal } from "./auth-modal";
import { MapConflictModal } from "./map-conflict-modal";

/**
 * Поток после AI-онбординга: авторизация → при необходимости тариф → конфликт лимита карт → сохранение карты.
 * Подключите из корня приложения, когда есть `pendingMap` из генерации.
 */
export function PostOnboardFlow({
  pendingMap,
  currentUser,
  theme = "dark",
  onComplete,
  onBack,
}: {
  pendingMap: { nodes?: unknown[]; edges?: unknown[]; ctx?: string } | null;
  currentUser: unknown;
  theme?: string;
  onComplete: (user: unknown, proj: unknown, saved: unknown) => void;
  onBack: () => void;
}) {
  const { t } = useLang();
  const [step, setStep] = useState(currentUser ? "check" : "auth");
  const [user, setUser] = useState(currentUser);
  const [isNew, setIsNew] = useState(false);
  const [targetProject, setTargetProject] = useState<any>(null);
  const [existingMaps, setExistingMaps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function afterAuth(u: any, newUser: boolean) {
    setUser(u);
    setIsNew(newUser);
    if (newUser) setStep("tier");
    else await runCheck(u);
  }

  async function afterTierSelect(tier: string) {
    const u = user as any;
    const upd = await patchUser(u.email, { tier });
    if (upd) {
      setUser(upd);
      await runCheck(upd);
    } else await runCheck(u);
  }

  async function runCheck(u: any) {
    setSaving(true);
    const tier = TIERS[u.tier] || TIERS.free;
    let projs = await getProjects(u.email);
    let proj = projs.find((p: any) => p.owner === u.email);
    if (!proj) {
      proj = { id: uid(), name: "Моя стратегия", owner: u.email, members: [{ email: u.email, role: "owner" }], createdAt: Date.now() };
      try {
        const saved = await saveProject(proj);
        if (saved) proj = saved;
      } catch (e) {
        // Не роняем онбординг при сетевой ошибке — продолжаем с локальным проектом.
        console.warn("onboarding: saveProject failed", e);
      }
    }
    setTargetProject(proj);
    const maps = await getMaps(proj.id);
    const regMaps = maps.filter((m: any) => !m.isScenario);
    setSaving(false);
    if (regMaps.length >= tier.maps) {
      setExistingMaps(regMaps);
      setStep("conflict");
    } else await doSaveAndGo(proj, u, null);
  }

  async function doSaveAndGo(proj: any, u: any, replaceMapId: string | null) {
    setSaving(true);
    if (replaceMapId) await deleteMap(proj.id, replaceMapId);
    const map = {
      id: uid(),
      name: "Карта от AI",
      nodes: pendingMap?.nodes || [],
      edges: pendingMap?.edges || [],
      ctx: pendingMap?.ctx || "",
      isScenario: false,
      createdAt: Date.now(),
    };
    const saved = await saveMap(proj.id, map);
    setSaving(false);
    onComplete(u, proj, saved);
  }

  if (saving) return <SavingScreen theme={theme} />;

  if (step === "auth")
    return (
      <div data-theme={theme} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", height: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <AuthModal initialTab="register" theme={theme} title="Сохранить карту" subtitle="Создайте аккаунт — карта сохранится автоматически" onAuth={afterAuth} onClose={onBack} />
        <button
          onClick={onBack}
          style={{ position: "absolute", top: 16, left: 16, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text4)", cursor: "pointer", fontSize: 13 }}
        >
          {t("back_btn", "← Назад")}
        </button>
      </div>
    );

  if (step === "tier") return <TierSelectionScreen isNew={isNew} currentUser={user as any} theme={theme} onSelect={afterTierSelect} onBack={() => setStep("auth")} />;

  if (step === "conflict")
    return (
      <div data-theme={theme} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", height: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MapConflictModal
          existingMaps={existingMaps}
          newNodeCount={pendingMap?.nodes?.length || 0}
          tierLabel={(TIERS[(user as any)?.tier] || TIERS.free).label}
          tierMapsCount={(TIERS[(user as any)?.tier] || TIERS.free).maps}
          onReplace={async (mapId) => {
            await doSaveAndGo(targetProject, user, mapId);
          }}
          onUpgrade={() => setStep("tier")}
          theme={theme}
        />
      </div>
    );

  return <SavingScreen theme={theme} />;
}
