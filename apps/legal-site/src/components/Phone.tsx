import type { CSSProperties } from "react";
import type { Screen } from "../site";

const WIDTHS = [360, 560, 820];

type Props = {
  screen: Screen;
  alt: string;
  /** How wide the phone is drawn, for the browser to pick the right file. */
  sizes?: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** A real app screenshot in a phone frame, served at the size it is shown so it stays sharp. */
export function Phone({ screen, alt, sizes = "(max-width: 860px) 70vw, 320px", eager, className, style }: Props) {
  const srcSet = WIDTHS.map((width) => `/screens/sized/${screen}-${width}.webp ${width}w`).join(", ");
  return (
    <div className={`phone ${className ?? ""}`} style={style} aria-hidden={alt ? undefined : true}>
      <img
        src={`/screens/sized/${screen}-560.webp`}
        srcSet={srcSet}
        sizes={sizes}
        width={1206}
        height={2622}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
