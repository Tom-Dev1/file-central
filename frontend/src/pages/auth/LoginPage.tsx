import { useState, type SubmitEventHandler } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useLogin } from "@/hooks/useAuth";
import { tokenStorage } from "@/lib/token-storage";
import { ApiError } from "@/lib/api-error";
import { Label } from "@/components/ui/label";
import { authUserStorage } from "@/lib/authUserStorage";

function describeLoginError(error: ApiError): string {
  if (error.isUnauthorized) return "Incorrect username or password.";
  if (error.isRateLimited) return "Too many attempts. Please wait a minute and try again.";
  if (error.statusCode === 0) return "Could not reach the server. Check your connection and try again.";
  return error.messages.join(" ");
}

function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();

  const [remember, setRemember] = useState(true);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const credentials = {
      username: String(formData.get("username") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    login.mutate(credentials, {
      onSuccess: (data) => {
        tokenStorage.setTokens(data.accessToken, data.refreshToken, remember);
        authUserStorage.setUser(
          {
            id: data.user.id,
            name: data.user.name,
            username: data.user.username,
            email: data.user.email,
          },
          remember
        );
        navigate("/dashboard", {
          replace: true,
        });
      },
    });
  };

  return (
    <Card className="border-border/70 shadow-xl shadow-black/5">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogIn className="size-6" />
        </div>

        <CardTitle className="text-2xl">Welcome back</CardTitle>

        <CardDescription>Log in to continue using File Central</CardDescription>
      </CardHeader>

      <CardContent>
        <form id="login-form" className="space-y-5" onSubmit={handleSubmit}>
          {login.isError && !login.isPending && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {describeLoginError(login.error)}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="login-username">Username</Label>

            <Input
              id="login-username"
              name="username"
              type="text"
              placeholder="username123"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="login-password">Password</Label>

              <button type="button" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </div>

            <PasswordInput
              id="login-password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              name="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
            />

            <Label htmlFor="remember" className="cursor-pointer font-normal text-muted-foreground">
              Remember me
            </Label>
          </div>
        </form>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />

          <span className="text-xs uppercase text-muted-foreground">Or</span>

          <Separator className="flex-1" />
        </div>

        <Button type="button" variant="outline" className="w-full">
          <span className="mr-2 font-semibold">G</span>
          Continue with Google
        </Button>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button form="login-form" type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Logging in
            </>
          ) : (
            "Log in"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/auth/register" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default LoginPage;
