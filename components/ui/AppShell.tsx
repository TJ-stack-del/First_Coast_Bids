"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { AdminGuide } from "./AdminGuide";
import { broadcastSignedIn } from "@/lib/auth-broadcast";

// Extracted from the <header> and mobile <nav> markup that repeats
// near-identically across all 43 mockups/*/code.html files.
//
// Now mounted once per section, from app/dashboard/layout.tsx and
// app/admin/layout.tsx, rather than individually by every page -- when
// every page rendered its own AppShell instance, React had to unmount
// and remount the whole header/sidebar/nav on every navigation within
// the same section (see globals.css's .animate-fade-in comment, which
// existed specifically to soften that remount's visible flash). A real
// Next.js layout persists across navigations in the same segment
// instead, so the shell no longer disappears and reappears at all.
// Active-link highlighting used to come from a per-page `activePath`
// prop for this reason -- a shared layout doesn't know which page
// rendered it, so this now reads the real current path directly via
// usePathname() instead.
//
// Nav links are role-based since First Coast Bids split admin (your team,
// works every client's submissions) from client (a contractor, sees only
// their own) — see MIGRATION-TO-BIDPULSE.md. The header's notifications/
// settings icons were dropped for now since those pages don't exist yet
// (nothing built them since the pivot) — add them back once they are.

type Role = "admin" | "client";

