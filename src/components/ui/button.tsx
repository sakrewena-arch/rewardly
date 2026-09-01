import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden select-none touch-manipulation hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[#111111] text-white hover:bg-[#111111]/90 dark:bg-white dark:text-[#111111] dark:hover:bg-white/90 shadow-sm hover:shadow-md",
        destructive: "bg-red-500 text-white hover:bg-red-500/90 shadow-sm hover:shadow-md",
        outline: "border border-gray-200 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
        secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700",
        ghost: "hover:bg-gray-100 dark:hover:bg-gray-800",
        link: "text-purple-600 underline-offset-4 hover:underline",
        purple: "bg-purple-600 text-white hover:bg-purple-600/90 shadow-sm hover:shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10 rounded-full",
        "icon-lg": "h-12 w-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Affiche un spinner + texte "Chargement…" et désactive le bouton */
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingText, children, disabled, onClick, ...props }, ref) => {
    // Feedback tactile (ondulation) : crée une ripple au clic.
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const ripple = document.createElement("span");
      ripple.className =
        "ripple-effect pointer-events-none absolute rounded-full bg-white/30 dark:bg-white/40";
      ripple.style.width = ripple.style.height = `${diameter}px`;
      ripple.style.left = `${e.clientX - rect.left - diameter / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - diameter / 2}px`;
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      onClick?.(e);
    };

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span
            className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {loading ? (loadingText || "Chargement…") : children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };