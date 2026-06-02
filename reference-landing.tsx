import React, { useMemo, useRef, useState } from "react";
import { StrategyShellBg } from "./strategy-shell-sidebar";
import { LandingStarsCanvas } from "./client/landing-stars-canvas";
import { AnimatedLandingNav } from "./client/animated-landing-nav";
import { GlowCard } from "./client/glow-card";
import { LandingPricingCards } from "./client/landing-pricing-cards";
import type { TestimonialCardItem } from "./client/components/ui/testimonials-columns-1";
import { MotionTestimonialsMarquee } from "./client/components/ui/motion-testimonials-section";
import { LandingMapDemo } from "./client/landing-map-demo";
import { useScrollReveal } from "./client/use-scroll-reveal";
import { StatCounter } from "./client/stat-counter";
import { HeroParallaxOrbs } from "./client/hero-parallax-orbs";
import { ScrollProgress } from "./client/scroll-progress";
import { MagneticButton } from "./client/magnetic-button";
import { ScrollToTop } from "./client/scroll-to-top";
import { useRipple } from "./client/use-ripple";
import { safeInlineHtml } from "./client/lib/sanitize-html";

type TFn = (key: string, fallback?: string) => string;

const TESTI1 = { qk: "ref_t1_q", qf: "Карта и таймлайн в одном месте — наконец-то видно связь между целями и сроками.", nk: "ref_t1_n", nf: "Алексей К.", rk: "ref_t1_r", rf: "CEO", ini: "АК", avs: { background: "rgba(104,54,245,.2)", color: "#a278ff" } };
const TESTI2 = { qk: "ref_t2_q", qf: "Сценарии помогли перед совещанием: три варианта наглядно.", nk: "ref_t2_n", nf: "Мария Д.", rk: "ref_t2_r", rf: "CPO", ini: "МД", avs: { background: "rgba(18,196,130,.2)", color: "rgba(18,196,130,.9)" } };
const TESTI3 = { qk: "ref_t3_q", qf: "AI по шагам карты даёт конкретику, а не общие слова.", nk: "ref_t3_n", nf: "Тимур Р.", rk: "ref_t3_r", rf: "Партнёр", ini: "ТР", avs: { background: "rgba(240,148,40,.2)", color: "rgba(240,148,40,.95)" } };

