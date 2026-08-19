import { lazy } from "react";

export const PublicLayout = lazy(() => import("@/layouts/PublicLayout"));
export const MyDrivePage = lazy(() => import("@/pages/Dashboard/MyDrive/index"));
export const RecentPage = lazy(() => import("@/pages/Dashboard/Recent"));
export const StarredPage = lazy(() => import("@/pages/Dashboard/Starred"));
