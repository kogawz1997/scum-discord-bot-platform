import React from "react";
import { LayoutDashboard } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { DataEmptyState } from "../components/ui/data-empty-state";

export function SupportContextPage({ data, source, live, recordId, onRun, errors }) {
  return (
    <PageLayout title="Support Context" icon={LayoutDashboard}>
      <DataEmptyState title="Page under construction" body="This page is being refactored." />
    </PageLayout>
  );
}
