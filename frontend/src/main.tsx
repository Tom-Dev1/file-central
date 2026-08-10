import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.scss";
import App from "./App.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "./contexts/app.context.tsx";
import { queryClient } from "./lib/query-client";
import "nprogress/nprogress.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
