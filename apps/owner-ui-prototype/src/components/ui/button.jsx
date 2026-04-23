import React from "react";

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

const VARIANTS = {
  default: "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/20",
  primary: "bg-cyan-400 text-black font-semibold hover:bg-cyan-300",
  danger: "bg-red-600 text-white hover:bg-red-500",
  outline: "border border-white/15 bg-transparent text-white hover:bg-white/[0.06]",
  ghost: "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white",
};

export const Button = React.forwardRef(function Button(
  { className = "", type = "button", variant = "default", primary = false, ...props },
  ref
) {
  const resolvedVariant = primary ? "primary" : variant;
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "owner-button inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[resolvedVariant] || VARIANTS.default,
        className
      )}
      {...props}
    />
  );
});
