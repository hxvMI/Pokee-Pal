import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);
const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "cottage", label: "Cottage", icon: "⌂" },
  { value: "berry", label: "Berry", icon: "♥" },
  { value: "midnight", label: "Midnight", icon: "✦" },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return THEME_OPTIONS.some((option) => option.value === saved) ? saved : "cottage";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeOptions: THEME_OPTIONS }}>
      {children}
    </ThemeContext.Provider>
  );
}

// The workshop keeps the provider and its companion hook together for clarity.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
