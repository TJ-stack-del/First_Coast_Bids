import Image from "next/image";

// Two real layouts, not one component squeezed into both shapes with CSS:
// "horizontal" for nav bars (icon left, text right, the common case) and
// "stacked" for centerpiece placements (login/reset-password hero, a
// footer mark) where the icon sits above the wordmark. Both render the
// same two-line wordmark ("FIRST COAST" over bold "BIDS") since that's
// the real lockup logo-mark.png's companion Stitch reference used in both
// orientations -- only the icon's position relative to the text changes.
export function Logo({
  variant = "horizontal",
  className = "",
  iconClassName = "",
  priority = false,
}: {
  variant?: "horizontal" | "stacked";
  className?: string;
  iconClassName?: string;
  priority?: boolean;
}) {
  // Two separate source images, not one image + a CSS filter -- the dark
  // variant was extracted from a Stitch reference rendered natively on a
  // dark background (see public/logo-mark-dark.png), so its alpha-matte
  // edges are clean against dark surfaces the same way logo-mark.png's are
  // clean against light ones. A single image decontaminated for one
  // background always shows a faint fringe of the other background's tint
  // at its semi-transparent edges. `dark:hidden`/`hidden dark:block` swap
  // on the CSS `.dark` class (next-themes) with no JS/hydration flicker,
  // and no `fill` sizing since iconClassName can be `w-auto` (the
  // reset-password hero logo) -- `fill` requires a definite parent width.
  const iconClasses = iconClassName || "h-10 w-10";
  const icon = (
    <>
      <Image
        src="/logo-mark.png"
        alt="First Coast Bids"
        width={512}
        height={512}
        className={`${iconClasses} dark:hidden`}
        priority={priority}
      />
      <Image
        src="/logo-mark-dark.png"
        alt="First Coast Bids"
        width={512}
        height={512}
        className={`${iconClasses} hidden dark:block`}
        priority={priority}
      />
    </>
  );

  // Theme-aware tokens, not hardcoded hex -- found as a real bug
  // (2026-09-19): a literal `color: "#0C2D52"` inline style bypassed
  // app/globals.css's own light/dark --color-primary pair entirely, so
  // "FIRST COAST" rendered at 1.29:1 contrast in dark mode (navy text on
  // a near-navy background), confirmed via direct WCAG luminance
  // calculation -- essentially unreadable, not just suboptimal.
  // text-primary already resolves to the correct value in both themes
  // (light: the same navy; dark: a light blue, 9.38:1). "BIDS" had a
  // second, subtler version of the same problem: its hardcoded true gold
  // (#C19349) already failed contrast even in light mode (2.79:1, under
  // the 3:1 large-text floor) -- exactly the on-surface-text-safety
  // problem app/globals.css's --color-tertiary token was deliberately
  // built to solve with a darkened "Muted Brass" for text specifically
  // (see DESIGN.md's Colors section), while keeping true gold for fills
  // only. Logo.tsx just never used that token, so the fix it already
  // applied everywhere else in the app never reached here.
  const wordmark = (
    <span className="font-headline font-bold leading-tight text-primary">
      <span className="block tracking-wide">FIRST COAST</span>
      <span className="block tracking-wide text-tertiary">BIDS</span>
    </span>
  );

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
        {icon}
        {wordmark}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon}
      {wordmark}
    </div>
  );
}
