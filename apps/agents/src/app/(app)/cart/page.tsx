import { getCart } from "./actions";
import { CartView } from "@/components/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const result = await getCart();
  const order = result.success ? result.data : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cart</h1>
      <CartView order={order} />
    </div>
  );
}
