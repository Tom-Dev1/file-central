import {
  ArrowRight,
  Check,
  Cloud,
  Download,
  FileLock2,
  FolderOpen,
  HardDrive,
  Link2,
  Share2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { BorderBeam } from "@/components/ui/border-beam";

const features = [
  {
    icon: Upload,
    title: "Fast Uploads",
    description: "Upload files to the system and manage all your data in one centralized workspace.",
  },
  {
    icon: FolderOpen,
    title: "Folder Management",
    description: "Create folders, organize files, and build a storage structure that fits your workflow.",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description: "Share files or folders with others through their accounts or shareable links.",
  },
  {
    icon: FileLock2,
    title: "Access Control",
    description: "Manage view, edit, and download permissions for each shared resource.",
  },
  {
    icon: Download,
    title: "Convenient Downloads",
    description: "Access and download your data easily across multiple devices.",
  },
  {
    icon: ShieldCheck,
    title: "Data Protection",
    description: "Keep your data secure with clear access control and reliable protection.",
  },
];

const benefits = [
  "Centralized file and folder management",
  "File sharing through secure links",
  "Clear user access permissions",
  "Access your data across multiple devices",
];

function HomePage() {
  return (
    <>
      <BackgroundBeamsWithCollision className="h-full">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_35%)]" />

          <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div>
              <Badge variant="secondary" className="mb-6 rounded-full px-4 py-2">
                <Cloud className="mr-2 size-4" />
                Modern cloud storage
              </Badge>

              <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Manage all your files <span className="text-primary">in one place</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                File Central helps you store, organize, and share files simply, securely, and conveniently across every
                device.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/auth/register">
                    Get started for free
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>

                <Button size="lg" variant="outline" asChild>
                  <Link to="/auth/login">Sign in</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  Quick sign-up
                </div>

                <div className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  No installation required
                </div>

                <div className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  Access anywhere
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl" />

              <Card className="overflow-hidden border-border/70 shadow-2xl shadow-primary/10">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">My files</CardTitle>

                      <CardDescription>Recently managed data</CardDescription>
                    </div>

                    <Button size="sm">
                      <Upload className="mr-2 size-4" />
                      Upload
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    <StorageSummary icon={HardDrive} label="Used" value="4.8 GB" />

                    <StorageSummary icon={FolderOpen} label="Folders" value="24" />

                    <StorageSummary icon={Link2} label="Shared" value="12" />
                  </div>

                  <div className="mt-6 space-y-3">
                    <FileItem name="Project documents" type="Folder" icon={FolderOpen} />

                    <FileItem name="July report.pdf" type="PDF · 3.2 MB" icon={FileLock2} />

                    <FileItem name="Product design.fig" type="FIG · 18.5 MB" icon={Cloud} />

                    <FileItem name="Staff list.xlsx" type="XLSX · 1.8 MB" icon={Users} />
                  </div>
                </CardContent>
                <BorderBeam duration={8} size={100} />
              </Card>
            </div>
          </div>
        </section>
      </BackgroundBeamsWithCollision>
      <section id="features" className="border-y bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">Features</Badge>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Every tool you need to manage your data
            </h2>

            <p className="mt-4 leading-7 text-muted-foreground">
              File Central provides core features that make storing and sharing data effortless.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card
                  key={feature.title}
                  className="border-border/70 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <CardHeader>
                    <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>

                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="security" className="py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border bg-muted/30 p-6 sm:p-10">
            <div className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-full border bg-background shadow-sm">
              <div className="flex size-40 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-20" />
              </div>
            </div>
          </div>

          <div>
            <Badge variant="outline">Safe and secure</Badge>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Your data always stays under your control
            </h2>

            <p className="mt-5 leading-7 text-muted-foreground">
              Manage resources, collaborators, and access permissions in one unified system.
            </p>

            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-4" />
                  </span>

                  <span className="text-sm font-medium">{benefit}</span>
                </div>
              ))}
            </div>

            <Button className="mt-8" asChild>
              <Link to="/auth/register">
                Create an account
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-10 lg:flex-row lg:text-left">
          <div>
            <h2 className="text-3xl font-bold">Ready to manage your data better?</h2>

            <p className="mt-3 text-primary-foreground/80">
              Create an account and start building your own storage workspace.
            </p>
          </div>

          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth/register">
              Get started now
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

interface StorageSummaryProps {
  icon: typeof HardDrive;
  label: string;
  value: string;
}

function StorageSummary({ icon: Icon, label, value }: StorageSummaryProps) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <Icon className="size-4 text-primary" />

      <p className="mt-3 text-lg font-semibold">{value}</p>

      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface FileItemProps {
  name: string;
  type: string;
  icon: typeof FolderOpen;
}

function FileItem({ name, type, icon: Icon }: FileItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>

        <p className="text-xs text-muted-foreground">{type}</p>
      </div>
    </div>
  );
}

export default HomePage;
