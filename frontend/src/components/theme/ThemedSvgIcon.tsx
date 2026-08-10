import { clsx as cn } from "clsx";
import classes from "./ThemedSvgIcon.module.css";


interface ThemedSvgIconProps {
  src: string;
  className?: string;
}

export function ThemedSvgIcon({ src, className }: ThemedSvgIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(classes.span, className)}
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
