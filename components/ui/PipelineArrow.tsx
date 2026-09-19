import Image from "next/image";

// Landing page "before/after" portal mark. Used to pulse indefinitely
// (an infinite scale + glow loop) to match a "live system processing"
// feel -- deliberately removed: a perpetually-animating status indicator
// reads as live software automation, which overstates what actually
// happens (a person on the team prepares each document; see the "our
// team prepares..." copy this section now echoes).
//
// Two real bugs fixed 2026-09-19 (real user report): the old version
// wrapped a small (28px) generic arrow glyph in a 64px circle with
// `shadow-md` -- at that size the soft blurred drop-shadow read as a
// fuzzy/pixelated halo rather than a clean edge, especially against a
// dark page background. Fix wasn't a smaller/sharper shadow; it was
// dropping the circle chrome entirely and replacing the generic arrow
// with the actual brand mark (the same shield used everywhere else) at
// a size at least matching the old circle's own footprint (80px, a step
// up from the previous 64px circle) -- "prepared by our team" is exactly
// the moment this component represents, so the brand icon standing on
// its own reads better here than a small icon boxed inside a shape.
export function PipelineArrow() {
  return (
    <div className="relative flex items-center justify-center">
      <Image
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        className="h-20 w-20 dark:hidden"
      />
      <Image
        src="/logo-mark-dark.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        className="hidden h-20 w-20 dark:block"
      />
    </div>
  );
}
