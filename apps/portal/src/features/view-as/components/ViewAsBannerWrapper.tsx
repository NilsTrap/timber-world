import { getViewAsContext } from "../actions/viewAs";
import { createClient } from "@/lib/supabase/server";
import { ViewAsBanner } from "./ViewAsBanner";

/**
 * Server component wrapper that fetches view-as context and renders banner
 */
export async function ViewAsBannerWrapper() {
  const context = await getViewAsContext();

  if (!context.isViewingAs) {
    return null;
  }

  const supabase = await createClient();

  let organizationName: string | undefined;
  let userName: string | undefined;

  // Fetch organization name if viewing as org
  if (context.organizationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from("organisations")
      .select("name")
      .eq("id", context.organizationId)
      .single();
    organizationName = org?.name;
  }

  // Fetch user name if viewing as user
  if (context.userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user } = await (supabase as any)
      .from("portal_users")
      .select("name")
      .eq("id", context.userId)
      .single();
    userName = user?.name;
  }

  return (
    <ViewAsBanner
      organizationName={organizationName}
      userName={userName}
      isReadOnly={context.isReadOnly}
    />
  );
}
