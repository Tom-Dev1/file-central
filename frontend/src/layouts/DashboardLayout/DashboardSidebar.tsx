import DropdownUpload from "@/components/PopoverUpload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Clock3, FileClock, HardDrive, Share2, Star, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";

interface NavigationItem {
  title: string;
  path: string;
  icon: ComponentType<{
    className?: string;
  }>;
  end?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    title: "My Drive",
    path: "/dashboard",
    icon: HardDrive,
    end: true,
  },
  {
    title: "Shared with me",
    path: "/dashboard/shared",
    icon: Share2,
  },
  {
    title: "Recent",
    path: "/dashboard/recent",
    icon: Clock3,
  },
  {
    title: "Starred",
    path: "/dashboard/starred",
    icon: Star,
  },
  {
    title: "Trash",
    path: "/dashboard/trash",
    icon: Trash2,
  },
];
interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export default function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <DropdownUpload />
      </div>

      <nav className="space-y-1 px-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="size-5" />

              {item.title}
            </NavLink>
          );
        })}
      </nav>

      <Separator className="my-4" />

      <div className="px-6">
        <div className="flex items-center gap-3">
          <HardDrive className="size-5 text-muted-foreground" />

          <span className="text-sm font-medium">Storage</span>
        </div>

        <Progress value={37} className="mt-4 h-2" />

        <p className="mt-2 text-xs text-muted-foreground">5.6 GB of 15 GB used</p>

        <Button type="button" variant="outline" size="sm" className="mt-4 w-full">
          Get more storage
        </Button>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-xl bg-muted/60 p-4">
          <div className="flex items-center gap-2">
            <FileClock className="size-4 text-muted-foreground" />

            <p className="text-sm font-medium">Activity</p>
          </div>

          <p className="mt-2 text-xs leading-5 text-muted-foreground">Your recent file activity will appear here.</p>
        </div>
      </div>
    </div>
  );
}
