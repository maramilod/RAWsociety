"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { LANG_COOKIE, buildTranslator, type Lang, type Translator } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });
export const useLanguage = () => useContext(Ctx);

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "NOSCRIPT"]); // no text translated inside
const NO_TEXT = new Set(["TEXTAREA"]); // the typed text stays as is, but its placeholder is translated
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Arabic works by translating the page in the browser: every text on the page that has an entry in the dictionary
 * is replaced, and texts React adds later are translated as they appear. Switching language reloads the page.
 */
export default function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const observer = useRef<MutationObserver | null>(null);

  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);

  useIsoLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (lang !== "ar") {
      document.documentElement.removeAttribute("data-i18n");
      return;
    }
    let cancelled = false;
    const written = new WeakMap<Node, string>();
    let tr: Translator | null = null;

    const text = (node: Text) => {
      const v = node.nodeValue ?? "";
      if (written.get(node) === v) return;
      const parent = node.parentElement;
      if (!parent || SKIP.has(parent.tagName) || NO_TEXT.has(parent.tagName) || parent.closest("[translate=no]")) return;
      const out = tr!(v);
      if (out !== null && out !== v) {
        written.set(node, out);
        node.nodeValue = out;
      }
    };
    const attrs = (el: Element) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && !el.closest("[translate=no]")) {
          const out = tr!(v);
          if (out !== null && out !== v) el.setAttribute(a, out);
        }
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return text(root as Text);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP.has(el.tagName)) return;
      attrs(el);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) text(n as Text);
        else if (!SKIP.has((n as Element).tagName)) attrs(n as Element);
      }
    };

    import("@/lib/i18n/ar").then(({ default: dict }) => {
      if (cancelled) return;
      tr = buildTranslator(dict);
      walk(document.body);
      document.documentElement.removeAttribute("data-i18n");
      observer.current = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "childList") m.addedNodes.forEach(walk);
          else if (m.type === "characterData") text(m.target as Text);
          else if (m.type === "attributes") attrs(m.target as Element);
        }
      });
      observer.current.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
    return () => {
      cancelled = true;
      observer.current?.disconnect();
    };
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}
