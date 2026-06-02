// Минимальный allowlist-санитайзер для строк, которые рендерятся через
// dangerouslySetInnerHTML. Разрешаем только безопасный инлайновый набор тегов
// (форматирование текста) и единственный атрибут class у <span>.
// Скрипты, обработчики событий (on*), и опасные URI вырезаются.

const ALLOWED_TAGS = new Set(["BR", "SPAN", "B", "I", "EM", "STRONG", "U", "MARK", "SMALL"]);

function stripDangerousFallback(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(iframe|object|embed|svg|img|link|style|meta|form|input|button|a)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function safeInlineHtml(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return stripDangerousFallback(html);
  try {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 1) {
          const el = child as Element;
          if (!ALLOWED_TAGS.has(el.tagName)) {
            el.replaceWith(document.createTextNode(el.textContent || ""));
            continue;
          }
          for (const attr of Array.from(el.attributes)) {
            const keep = el.tagName === "SPAN" && attr.name.toLowerCase() === "class";
            if (!keep) el.removeAttribute(attr.name);
          }
          walk(el);
        }
      }
    };
    walk(tpl.content);
    return tpl.innerHTML;
  } catch {
    return stripDangerousFallback(html);
  }
}
