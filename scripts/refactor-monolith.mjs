/**
 * Удаляет inline-дубликаты из strategy-ai-full.tsx и подключает вынесенные модули.
 * Запуск: node scripts/refactor-monolith.mjs
 */
import fs from "fs";

const p = "strategy-ai-full.tsx";
let src = fs.readFileSync(p, "utf8");
const lines = src.split(/\r?\n/);

const appIdx = lines.findIndex((l) => l.startsWith("// ── App ──"));
if (appIdx < 0) {
  console.error("App marker not found");
  process.exit(1);
}

const newImports = `import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  API_BASE,
  apiFetch,
  store,
  refreshUserAfterPayment,
  getJWT,
  clearJWT,
  clearRefreshToken,
  getSession,
  clearSession,
  seedDefault,
  normalizeUser,
  patchUser,
  getProjects,
} from "./client/api";
import { makeTfn } from "./client/i18n/makeTfn";
import { StrategyShellBg, type StrategyShellNav } from "./strategy-shell-sidebar";
const ReferenceLandingView = React.lazy(() =>
  import("./reference-landing").then((m) => ({ default: m.ReferenceLandingView }))
);
import { SplashLoaderScreen } from "./client/splash-loader";
import { parseMarketingPath } from "./client/spa-path";
import { applySeoForAppScreen } from "./client/seo-head";
import { LegalDocumentPage, NotFoundPage } from "./client/legal-pages";
import { trackSaEvent } from "./client/analytics";
import { getMaps, getMapsByProject } from "./client/lib/maps-api";
import { LangCtx } from "./client/lang-context";
import { OfflineBanner } from "./client/components/offline-banner";
import { TierSelectionScreen } from "./client/components/tier-selection-screen";
import { AuthModal } from "./client/strategy-modals/auth-modal";
import { CookieConsent } from "./client/components/cookie-consent";
import { ProfileModal } from "./client/strategy-modals/profile-modal";
import { MapEditor } from "./client/map-editor/map-editor";
import { DashboardPage } from "./client/dashboard/dashboard-page";
import { InsightsPage } from "./client/insights/insights-page";
import { AiAdvisorPage } from "./client/ai-advisor/ai-advisor-page";
import { ResetPasswordModal } from "./client/strategy-modals/reset-password-modal";
import { ProjectsPage, ProjectDetail } from "./client/projects/projects";
import { ContentPlanHubPage, ContentPlanProjectPage } from "./client/content-plan/content-plan-pages";
import { TrialBanner, EmailVerifyBanner } from "./client/components/trial-email-banners";
import { SplashScreen, initialMarketingScreen, initialLegalKind } from "./client/components/app-route-boot";

// Оркестратор SPA — экраны вынесены в client/*`;

const out = [...newImports.split("\n"), "", ...lines.slice(appIdx)];
fs.writeFileSync(p, out.join("\n"));
console.log("refactored", p, "lines:", out.length, "(was", lines.length + ")");
