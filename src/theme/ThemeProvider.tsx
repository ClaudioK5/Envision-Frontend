import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EnvisionTheme = "classic" | "girlie";

const STORAGE_KEY = "envision-theme";

type ThemeContextValue = {
  theme: EnvisionTheme;
  setTheme: (theme: EnvisionTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): EnvisionTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "girlie" || raw === "classic") return raw;
  } catch {
    // ignore
  }
  return "classic";
}

function applyThemeToDocument(theme: EnvisionTheme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "girlie" ? "#fff5f8" : "#fff9f0");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<EnvisionTheme>(() => {
    if (typeof document === "undefined") return "classic";
    return readStoredTheme();
  });

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next: EnvisionTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
