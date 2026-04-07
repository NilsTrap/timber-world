import { Skeleton } from "@timber/ui";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
