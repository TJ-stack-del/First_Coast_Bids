"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { TAGLINE } from "@/lib/brand";

// Shared header/footer for the public marketing site — separate from
// AppShell, which is for the authenticated app and branches nav by role.
// Nobody needs a role here; every visitor sees the same nav, plus
// Log in / Start a pilot bid (the site's one main action while the free
// Pilot cohort is open). Visual system matches the new First Coast Bids mockups.
//
// Now mounted once for the whole site via app/(marketing)/layout.tsx
// rather than individually by every page -- when every page rendered its
// own MarketingShell instance, React had to unmount and remount the whole
// header/footer on every navigation between marketing pages. (The page
// fade that once softened that remount was removed on 2026-09-23: the
// marketing theme has no entrance animations.) Active-link highlighting used to
// come from a per-page `activePath` prop for this reason -- a shared
// layout doesn't know which page rendered it, so this now reads the real
// current path directly via usePathname() instead.

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/quiz", label: "Fit-Score Quiz" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activePath = usePathname();

  // The mobile dropdown below used to sit in the header's normal document
  // flow, so opening it grew the (sticky) header's height in place. That's
  // invisible when scrolled to the very top, but scroll partway down the
  // page first and the sticky header is already pinned mid-document -- its
  // sudden height increase then overlaps whatever content was sitting
  // right below it, instead of the menu presenting cleanly. Locking body
  // scroll while the menu is open is the other half of the same fix: an
  // absolutely-positioned overlay still leaves the page scrollable behind
  // it otherwise, which reintroduces the same "content peeking through"
  // problem the position change was meant to solve.
  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant relative">
        <div className="flex items-center justify-between w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex flex-col justify-center">
            <Logo priority />
          </Link>
          {/* Full nav from lg (1024px) up; below that, the menu button. At md
              (768-1023px) five links plus Log in and the Pilot button didn't
              fit: the wordmark and several links wrapped to two lines. */}
          <nav className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-label-md uppercase tracking-wider px-1 py-1 transition ${
                  activePath === link.href
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/login"
              className="text-label-md uppercase tracking-wider text-on-surface-variant hover:text-primary transition"
            >
              Log in
            </Link>
            <Link
              href="/intake?package=pilot"
              className="whitespace-nowrap px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md uppercase tracking-wider font-bold hover:opacity-90 transition active:scale-[0.97]"
            >
              Start a pilot bid
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="lg:hidden p-2 -mr-2 text-on-surface"
          >
            <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>

        {menuOpen && (
          <nav className="lg:hidden absolute top-full inset-x-0 z-40 border-t border-outline-variant bg-surface px-margin-mobile py-4 flex flex-col gap-2 max-h-[calc(100vh-4.5rem)] overflow-y-auto shadow-lg">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-3 border rounded text-label-md text-center transition active:scale-[0.97] ${
                  activePath === link.href
                    ? "border-primary text-primary font-bold"
                    : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-outline-variant mt-2 pt-4 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 border border-outline-variant text-on-surface-variant rounded text-label-md text-center hover:bg-surface-container-low transition active:scale-[0.97]"
              >
                Log in
              </Link>
              <Link
                href="/intake?package=pilot"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 bg-primary-container text-on-primary-container rounded text-label-md text-center active:scale-[0.97]"
              >
                Start a pilot bid
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-grow w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-section-gap flex flex-col gap-section-gap">
        {children}
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <div className="w-full px-margin-mobile md:px-margin-desktop py-gutter max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          {/* Stacked (centred) on phones: side by side, the tagline ran over
              the wordmark at 390px. */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <Logo />
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant">{TAGLINE}</span>
              <span className="text-body-sm text-on-surface-variant">© {new Date().getFullYear()} First Coast Bids</span>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-sm text-on-surface-variant hover:text-primary transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-outline-variant px-margin-mobile md:px-margin-desktop py-3 max-w-container-max mx-auto flex flex-col items-center gap-2">
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="text-label-sm text-on-surface-variant hover:text-primary transition">
              Privacy
            </Link>
            <Link href="/terms" className="text-label-sm text-on-surface-variant hover:text-primary transition">
              Terms
            </Link>
          </nav>
          <p className="text-label-sm text-on-surface-variant text-center">
            First Coast Bids helps you prepare a strong, compliant bid, but we can't guarantee you'll win. That decision is up to the agency.
          </p>
        </div>
      </footer>
    </div>
  );
}
