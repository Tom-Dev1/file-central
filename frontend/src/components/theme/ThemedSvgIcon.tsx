import type { CSSProperties } from "react";
import { clsx as cn } from "clsx";

import classes from "./ThemedSvgIcon.module.css";

interface ThemedSvgIconProps {
  src: string;
  className?: string;
  size?: number | string;
}

export function ThemedSvgIcon({ src, className, size = 24 }: ThemedSvgIconProps) {
  const iconSize = typeof size === "number" ? `${size}px` : size;

  const style: CSSProperties = {
    width: iconSize,
    height: iconSize,
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
  };

  return <span aria-hidden="true" className={cn(classes.icon, className)} style={style} />;
}
