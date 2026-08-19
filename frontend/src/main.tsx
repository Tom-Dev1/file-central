import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.scss";
import App from "./App.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "./contexts/app.context.tsx";
import { queryClient } from "./lib/query-client";
import { authUserStorage } from "./lib/authUserStorage";
import { setOnSessionExpired } from "./lib/axios";
import { startAuthSessionLifecycle } from "./lib/auth-session";
import { router } from "./routes/router";
import "nprogress/nprogress.css";

setOnSessionExpired(() => {
  authUserStorage.clearUser();
  queryClient.clear();
  void router.navigate("/auth/login?reason=session-expired", { replace: true });
});

startAuthSessionLifecycle();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
