import fs from "fs";
const p = "strategy-ai-full.tsx";
let lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
const imp = "import { ProjectsPage, ProjectDetail } from './client/projects/projects';";
if (!lines.some((l) => l.includes("client/projects/projects"))) {
  const i = lines.findIndex((l) => l.includes("ResetPasswordModal"));
  lines.splice(i + 1, 0, imp);
}
const iPP = lines.findIndex((l) => l.startsWith("// ── ProjectsPage"));
const iCP = lines.findIndex((l) => l.startsWith("// ── ContentPlanTab"));
const iPD = lines.findIndex((l) => l.startsWith("// ── ProjectDetail"));
const iIM = lines.findIndex((l) => l.startsWith("// ── InMapOnboarding"));
if (iPP < 0 || iCP < 0 || iPD < 0 || iIM < 0) {
  console.error("markers not found", { iPP, iCP, iPD, iIM });
  process.exit(1);
}
const out = [...lines.slice(0, iPP), ...lines.slice(iCP, iPD), ...lines.slice(iIM)];
fs.writeFileSync(p, out.join("\n"));
console.log("removed PP", iCP - iPP, "PD", iIM - iPD, "new lines", out.length);
