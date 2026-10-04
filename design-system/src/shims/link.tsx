// next/link outside Next.js: a plain anchor (previews never navigate).
import * as React from "react";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string }; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = React.forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, onClick, ...rest }, ref) {
  void _p;
  void _r;
  void _s;
  const url = typeof href === "string" ? href : (href.pathname ?? "#");
  return (
    <a
      ref={ref}
      href={url}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
      {...rest}
    />
  );
});

export default Link;
