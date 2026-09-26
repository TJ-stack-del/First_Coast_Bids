import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/Toast";
import { AppShell } from "@/components/ui/AppShell";
import { pressThemeClass } from "@/app/press-theme";

// Mounts AppShell once for the whole /dashboard section instead of each
// page doing it individually -- see AppShell.tsx's own comment for why
// that used to cause a full header/sidebar remount (and visible flash) on
// every navigation between dashboard pages. This only fetches the sliver
// of the client row AppShell actually needs (company_name); each page
// still does its own full fetch for the data it renders.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("company_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) redirect("/");

  // The client area uses the same look as the public site and the sign-up
  // path (DESIGN.md, "Marketing theme"), so signing up doesn't land a
  // client in what feels like a different product.
  return (
    <div className={pressThemeClass}>
      <ToastProvider>
        <AppShell role="client" viewerName={client.company_name}>
          {children}
        </AppShell>
      </ToastProvider>
    </div>
  );
}