// mobileLabel overrides `label` only on the bottom-bar nav (below) -- the
// mobile label has no truncate/nowrap and a two-word label like
// "Compliance Vault" was a real two-line-wrap risk on narrow phones that
// its single-word siblings don't share, breaking the row's alignment.
const NAV_LINKS: Record<Role, { href: string; label: string; mobileLabel?: string; icon: string }[]> = {
  admin: [
    { href: "/admin/inbox", label: "Inbox", icon: "inbox" },
    { href: "/admin/matches", label: "Matches", icon: "insights" },
    { href: "/admin/messages", label: "Messages", icon: "mail" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/how-to", label: "How to", icon: "help" },
  ],
  client: [
    { href: "/dashboard", label: "Your bids", icon: "dashboard" },
    // "New Bid" (-> /intake) was dropped per explicit user direction: the
    // Dashboard itself already has two entry points into /intake (a
    // "Start a new bid" CTA card, and a "Start your first bid" button in
    // the zero-submissions empty state) -- a persistent nav tab for a
    // one-off action, sitting next to three destinations you navigate to
    // and stay on, was both a real duplicate entry point and a visual
    // register mismatch (its icon, add_circle, was the only "verb" icon
    // among three "noun" icons). Two independent reviews confirmed
    // removing it outright, not replacing it with a lighter treatment.
    { href: "/dashboard/profile", label: "Company profile", mobileLabel: "Profile", icon: "badge" },
    { href: "/dashboard/compliance", label: "Compliance vault", mobileLabel: "Compliance", icon: "shield" },
  ],
};

const SIDEBAR_LABEL: Record<Role, string> = {
  admin: "Operational Modules",
  // Was "Your Account" -- a mismatch once this list is mostly product
  // sections (Dashboard, Compliance Vault) rather than account settings.
  client: "Menu",
};

// Where the logo should take a signed-in user of each role -- their own
// section's real home, not the marketing site. "/" would technically also
// get them there (app/page.tsx's root routing bounces a signed-in user
// straight to one of these two), but linking directly avoids that extra
// redirect hop and matches what clicking a logo means inside a logged-in
// app: take me home, not out to the public site.
const HOME_PATH: Record<Role, string> = {
  admin: "/admin/inbox",
  client: "/dashboard",
};

// Defensive display-only cleanup, not a data fix: a stored full_name of
// "Michaal_Coleman" (a real typo'd value, not code) rendered here with
// this header's own `uppercase` class as the literal "MICHAAL_COLEMAN" --
// underscores should never appear in a human display name regardless of
// whose name it is, so they're normalized to spaces here. This does NOT
// fix the actual spelling typo, which lives in team_members.full_name
// itself and needs a real UPDATE to that row, not a code change.
function formatViewerName(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function AppShell({
  role,
  viewerName,
  children,
}: {
  role: Role;
  // The signed-in admin's full name (team_members.full_name) or the
  // signed-in client's business name (clients.company_name) — whichever
  // record the caller already fetched to know `role` in the first place.
  viewerName: string;
  children: React.ReactNode;
}) {
  const links = NAV_LINKS[role];
  const pathname = usePathname();
  // Longest matching href wins so a detail/sub-route (e.g. /dashboard/profile,
  // or an admin inbox item at /admin/inbox/<id>) doesn't also light up a
  // shorter sibling link (e.g. /dashboard) that happens to be a path prefix.
  const activeHref = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // AppShell only ever renders for a signed-in user (see
  // app/dashboard/layout.tsx / app/admin/layout.tsx), so mounting it is
  // itself the real "you are now signed in" signal -- announce it once so
  // any other tab of this site left sitting on a "check your email"
  // screen (see lib/auth-broadcast.ts) can jump straight into the app
  // instead of sitting on a dead end.
  useEffect(() => {
    broadcastSignedIn();
  }, []);

  // The client area (inside .theme-press, see app/dashboard/layout.tsx)
  // gets the public site's slim top bar instead of the admin's sidebar:
  // three text links on desktop, a bottom tab bar on phones. Admin below
  // is unchanged.
  if (role === "client") {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <header className="fixed top-0 w-full z-40 bg-surface/95 backdrop-blur border-b border-outline-variant">
          <div className="max-w-container mx-auto flex items-center justify-between gap-4 md:gap-6 px-margin-mobile md:px-margin-desktop py-2">
            <Link
              href={HOME_PATH.client}
              className="shrink-0 flex items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Logo priority />
            </Link>
            <nav aria-label="Main" className="hidden md:flex items-center gap-4 flex-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={activeHref === link.href ? "page" : undefined}
                  className={`text-label-md py-3 px-2 underline-offset-8 decoration-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    activeHref === link.href
                      ? "text-primary underline font-bold"
                      : "text-on-surface-variant hover:text-on-surface hover:underline"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-label-md text-on-surface-variant whitespace-nowrap truncate max-w-[45vw] md:max-w-[12rem] lg:max-w-[18rem]">
                {formatViewerName(viewerName)}
              </p>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="animate-fade-in flex-grow pt-[80px] pb-[88px] md:pb-10 px-margin-mobile md:px-margin-desktop w-full">
          <div className="max-w-container mx-auto w-full flex flex-col gap-10">{children}</div>
        </main>

        <nav
          aria-label="Main"
          className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-stretch bg-surface border-t border-outline-variant"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? "page" : undefined}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center border-t-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                activeHref === link.href ? "text-primary font-bold border-primary" : "text-on-surface-variant border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                {link.icon}
              </span>
              <span className="text-label-sm">{link.mobileLabel ?? link.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="fixed top-0 w-full z-40 bg-surface/95 backdrop-blur border-b border-outline-variant">
        {/* Full-bleed header (nav lives in the sidebar below, for both
            roles) so the logo sits flush left above the sidebar, matching
            the Stitch screens' header+sidebar shell. */}
        <div className="flex items-center justify-between px-margin-mobile md:px-margin-desktop py-3">
          <Link
            href={HOME_PATH[role]}
            className="shrink-0 flex items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Logo priority />
          </Link>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-label-md uppercase tracking-wider text-on-surface-variant whitespace-nowrap">
              {formatViewerName(viewerName)} · {role === "admin" ? "Admin" : "Client view"}
            </p>
            {role === "admin" && <AdminGuide />}
            <div className="flex items-center gap-1">
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <aside className="hidden md:flex flex-col fixed left-0 top-[65px] bottom-0 w-56 bg-surface-container-low border-r border-outline-variant py-4 z-30">
        <div className="px-4 pb-2">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{SIDEBAR_LABEL[role]}</span>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-label-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                activeHref === link.href
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="animate-fade-in flex-grow pt-[72px] pb-[80px] md:pb-8 px-margin-mobile md:px-margin-desktop w-full flex flex-col gap-6 md:pl-56">
        <div className="max-w-container mx-auto w-full flex flex-col gap-6">{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-margin-mobile py-2 bg-surface border-t border-outline-variant">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center transition-opacity active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-xl ${
              activeHref === link.href
                ? "text-primary font-bold bg-surface-container-highest rounded-xl px-3 py-1"
                : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined">{link.icon}</span>
            <span className="text-label-md-mobile uppercase tracking-wider mt-1">{link.mobileLabel ?? link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
