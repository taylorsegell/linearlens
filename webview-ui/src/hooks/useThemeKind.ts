import { useEffect } from "react";
import { readBootstrap } from "../bootstrap";

type ThemeKind = "light" | "dark" | "highContrast";

function applyThemeKind(kind: ThemeKind): void {
  document.documentElement.dataset.theme = kind;
}

export function useThemeKind(): void {
  useEffect(() => {
    const bootstrap = readBootstrap();
    if (bootstrap.themeKind) {
      applyThemeKind(bootstrap.themeKind);
    }

    const handler = (event: MessageEvent<{ type?: string; kind?: ThemeKind }>) => {
      if (event.data?.type === "theme" && event.data.kind) {
        applyThemeKind(event.data.kind);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
}
