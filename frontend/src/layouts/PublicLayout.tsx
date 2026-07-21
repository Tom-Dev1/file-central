import { useEffect, useState } from "react";
import { Cloud, LayoutDashboard, LogOut, Menu, Settings } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { ModeToggle } from "@/components/theme/ModeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { tokenStorage } from "@/lib/token-storage";
import { authUserStorage, type StoredUser } from "@/lib/authUserStorage";

const navigationItems = [
  {
    label: "Home",
    path: "/",
    end: true,
  },
  {
    label: "Features",
    path: "/#features",
    end: false,
  },
  {
    label: "Security",
    path: "/#security",
    end: false,
  },
];

function PublicLayout() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => authUserStorage.getUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = Boolean(tokenStorage.getAccessToken());

  useEffect(() => {
    const synchronizeAuthentication = () => {
      setCurrentUser(authUserStorage.getUser());
    };

    window.addEventListener("storage", synchronizeAuthentication);

    return () => {
      window.removeEventListener("storage", synchronizeAuthentication);
    };
  }, []);

  function handleSignOut() {
    tokenStorage.clear();
    authUserStorage.clearUser();
    setCurrentUser(null);

    navigate("/auth/login", {
      replace: true,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cloud className="size-5" />
            </span>

            <span className="text-lg font-normal tracking-tight">
              File <span className="font-medium text-muted-foreground">Central</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navigationItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive && item.path === "/" && "bg-accent text-accent-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ModeToggle />

            {isAuthenticated ? (
              <UserMenu user={currentUser} onSignOut={handleSignOut} />
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth/login">Sign in</Link>
                </Button>

                <Button asChild>
                  <Link to="/auth/register">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ModeToggle />

            {isAuthenticated && <UserMenu user={currentUser} onSignOut={handleSignOut} compact />}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Open navigation menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>

                <nav className="flex flex-col gap-1 px-4">
                  {navigationItems.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "rounded-md px-4 py-3 text-sm font-medium transition-colors",
                          "text-muted-foreground hover:bg-muted hover:text-foreground",
                          isActive && item.path === "/" && "bg-muted text-foreground"
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <div className="mt-auto flex flex-col gap-2 border-t p-4">
                  {isAuthenticated ? (
                    <>
                      <Button variant="outline" asChild onClick={() => setMobileMenuOpen(false)}>
                        <Link to="/dashboard">Dashboard</Link>
                      </Button>

                      <Button variant="ghost" className="text-destructive" onClick={handleSignOut}>
                        Sign out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" asChild onClick={() => setMobileMenuOpen(false)}>
                        <Link to="/auth/login">Sign in</Link>
                      </Button>

                      <Button asChild onClick={() => setMobileMenuOpen(false)}>
                        <Link to="/auth/register">Get started</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="relative z-30 flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 font-semibold">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Cloud className="size-4" />
              </span>
              File Central
            </Link>

            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              A centralized workspace that helps you store, organize, share, and protect your files with ease.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Product</h2>

            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <Link to="/#features" className="hover:text-foreground">
                Features
              </Link>

              <Link to="/#security" className="hover:text-foreground">
                Security
              </Link>

              <Link to="/auth/register" className="hover:text-foreground">
                Create an account
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Account</h2>

            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="hover:text-foreground">
                    Dashboard
                  </Link>

                  <Link to="/dashboard/settings" className="hover:text-foreground">
                    Settings
                  </Link>

                  <button type="button" className="w-fit text-left hover:text-foreground" onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth/login" className="hover:text-foreground">
                    Sign in
                  </Link>

                  <Link to="/auth/register" className="hover:text-foreground">
                    Create an account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p>© 2026 File Central. All rights reserved.</p>

            <p>Store and share your files securely.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface UserMenuProps {
  user: StoredUser | null;
  onSignOut: () => void;
  compact?: boolean;
}

function UserMenu({ user, onSignOut, compact = false }: UserMenuProps) {
  const displayName = user?.name || user?.username || user?.email || "User";

  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("h-10 rounded-full", compact ? "size-10 p-0" : "gap-3 px-2 pr-3")}
          aria-label="Open account menu"
        >
          <Avatar className="size-8">
            <AvatarImage src={user?.avatarUrl} alt={displayName} />

            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          {!compact && (
            <div className="max-w-36 text-left">
              <p className="truncate text-sm font-medium">{displayName}</p>

              {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate">{displayName}</span>

            {user?.email && <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <LayoutDashboard className="mr-2 size-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/dashboard/settings">
            <Settings className="mr-2 size-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onSignOut}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

export default PublicLayout;
