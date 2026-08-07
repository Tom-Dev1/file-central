import {
  ArrowLeft,
  Cloud,
  File,
  FileArchive,
  FileImage,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Home,
  Search,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Tag, Typography } from "antd";

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.15),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.1),transparent_35%)]"
      />

      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 font-semibold">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Cloud className="size-5" />
          </span>

          <span className="text-lg">File Central</span>
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-14 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        <div className="order-2 text-center lg:order-1 lg:text-left">
          <Tag icon={<FileQuestion className="size-4" />} className="!mb-6 !rounded-full !px-3 !py-1">File location unavailable</Tag>

          <Typography.Text className="!text-sm !font-semibold !uppercase !tracking-[0.3em] !text-primary">Error 404</Typography.Text>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            This file seems to be <span className="text-primary">missing</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
            The page, file, or folder you requested may have been moved, renamed, deleted, or is no longer shared with
            your account.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Button type="primary" size="large" icon={<Home className="size-4" />} onClick={() => navigate("/")}>Return home</Button>

            <Button size="large" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>Go back</Button>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground lg:justify-start">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-primary" />
              Check the file name
            </div>

            <div className="flex items-center gap-2">
              <FolderSearch className="size-4 text-primary" />
              Check the folder location
            </div>
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
          <FileNotFoundIllustration />
        </div>
      </section>
    </main>
  );
}

function FileNotFoundIllustration() {
  return (
    <div aria-hidden="true" className="relative flex aspect-square w-full max-w-lg items-center justify-center">
      <div className="absolute inset-[10%] rounded-full border border-dashed border-primary/20 file-central-spin-slow" />

      <div className="absolute inset-[20%] rounded-full bg-primary/10 blur-2xl file-central-pulse" />

      <FloatingFile className="file-central-float-one left-[5%] top-[18%]" icon={FileText} label="DOC" />

      <FloatingFile className="file-central-float-two right-[4%] top-[20%]" icon={FileImage} label="IMG" />

      <FloatingFile className="file-central-float-three bottom-[12%] left-[12%]" icon={FileSpreadsheet} label="XLS" />

      <FloatingFile className="file-central-float-four bottom-[10%] right-[13%]" icon={FileArchive} label="ZIP" />

      <div className="relative z-10 flex size-64 items-center justify-center rounded-[2.5rem] border bg-background/80 shadow-2xl shadow-primary/15 backdrop-blur sm:size-72">
        <div className="absolute -top-4 left-10 h-8 w-24 rounded-t-2xl border border-b-0 bg-background" />

        <div className="flex flex-col items-center">
          <div className="relative flex size-28 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <FolderSearch className="size-14" />

            <span className="absolute -right-3 -top-3 flex size-10 items-center justify-center rounded-full border-4 border-background bg-destructive text-sm font-bold text-destructive-foreground">
              ?
            </span>
          </div>

          <p className="mt-6 text-lg font-semibold">File not found</p>

          <p className="mt-2 max-w-44 text-center text-sm leading-6 text-muted-foreground">
            We searched every folder, but this file is no longer here.
          </p>
        </div>
      </div>

      <div className="absolute left-[21%] top-[9%] size-2 rounded-full bg-primary/40 file-central-pulse" />
      <div className="absolute bottom-[23%] right-[3%] size-3 rounded-full bg-primary/30 file-central-pulse-delayed" />
      <div className="absolute right-[19%] top-[4%] size-1.5 rounded-full bg-primary/50 file-central-pulse-delayed" />
    </div>
  );
}

interface FloatingFileProps {
  className: string;
  icon: typeof File;
  label: string;
}

function FloatingFile({ className, icon: Icon, label }: FloatingFileProps) {
  return (
    <div
      className={`absolute z-20 flex w-20 flex-col items-center rounded-2xl border bg-background/90 p-3 shadow-lg backdrop-blur ${className}`}
    >
      <Icon className="size-7 text-primary" />

      <span className="mt-2 text-[10px] font-semibold tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export default NotFoundPage;
