import React from "react";

export function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
      <div className="text-zinc-400">{message}</div>
    </div>
  );
}