function scrollToId(id: string){
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if(el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Лендинг в разметке и классах public/strategy-reference.html (токены .dk / .lt). */
export function ReferenceLandingView({
  t,
  lang,
  onChangeLang,
  theme,
  onToggleTheme,
  onSignIn,
  onGetStarted,
}: {
  t: TFn;
  lang: string;
  onChangeLang: (code: string) => void;
  theme: string;
  onToggleTheme: () => void;
  onSignIn: () => void;
  onGetStarted: () => void;
}){
  const rootRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  useScrollReveal(rootRef, [lang, theme]);
  useRipple(rootRef);

  const motionTestimonialColumns = useMemo((): [
    TestimonialCardItem[],
    TestimonialCardItem[],
    TestimonialCardItem[],
  ] => {
    const portraits = [
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1519085367523-7373598650c7?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=faces&auto=format&q=70",
    ];
    const templates = [TESTI1, TESTI2, TESTI3];
    const nine: TestimonialCardItem[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const x = templates[i % 3];
      return {
        text: t(x.qk, x.qf),
        name: t(x.nk, x.nf),
        role: t(x.rk, x.rf),
        image: portraits[i],
      };
    });
    return [nine.slice(0, 3), nine.slice(3, 6), nine.slice(6, 9)];
  }, [t]);

  const dk = theme === "dark" ? "dk" : "lt";
  const feats = [
    { icon: "🗺️", titleKey: "ref_feat_maps_t", titleFb: "Визуальные карты стратегии", descKey: "ref_feat_maps_d", descFb: "Узлы целей, инициатив, KPI, задач и рисков. Типизированные связи между узлами." },
    { icon: "⚖️", titleKey: "ref_feat_scen_t", titleFb: "Сценарии", descKey: "ref_feat_scen_d", descFb: "Несколько версий будущего и сравнение последствий на одной карте." },
    { icon: "🤖", titleKey: "ref_feat_ai_t", titleFb: "AI-советник", descKey: "ref_feat_ai_d", descFb: "Контекст ваших карт и шагов — ответы привязаны к делу, а не к шаблонам." },
    { icon: "📊", titleKey: "ref_feat_gantt_t", titleFb: "Gantt-таймлайн", descKey: "ref_feat_gantt_d", descFb: "Временная шкала инициатив, пересечения и прогресс по дорожной карте." },
    { icon: "💡", titleKey: "ref_feat_insight_t", titleFb: "Инсайты", descKey: "ref_feat_insight_d", descFb: "Оценка здоровья стратегии, пробелы и приоритеты." },
    { icon: "👥", titleKey: "ref_feat_team_t", titleFb: "Командная работа", descKey: "ref_feat_team_d", descFb: "Роли, комментарии, совместное редактирование и автосохранение." },
    { icon: "📤", titleKey: "ref_feat_export_t", titleFb: "Экспорт", descKey: "ref_feat_export_d", descFb: "PNG, JSON и др. Презентации — на тарифах Pro+." },
    { icon: "📸", titleKey: "ref_feat_ver_t", titleFb: "Версии карт", descKey: "ref_feat_ver_d", descFb: "Снимки состояний и история изменений." },
    { icon: "🔐", titleKey: "ref_feat_sec_t", titleFb: "Данные и доступ", descKey: "ref_feat_sec_d", descFb: "Роли в проекте и контроль доступа к картам для команды." },
  ];
  const trustPills = [
    { k: "ref_trust_p1", f: "B2B · SaaS" },
    { k: "ref_trust_p2", f: "Продакты и стратегия" },
    { k: "ref_trust_p3", f: "Консалтинг" },
    { k: "ref_trust_p4", f: "Финтех" },
    { k: "ref_trust_p5", f: "EdTech" },
  ];
  const audienceCards = [
    { icon: "🚀", tk: "ref_aud_1_t", tf: "Стартапы и руководители", dk: "ref_aud_1_d", df: "Показать цели, риски и план в одном виде — для команды и инвесторов." },
    { icon: "🎯", tk: "ref_aud_2_t", tf: "Продукт и стратегия", dk: "ref_aud_2_d", df: "Задачи, сценарии и сроки на одном экране — без прыжков между таблицами и досками." },
    { icon: "🧭", tk: "ref_aud_3_t", tf: "Консультанты и тренеры", dk: "ref_aud_3_d", df: "Проводить стратегические сессии в одном окне: карта, сценарии и материалы для заказчика." },
  ];
  const integrationItems: { k: string; f: string; mark: "exp" | "deck" | "team" | "api" }[] = [
    { k: "ref_int_1", f: "Сохранить карту в PNG или JSON", mark: "exp" },
    { k: "ref_int_2", f: "Презентации — на тарифах Pro и выше", mark: "deck" },
    { k: "ref_int_3", f: "Команда: роли и проекты", mark: "team" },
    { k: "ref_int_4", f: "API и внешние системы — в развитии продукта", mark: "api" },
  ];
  const tierStrip = [
    { id: "free" as const, badge: "⬡", color: "#9088b0", name: "Free" },
    { id: "starter" as const, badge: "◈", color: "#12c482", name: "Starter" },
    { id: "pro" as const, badge: "◆", color: "#a050ff", name: "Pro" },
    { id: "team" as const, badge: "✦", color: "#f09428", name: "Team" },
    { id: "enterprise" as const, badge: "💎", color: "#06b6d4", name: "Enterprise" },
  ];
  const faq = [
    { q: "ref_faq1_q", qf: "Что такое Strategy AI?", a: "ref_faq1_a", af: "Платформа визуального стратегического планирования: карты, сценарии, таймлайн и AI-советник с учётом ваших данных." },
    { q: "ref_faq2_q", qf: "Чем AI отличается от ChatGPT?", a: "ref_faq2_a", af: "Советник опирается на ваши проекты, карты и шаги — не на общий шаблонный ответ." },
    { q: "ref_faq3_q", qf: "Что в бесплатном тарифе?", a: "ref_faq3_a", af: "Ознакомление с продуктом: лимиты по проектам и картам — см. тарифы в приложении." },
    { q: "ref_faq4_q", qf: "Можно ли в команде?", a: "ref_faq4_a", af: "Да, на платных тарифах — участники проекта и роли." },
    { q: "ref_faq5_q", qf: "Экспорт?", a: "ref_faq5_a", af: "Доступен экспорт карты (в т.ч. PNG/JSON); PPTX — на старших тарифах." },
    { q: "ref_faq6_q", qf: "Есть ли онбординг?", a: "ref_faq6_a", af: "Да: подсказки в интерфейсе, шаблоны карт и быстрый старт без обучения «с нуля»." },
    { q: "ref_faq7_q", qf: "Можно ли работать офлайн?", a: "ref_faq7_a", af: "Основной режим — в браузере с сохранением в облаке; офлайн-режим может появиться позже." },
  ];

  return(
    <div ref={rootRef} className={`sa-ref-landing sa-strategy-ui sa-landing-shell ${dk} view on sa-v-landing`} style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "stretch", overflowY: "auto", overflowX: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <StrategyShellBg/>
      <LandingStarsCanvas theme={theme} />
      <ScrollProgress scrollRef={rootRef} />
      <ScrollToTop scrollRef={rootRef} label={t("scroll_to_top", "Наверх")} />
      <AnimatedLandingNav
        t={t}
        lang={lang}
        onChangeLang={onChangeLang}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        scrollToId={scrollToId}
      />

      <a href="#land-main" className="sa-skip-link">
        {t("skip_to_content", "Перейти к содержимому")}
      </a>
      <main
        key={lang}
        className="land-inner sa-lang-fade"
        id="land-main"
        tabIndex={-1}
        style={{ position: "relative", zIndex: 5 }}
      >
        <div className="land-nav-spacer"/>

        <div className="hero" id="hero-section">
          <HeroParallaxOrbs />
          <h1
            className="hero-h1"
            dangerouslySetInnerHTML={{
              __html: safeInlineHtml(t(
                "ref_hero_h1_html",
                'Стратегия,<br/><span class="grad-text">которая думает с вами</span>'
              )),
            }}
          />
          <p className="hero-sub">
            {t(
              "ref_hero_sub",
              "Визуальные карты целей и инициатив, сценарии «что если», таймлайн и AI-советник — в одном рабочем пространстве."
            )}
          </p>
          <div className="hero-btns">
            <MagneticButton type="button" className="btn-p lg" onClick={onGetStarted}>
              {t("hero_cta", "Начать бесплатно — без карты")}
            </MagneticButton>
            <MagneticButton type="button" className="btn-g lg" strength={6} radius={110} onClick={() => scrollToId("land-mockup")}>
              {t("ref_demo", "Смотреть интерфейс ↗")}
            </MagneticButton>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 11.5,
              color: "var(--t3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <span>{t("trust_1", "✓ Бесплатный тариф")}</span>
            <span>{t("trust_2", "✓ Без карты")}</span>
            <span>{t("trust_3", "✓ Старт за пару минут")}</span>
            <span>{t("trust_4", "✓ Отмена в любой момент")}</span>
          </div>
        </div>

        <div className="land-stats stagger" id="land-stats-section" style={{ marginBottom: 88 }}>
          <div className="stat-item sr sr-up in">
            <div className="stat-val" style={{ color: "var(--acc)" }}>
              <StatCounter to={2400} suffix="+" />
            </div>
            <div className="stat-lbl">{t("ref_stat_teams", "Команд")}</div>
          </div>
          <div className="stat-item sr sr-up in">
            <div className="stat-val" style={{ color: "var(--green)" }}>
              <StatCounter to={18} suffix="K+" />
            </div>
            <div className="stat-lbl">{t("ref_stat_maps", "Карт стратегии")}</div>
          </div>
          <div className="stat-item sr sr-up in">
            <div className="stat-val" style={{ color: "var(--amber)" }}>
              <StatCounter to={94} suffix="%" />
            </div>
            <div className="stat-lbl">{t("ref_stat_sat", "Удовлетворённость")}</div>
          </div>
          <div className="stat-item sr sr-up in">
            <div className="stat-val">
              <StatCounter to={4.9} decimals={1} thousandsSeparator="" /> ⭐
            </div>
            <div className="stat-lbl">Product Hunt</div>
          </div>
        </div>

        <div className="land-trust-strip sr sr-up in" aria-label={t("ref_trust_aria", "Отрасли и типы команд")}>
          <div className="land-trust-strip__lbl">{t("ref_trust_lbl", "Команды и отрасли")}</div>
          {trustPills.map((p) => (
            <span key={p.k} className="land-trust-pill">
              {t(p.k, p.f)}
            </span>
          ))}
        </div>

        <div className="mockup-wrap sr sr-scale in" id="land-mockup">
          <div className="mockup-glow"/>
          <LandingMapDemo theme={theme} t={t} onTry={onGetStarted} />
        </div>

        <div id="land-features">
          <div className="land-section-lbl sr sr-up in">{t("ref_sec_feat_lbl", "Всё необходимое")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_sec_feat_title", "Для стратегического мышления")}</div>
          <div className="land-section-sub sr sr-up in">{t("ref_sec_feat_sub", "От соло-основателя до команды — один инструмент для карты, сценариев и исполнения.")}</div>
          <div className="features-grid stagger" style={{ marginBottom: 88 }}>
            {feats.map(f=>(
              <GlowCard
                key={f.titleKey}
                panelVariant
                plain
                customSize
                width="100%"
                className="feat-card sr sr-up in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "18px 18px 20px",
                  boxSizing: "border-box",
                  alignSelf: "stretch",
                  height: "100%",
                  minHeight: 0,
                  justifyContent: "flex-start",
                }}
              >
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{t(f.titleKey, f.titleFb)}</div>
                <div className="feat-desc">{t(f.descKey, f.descFb)}</div>
              </GlowCard>
            ))}
          </div>
        </div>

        <div id="land-audience">
          <div className="land-section-lbl sr sr-up in">{t("ref_aud_lbl", "Кому подходит")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_aud_title", "Один продукт — разные роли")}</div>
          <div className="land-section-sub sr sr-up in">{t("ref_aud_sub", "Для тех, кто ведёт стратегию — от небольшой команды до консалта.")}</div>
          <div className="land-audience-grid stagger">
            {audienceCards.map((a) => (
              <GlowCard
                key={a.tk}
                panelVariant
                plain
                customSize
                width="100%"
                className="feat-card sr sr-up in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "18px 18px 20px",
                  boxSizing: "border-box",
                  alignSelf: "stretch",
                  height: "100%",
                  minHeight: 0,
                  justifyContent: "flex-start",
                }}
              >
                <div className="feat-icon">{a.icon}</div>
                <div className="feat-title">{t(a.tk, a.tf)}</div>
                <div className="feat-desc">{t(a.dk, a.df)}</div>
              </GlowCard>
            ))}
          </div>
        </div>

        <div id="land-compare">
          <div className="land-section-lbl sr sr-up in">{t("ref_sec_cmp_lbl", "Сравнение")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_sec_cmp_title", "Почему Strategy AI")}</div>
          <div className="land-section-sub sr sr-up in">{t("ref_sec_cmp_sub", "Специализация на стратегии: карта + сценарии + таймлайн + контекстный AI.")}</div>
          <div className="compare-wrap sr sr-scale in" style={{ marginBottom: 88 }}>
            <table className="compare-table">
              <thead><tr>
                <th>{t("ref_cmp_feat", "Функция")}</th>
                <th>Notion</th>
                <th>Miro</th>
                <th>ChatGPT</th>
                <th className="acc">Strategy AI ✦</th>
              </tr></thead>
              <tbody>
                <tr><td>{t("ref_cmp_row1", "Визуальная карта стратегии")}</td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center"><span className="compare-badge cb-yes">✓</span></td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="acc-col"><span className="compare-badge cb-yes">✓</span></td></tr>
                <tr><td>{t("ref_cmp_row2", "AI с контекстом бизнеса")}</td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center">{t("ref_cmp_partial", "Частично")}</td><td className="acc-col"><span className="compare-badge cb-yes">✓</span></td></tr>
                <tr><td>{t("ref_cmp_row3", "Сценарии")}</td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="acc-col"><span className="compare-badge cb-yes">✓</span></td></tr>
                <tr><td>{t("ref_cmp_row4", "Gantt / таймлайн")}</td><td className="center">{t("ref_cmp_partial", "Частично")}</td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="center"><span className="compare-badge cb-no">–</span></td><td className="acc-col"><span className="compare-badge cb-yes">✓</span></td></tr>
                <tr><td>{t("ref_cmp_row5", "Бесплатный старт")}</td><td className="center"><span className="compare-badge cb-yes">✓</span></td><td className="center"><span className="compare-badge cb-yes">✓</span></td><td className="center"><span className="compare-badge cb-yes">✓</span></td><td className="acc-col"><span className="compare-badge cb-yes">✓</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div id="land-integrations">
          <div className="land-section-lbl sr sr-up in">{t("ref_int_lbl", "Экосистема")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_int_title", "Экспорт, команда, развитие")}</div>
          <div className="land-section-sub sr sr-up in">{t("ref_int_sub", "Что можно сделать с картой сегодня и что появится дальше — прозрачно по тарифам.")}</div>
          <div className="land-int-grid sr sr-up in" role="list">
            {integrationItems.map((c) => (
              <div key={c.k} className={"land-int-item land-int-item--" + c.mark} role="listitem">
                <span className="land-int-item__mark" aria-hidden />
                <span className="land-int-item__txt">{t(c.k, c.f)}</span>
              </div>
            ))}
          </div>
        </div>

        <div id="land-testimonials">
          <div className="land-section-lbl sr sr-up in">{t("ref_testi_lbl", "Отзывы")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_testi_title", "Нам доверяют команды")}</div>
          <div className="land-section-sub sr sr-up in" style={{ marginBottom: 40 }}>{t("ref_testi_sub", "Структура вместо разрозненных таблиц и чатов.")}</div>
          <div className="stagger sr sr-up in" style={{ padding: "8px 0 12px", boxSizing: "border-box" }}>
            <MotionTestimonialsMarquee
              columns={motionTestimonialColumns}
              durations={[15, 19, 17]}
              ariaLabel={t("ref_testi_title", "Нам доверяют команды")}
            />
          </div>
        </div>

        <div id="land-faq">
          <div className="land-section-lbl sr sr-up in">{t("ref_faq_lbl", "Вопросы")}</div>
          <div className="land-section-title sr sr-up in">{t("ref_faq_title", "FAQ")}</div>
          <div className="land-section-sub sr sr-up in" style={{ marginBottom: 40 }}>{t("ref_faq_sub", "Коротко о продукте.")}</div>
          <div className="faq-list">
            {faq.map((item, i)=>(
              <div
                key={i}
                className={"faq-item sr sr-up in"+(openFaq===i?" open":"")}
                role="button"
                tabIndex={0}
                onClick={()=>setOpenFaq(openFaq===i?null:i)}
                onKeyDown={e=>{
                  if(e.key==="Enter"||e.key===" "){
                    e.preventDefault();
                    setOpenFaq(openFaq===i?null:i);
                  }
                }}
                aria-expanded={openFaq===i}
                aria-controls={`land-faq-panel-${i}`}
              >
                <div className="faq-q" id={`land-faq-q-${i}`}>{t(item.q, item.qf)}<span className="faq-icon" aria-hidden>+</span></div>
                <div
                  className="faq-a"
                  id={`land-faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`land-faq-q-${i}`}
                  aria-hidden={openFaq !== i}
                >
                  {t(item.a, item.af)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <section id="land-pricing" className="sa-land-pricing sr sr-up in">
          <div className="tier-wrap">
            <div className="tier-header">
              <div className="land-section-lbl">{t("tag_pricing_label", "Тарифы")}</div>
              <div className="tier-h">{t("ref_tiers_line", "Линейка тарифов")}</div>
              <div className="tier-s">{t("ref_tiers_note", "Полные лимиты по проектам, картам и AI — в разделе «Учётная запись» после входа.")}</div>
            </div>
            <LandingPricingCards t={t} tierStrip={tierStrip} onGetStarted={onGetStarted} />
          </div>
        </section>

        <div className="land-cta sr sr-scale in">
          <div className="cta-title" dangerouslySetInnerHTML={{ __html: safeInlineHtml(t("ref_cta_title_html", "Готовы к стратегии,<br/>которая доходит до исполнения?")) }}/>
          <div className="cta-sub">{t("ref_cta_sub", "Бесплатный тариф. Создайте аккаунт и первую карту за пару минут.")}</div>
          <div className="cta-btns">
            <button type="button" className="btn-p lg" onClick={onGetStarted}>{t("ref_cta_btn", "Создать аккаунт →")}</button>
            <button type="button" className="btn-g lg" onClick={()=>scrollToId("land-mockup")}>{t("ref_cta_demo", "Интерфейс")}</button>
          </div>
        </div>

        <div className="land-footer">
          <div className="land-logo" style={{ gap: 8 }}>
            <div className="land-gem" style={{ width: 28, height: 28, borderRadius: 8, fontSize: 11 }}>SA</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Strategy AI</span>
          </div>
          <div className="footer-links">
            <button type="button" className="footer-link" onClick={()=>scrollToId("land-features")}>{t("nav_features", "Возможности")}</button>
            <button type="button" className="footer-link" onClick={()=>scrollToId("land-audience")}>{t("nav_audience", "Для кого")}</button>
            <button type="button" className="footer-link" onClick={()=>scrollToId("land-compare")}>{t("ref_sec_cmp_lbl", "Сравнение")}</button>
            <button type="button" className="footer-link" onClick={()=>scrollToId("land-pricing")}>{t("nav_pricing", "Тарифы")}</button>
            <button type="button" className="footer-link" onClick={()=>scrollToId("land-faq")}>FAQ</button>
            <a className="footer-link" href="/privacy">{t("footer_privacy", "Конфиденциальность")}</a>
            <a className="footer-link" href="/terms">{t("footer_terms", "Условия")}</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} Strategy AI</div>
        </div>
      </main>
    </div>
  );
}
