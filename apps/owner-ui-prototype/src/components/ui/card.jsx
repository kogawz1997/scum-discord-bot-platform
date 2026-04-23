import React from "react";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const Card = React.forwardRef(function Card({ className = "", ...props }, ref) {
  return (
    <section
      ref={ref}
      className={joinClassNames("owner-card rounded-xl border text-white", className)}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef(function CardHeader({ className = "", ...props }, ref) {
  return <div ref={ref} className={joinClassNames("space-y-1.5 p-6", className)} {...props} />;
});

export const CardTitle = React.forwardRef(function CardTitle({ className = "", ...props }, ref) {
  return <h3 ref={ref} className={joinClassNames("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
});

export const CardDescription = React.forwardRef(function CardDescription({ className = "", ...props }, ref) {
  return <p ref={ref} className={joinClassNames("text-sm text-zinc-400", className)} {...props} />;
});

export const CardContent = React.forwardRef(function CardContent({ className = "", ...props }, ref) {
  return <div ref={ref} className={joinClassNames("p-6 pt-0", className)} {...props} />;
});
