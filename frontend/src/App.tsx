import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { Toaster } from "./components/ui/sonner";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { initialAppContext } from "./contexts";

function App() {
  if (!initialAppContext) {
    return <AppLoadingScreen />;
  }
  return (
    <>
      <ThemeProvider defaultTheme="system" storageKey="file-central-theme">
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </>
  );
}

export default App;
