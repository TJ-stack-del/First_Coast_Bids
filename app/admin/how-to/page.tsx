import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHowToContent, HOW_TO_SECTIONS } from "@/components/ui/AdminHowToContent";

export const metadata = { title: "How to | First Coast Bids" };

// The admin how-to, full page. The same content opens from the "?" drawer on
// every admin page (AdminGuide.tsx); both render AdminHowToContent, the one
// copy to edit. Replaces Admin-Review-Rubric.md.
export default async function AdminHowToPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("team_members").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!member) redirect("/");

  return (
    <div className="mt-6 max-w-3xl">
      <h1 className="text-headline-lg text-primary mb-1">How to</h1>
      <p className="text-body-md text-on-surface-variant">
        The whole job, in the order you meet it. The same guide opens from the <span className="font-bold">?</span> at the top of
        any admin page, so you can read it beside the bid you&apos;re working.
      </p>
      <nav aria-label="Contents" className="mt-4">
        <ul className="flex flex-col gap-1 text-body-md">
          {HOW_TO_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary font-bold underline">{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl px-6 py-2">
        <AdminHowToContent expandAll />
      </div>
    </div>
  );
}
