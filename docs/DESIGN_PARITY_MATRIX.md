# Design parity matrix

Source of truth: [`public/strategy-reference.html`](../public/strategy-reference.html)  
CSS pipeline: `npm run sync:shell-css` → `client/strategy-shell.css` → `public/`

| Reference `#s-*` | React screen | Component | Sidebar mode | Status |
|------------------|--------------|-----------|--------------|--------|
| — (React-only) | `dashboard` | `DashboardPage` | reference | done |
| `#s-projects` | `projects` | `ProjectsPage` | reference | done |
| `#s-project-card` | `project` | `ProjectDetail` | reference + project-nav | done |
| `#s-map` | `map` | `MapEditor` | reference + project-nav | done |
| `#s-scenarios` | — (tab) | `ProjectDetail` tab | project-nav | done |
| `#s-timeline` | — (tab/map) | `MapEditor` Gantt | project-nav | partial |
| `#s-ai` | `ai` | `AiAdvisorPage` | reference | done |
| `#s-insights` | `insights` | `InsightsPage` | reference | done |
| `#s-content` | `contentPlanHub` / `contentPlanProject` | `content-plan-pages` | reference | done |
| `#s-team` | — (tab) | `ProjectDetail` tab | project-nav | done |
| `#s-settings` | `settings` | `SettingsPage` | reference (topbar) | done |

## Topbar CTA matrix (reference `goApp`)

| Screen | CTA label | Action |
|--------|-----------|--------|
| projects | + New project | open new project modal |
| project | + New map | create map |
| map | + Add node | add node |
| ai | New chat | clear chat |
| settings | hidden | — |
| dashboard | + New project | navigate projects + create |

## Key CSS classes per screen

| Screen | Required classes |
|--------|------------------|
| projects | `.scr`, `.slbl`, `.proj-grid`, `.proj-card`, `.new-card` |
| project-card | `.proj-tabs-bar`, `.proj-tab`, `.po-grid`, `.map-list-item`, `.sc-grid`, `.team-list` |
| map | `.map-canvas-wrap`, `.map-filter-bar`, `.map-toolbar`, `.node-panel` |
| ai | `.chat-area`, `.chat-inp-row`, `.ai-sidebar`, `.qa-btn` |
| insights | `.r4`, `.kpi-card`, `.insight-card` |
| settings | `.settings-layout`, `.settings-nav`, `.sni`, `.settings-body` |
| content | `.cp-kanban`, `.cp-col`, `.cp-card` |

*Updated: design parity P1.*
