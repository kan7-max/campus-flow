import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="animate-fade-in-up">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="mt-2 text-2xl font-semibold">{value}</CardTitle>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
