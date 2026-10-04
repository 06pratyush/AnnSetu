import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-role text-on-role hover:bg-role-hover",
        secondary: "border border-border-strong bg-surface text-ink hover:bg-sunken",
        outline: "border border-role bg-transparent text-role hover:bg-role-soft",
        ghost: "bg-transparent text-ink hover:bg-sunken",
        accent: "bg-haldi text-on-haldi hover:bg-haldi-hover",
        destructive: "bg-danger text-on-danger hover:bg-danger-hover",
        link: "h-auto px-0 text-role underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-10 px-3 text-small [&_svg]:size-4",
        md: "h-12 px-4 text-body [&_svg]:size-5",
        lg: "h-14 px-6 text-body-lg [&_svg]:size-6",
        icon: "size-12 [&_svg]:size-5",
        "icon-sm": "size-10 [&_svg]:size-4",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

/**
 * Every action button carries a visible text label; icon-only buttons need an aria-label.
 * Primary takes the role color: khet green in the farmer area, neel indigo in the buyer area.
 */
export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
