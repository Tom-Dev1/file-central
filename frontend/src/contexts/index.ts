import { getAccessTokenFromLS } from "@/utils/auth-utils";
import type { AppContextInterface } from "./app.context";
import { createContext } from "react";

export const getInitialAppContext: () => AppContextInterface = () => ({
  isAuthenticated: Boolean(getAccessTokenFromLS()),
  setIsAuthenticated: () => null,
  reset: () => null,
});
export const initialAppContext = getInitialAppContext();

export const AppContext = createContext<AppContextInterface>(initialAppContext);
