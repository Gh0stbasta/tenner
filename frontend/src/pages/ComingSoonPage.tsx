import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

/** Placeholder for pages that later tickets implement (e.g. analytics, settings). */
export function ComingSoonPage({ title }: { readonly title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={<ConstructionOutlinedIcon aria-hidden />}
        title="Demnächst verfügbar"
        description="Diese Seite wird gerade gebaut."
      />
    </>
  );
}
