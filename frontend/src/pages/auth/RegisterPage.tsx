import { useState, type SubmitEventHandler } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useRegister } from "@/hooks";

function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "").trim();

    const username = String(formData.get("username") ?? "").trim();

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();

    const password = String(formData.get("password") ?? "");

    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (name.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (username.length < 3) {
      setError("Username must contain at least 3 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setError("Username can only contain letters, numbers, dots, underscores, and hyphens.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    const registerData = {
      name,
      username,
      email,
      password,
    };

    register.mutate(registerData, {
      onSuccess: () => {
        navigate("/auth/login", {
          replace: true,
        });
      },
      onError: (mutationError) => {
        setError(
          mutationError instanceof Error ? mutationError.message : "Unable to create your account. Please try again."
        );
      },
    });
  };

  return (
    <Card className="border-border/70 shadow-xl shadow-black/5">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserPlus className="size-6" />
        </div>

        <CardTitle className="text-2xl">Create an account</CardTitle>

        <CardDescription>Sign up to start managing your files and folders</CardDescription>
      </CardHeader>

      <CardContent>
        <form id="register-form" className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="register-name">Name</Label>

            <Input
              id="register-name"
              name="name"
              type="text"
              placeholder="Whale"
              autoComplete="name"
              disabled={register.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-username">Username</Label>

            <Input
              id="register-username"
              name="username"
              type="text"
              placeholder="john.doe"
              autoComplete="username"
              minLength={3}
              disabled={register.isPending}
              required
            />

            <p className="text-xs text-muted-foreground">Use letters, numbers, dots, underscores, or hyphens.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>

            <Input
              id="register-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={register.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>

            <PasswordInput
              id="register-password"
              name="password"
              placeholder="Enter at least 8 characters"
              autoComplete="new-password"
              minLength={8}
              disabled={register.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-confirm-password">Confirm password</Label>

            <PasswordInput
              id="register-confirm-password"
              name="confirmPassword"
              placeholder="Enter your password again"
              autoComplete="new-password"
              minLength={8}
              disabled={register.isPending}
              required
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              disabled={register.isPending}
              onCheckedChange={(checked) => {
                setAcceptedTerms(checked === true);
              }}
            />

            <Label htmlFor="terms" className="cursor-pointer text-sm font-normal leading-5 text-muted-foreground">
              I agree to the{" "}
              <button type="button" className="font-medium text-primary hover:underline">
                Terms of Service
              </button>{" "}
              and{" "}
              <button type="button" className="font-medium text-primary hover:underline">
                Privacy Policy
              </button>
              .
            </Label>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button form="register-form" type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default RegisterPage;
