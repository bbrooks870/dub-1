import { PlanProps } from "#/lib/types";
import { Badge } from "@dub/ui";

export default function PlanBadge({ plan }: { plan: PlanProps }) {
  return (
    <Badge
      variant={
        plan === "enterprise" ? "violet" : plan === "pro" ? "blue" : "black"
      }
    >
      {plan}
    </Badge>
  );
}
