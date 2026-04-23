import React from "react";

export function DataEmptyState({ title = "No backend records", body = "The endpoint is live, but it returned no rows for this section." }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1">{body}</div>
    </div>
  );
}
