import type { ThemeProviderState } from "@/components/theme/ThemeProvider";
import { createContext, useContext } from "react";
export const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
