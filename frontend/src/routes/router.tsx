import { createBrowserRouter, redirect } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import HomePage from "@/pages/HomePage";

import { guestOnlyLoader, requireAuthLoader } from "@/routes/authLoaders";
import AuthLayout from "@/layouts/AuthLayout/AuthLayout";
import NotFoundPage from "@/pages/NotFound/NotFound";
import DashboardLayout from "@/layouts/DashboardLayout/DashboardLayout";
import FolderPage from "@/pages/FolderPage";
import { folderLoader } from "./loaders/folder-loader";
import UploadTester from "@/components/UploadTesting";
import TrashPage from "@/pages/Dashboard/Trash";
import SharedPage from "@/pages/Dashboard/Shared";
import SharedFolderPage from "@/pages/Dashboard/Shared/SharedFolderPage";
import PublicSharePage from "@/pages/PublicShare";
import { MyDrivePage, PublicLayout, RecentPage, StarredPage } from "./lazy-components";

export const router = createBrowserRouter([
  {
    Component: PublicLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "shares/public/:token",
        Component: PublicSharePage,
      },
    ],
  },

  {
    path: "auth",
    loader: guestOnlyLoader,
    Component: AuthLayout,
    children: [
      {
        index: true,
        loader: () => redirect("/auth/login"),
      },
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "register",
        Component: RegisterPage,
      },
    ],
  },

  {
    path: "dashboard",
    loader: requireAuthLoader,
    shouldRevalidate: ({ currentUrl, nextUrl, defaultShouldRevalidate }) => {
      if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) {
        return false;
      }

      return defaultShouldRevalidate;
    },
    Component: DashboardLayout,
    children: [
      {
        index: true,
        Component: MyDrivePage,
      },
      {
        path: "folders/:folderId",
        loader: folderLoader,
        Component: FolderPage,
      },
      {
        path: "shared",
        Component: SharedPage,
      },
      {
        path: "shared/folders/:folderId",
        Component: SharedFolderPage,
      },
      {
        path: "recent",
        Component: RecentPage,
      },
      {
        path: "starred",
        Component: StarredPage,
      },
      {
        path: "trash",
        Component: TrashPage,
      },

      {
        path: "test",
        Component: UploadTester,
      },
    ],
  },

  {
    path: "*",
    Component: NotFoundPage,
  },
]);
