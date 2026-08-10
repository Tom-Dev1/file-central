import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { initialAppContext } from "./contexts";

import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import { useTheme } from './contexts/themeContext';
import classes from "./App.module.css";


function ThemedRouter() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#8ab4f8' : '#1a73e8',
          colorBgBase: isDark ? '#202124' : '#ffffff',
          colorTextBase: isDark ? '#e8eaed' : '#202124',
          colorBorder: isDark ? '#3c4043' : '#dadce0',
          borderRadius: 12,
          controlHeight: 36,
          fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
        },
        components: {
          Button: { borderRadius: 10, controlHeight: 36 },
          Card: { borderRadiusLG: 12 },
          Modal: { borderRadiusLG: 16 },
          Table: {
            headerBg: isDark ? '#292a2d' : '#f8f9fa',
            rowHoverBg: isDark ? '#292a2d' : '#f8f9fa',
          },
        },
      }}
    >
      <AntdApp className={classes.antdapp}>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}

function App() {
  if (!initialAppContext) {
    return <AppLoadingScreen />;
  }
  return (
    <ThemeProvider defaultTheme="system" storageKey="file-central-theme">
      <ThemedRouter />
    </ThemeProvider>
  );
}

export default App;
