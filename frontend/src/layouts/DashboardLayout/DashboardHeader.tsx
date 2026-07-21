import { ModeToggle } from "@/components/theme/ModeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { tokenStorage } from "@/lib/token-storage";
import { Cloud, HelpCircle, LogOut, Menu, MoreVertical, Search, Settings, User } from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

function DashboardHeader() {
  const navigate = useNavigate();

  const handleLogout = () => {
    tokenStorage.clear();

    navigate("/auth/login", {
      replace: true,
    });
  };

  return (
    <header className="h-16 shrink-0 border-b bg-background">
      <div className="flex h-full items-center px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
          //   onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        <NavLink to="/dashboard" className="flex shrink-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Cloud className="size-5" />
          </span>

          <span className="hidden text-xl font-semibold sm:block">File Central</span>
        </NavLink>
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute inset-y-0 left-4 my-auto size-5 text-muted-foreground" />

            <Input
              type="search"
              placeholder="Search in Drive"
              className="h-11 rounded-full border-transparent bg-muted pl-12 pr-12 "
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-1 my-auto size-9 rounded-full transition-none "
              aria-label="Search options"
            >
              <MoreVertical className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden rounded-full sm:inline-flex"
            aria-label="Help"
          >
            <HelpCircle className="size-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden rounded-full sm:inline-flex"
            aria-label="Settings"
            onClick={() => navigate("/dashboard/settings")}
          >
            <Settings className="size-5" />
          </Button>

          <ModeToggle />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="size-10 rounded-full p-0" aria-label="Open account menu">
                <Avatar className="size-9">
                  <AvatarImage src="" alt="User profile" />

                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>John Doe</span>

                  <span className="text-xs font-normal text-muted-foreground">john@example.com</span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
