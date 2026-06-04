import { BetaGuideContent, type BetaGuideView } from "@/components/beta/beta-guide-content";

type BetaGuidePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | undefined): BetaGuideView {
  return value === "mobile" ? "mobile" : "pc";
}

export default async function BetaGuidePage({ searchParams }: BetaGuidePageProps) {
  const params = await searchParams;
  const view = parseView(firstParam(params.view));
  return <BetaGuideContent view={view} basePath="/beta-guide" />;
}
