import Image from "next/image";

// Brand colors for the wordmark text, matching public/logo-mark.png's own
// navy/gold tones (#0c2d52 / #c19349) so the flat text reads as the same
// two-color system as the dimensional mark next to it.
const NAVY = "#0C2D52";
const GOLD = "#C19349";

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

  const wordmark = (
    <span
      className="font-headline font-bold leading-tight"
      style={{ color: NAVY }}
    >
      <span className="block tracking-wide">FIRST COAST</span>
      <span className="block tracking-wide" style={{ color: GOLD }}>
        BIDS
      </span>
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
