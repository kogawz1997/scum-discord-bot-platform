import React from "react";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const Badge = React.forwardRef(function Badge({ className = "", ...props }, ref) {
  return (
    <span
      ref={ref}
      className={joinClassNames(
        "inline-flex items-center rounded-md border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-white",
        className
      )}
      {...props}
    />
  );
});
