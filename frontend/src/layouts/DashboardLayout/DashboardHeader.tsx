import { useEffect, useState } from "react";
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
import { authUserStorage, type StoredUser } from "@/lib/authUserStorage";
import { tokenStorage } from "@/lib/token-storage";
import { Cloud, HelpCircle, LogOut, Menu, MoreVertical, Search, Settings, User } from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

function DashboardHeader() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => authUserStorage.getUser());

  const displayName = currentUser?.name || currentUser?.username || currentUser?.email || "User";
  const initials = getInitials(displayName);

  useEffect(() => {
    const synchronizeUser = () => {
      setCurrentUser(authUserStorage.getUser());
    };

    window.addEventListener("storage", synchronizeUser);

    return () => {
      window.removeEventListener("storage", synchronizeUser);
    };
  }, []);

  const handleLogout = () => {
    tokenStorage.clear();
    authUserStorage.clearUser();
    setCurrentUser(null);

    navigate("/auth/login", {
      replace: true,
    });
  };

  return (
    <header className="h-16 shrink-0 border-b border-border/70 bg-background">
      <div className="flex h-full items-center gap-3 px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full lg:hidden"
          aria-label="Open navigation menu"
          //   onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cloud className="size-5" />
          </span>

          <span className="hidden text-[1.375rem] font-normal tracking-tight text-foreground sm:block">
            File <span className="font-medium text-muted-foreground">Central</span>
          </span>
        </NavLink>

        <div className="mx-auto w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute inset-y-0 left-4 my-auto size-5 text-muted-foreground" />

            <Input
              type="search"
              placeholder="Search in Drive"
              className="h-11 rounded-full border-transparent bg-muted pl-12 pr-12 shadow-none focus-visible:border-primary/30 focus-visible:ring-primary/20"
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
                  <AvatarImage src={currentUser?.avatarUrl} alt={displayName} />

                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="truncate">{displayName}</span>

                  {currentUser?.email && (
                    <span className="truncate text-xs font-normal text-muted-foreground">{currentUser.email}</span>
                  )}
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

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default DashboardHeader;
