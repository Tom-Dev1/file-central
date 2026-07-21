import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { ThemeProvider } from "./components/theme/ThemeProvider";

function App() {
  return (
    <>
      <ThemeProvider defaultTheme="system" storageKey="file-central-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </>
  );
}

export default App;
