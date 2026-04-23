import React from "react";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const Input = React.forwardRef(function Input({ className = "", type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={joinClassNames(
        "owner-input flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
