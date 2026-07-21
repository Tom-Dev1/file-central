import { Link, Outlet } from "react-router-dom";
import { CheckCircle2, Cloud, FileLock2, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: FileLock2,
    title: "Lưu trữ an toàn",
    description: "Quản lý tập tin và thư mục tập trung.",
  },
  {
    icon: ShieldCheck,
    title: "Kiểm soát truy cập",
    description: "Bảo vệ dữ liệu và quyền truy cập người dùng.",
  },
  {
    icon: Cloud,
    title: "Truy cập mọi nơi",
    description: "Làm việc với dữ liệu trên nhiều thiết bị.",
  },
];

function AuthLayout() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* Left panel */}
      <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-violet-600/20" />

        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 font-semibold">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-950">
              <Cloud className="size-5" />
            </span>

            <span className="text-xl">File Central</span>
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-lg">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-blue-300">
            Quản lý dữ liệu tập trung
          </p>

          <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
            Không gian an toàn dành cho dữ liệu của bạn
          </h1>

          <p className="mt-5 text-base leading-7 text-slate-300">
            Lưu trữ, quản lý và chia sẻ tập tin trong một hệ thống đơn giản, hiện đại và bảo mật.
          </p>

          <div className="mt-10 space-y-6">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <Icon className="size-5 text-blue-300" />
                  </div>

                  <div>
                    <h2 className="font-medium text-white">{feature.title}</h2>

                    <p className="mt-1 text-sm leading-6 text-slate-400">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-sm text-slate-400">
          <CheckCircle2 className="size-4 text-emerald-400" />
          Dữ liệu của bạn luôn được bảo vệ
        </div>
      </section>

      {/* Right panel */}
      <section className="relative flex min-h-svh items-center justify-center px-5 py-10 sm:px-8">
        <Link to="/" className="absolute left-5 top-5 flex items-center gap-2 font-semibold lg:hidden">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cloud className="size-5" />
          </span>
          File Central
        </Link>

        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
