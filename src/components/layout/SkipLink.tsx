import { cn } from "@/lib/utils";

interface SkipLinkProps {
  href?: string;
  children?: React.ReactNode;
}

/**
 * Skip link component for keyboard accessibility.
 * Allows keyboard users to skip directly to main content.
 * Visually hidden until focused.
 */
export function SkipLink({
  href = "#main-content",
  children = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "fixed left-4 top-4 z-[100] px-4 py-2 rounded-md",
        "bg-forest-green text-white font-medium",
        "transition-transform duration-200",
        // Visually hidden until focused
        "-translate-y-16 opacity-0",
        "focus:translate-y-0 focus:opacity-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest-green"
      )}
    >
      {children}
    </a>
  );
}
