import { cn } from "@/lib/utils";

interface ThemedSvgIconProps {
  src: string;
  className?: string;
}

export function ThemedSvgIcon({ src, className }: ThemedSvgIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-muted-foreground", className)}
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
