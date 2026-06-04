import Link from "next/link";
import { ArrowLeft, LayoutDashboard, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ResourceNotFoundProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ResourceNotFound({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref = "/dashboard",
  secondaryLabel = "ダッシュボードへ"
}: ResourceNotFoundProps) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center py-10">
      <Card className="w-full space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
          <SearchX className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={primaryHref}>
            <Button>
              <ArrowLeft className="h-4 w-4" />
              {primaryLabel}
            </Button>
          </Link>
          <Link href={secondaryHref}>
            <Button variant="outline">
              <LayoutDashboard className="h-4 w-4" />
              {secondaryLabel}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
