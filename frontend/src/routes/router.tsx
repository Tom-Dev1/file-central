import { createBrowserRouter, redirect } from "react-router-dom";

import PublicLayout from "@/layouts/PublicLayout";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import HomePage from "@/pages/HomePage";

import { guestOnlyLoader, requireAuthLoader } from "@/routes/authLoaders";
import AuthLayout from "@/layouts/AuthLayout/AuthLayout";
import NotFoundPage from "@/pages/NotFound/NotFound";
import DashboardLayout from "@/layouts/DashboardLayout/DashboardLayout";
import MyDrivePage from "@/pages/Dashboard/MyDrive";
import FolderPage from "@/pages/FolderPage";
import { folderLoader } from "./loaders/folder-loader";

export const router = createBrowserRouter([
  {
    Component: PublicLayout,
    children: [
      {
        index: true,
        Component: HomePage,
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
    ],
  },

  {
    path: "*",
    Component: NotFoundPage,
  },
]);
