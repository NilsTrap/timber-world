import { Skeleton } from "@timber/ui";

export default function ProductionLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
