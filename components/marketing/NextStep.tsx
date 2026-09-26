import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { PILOT_CTA, pilotPriceLine } from "@/lib/pilot-offer";

// The end of every guide article: take the check, or start the Pilot.
export function NextStep() {
  return (
    <div className={s.panel}>
      <p className={s.panelLabel}>Next step</p>
      <p>Not sure what to do first? Four yes-or-no questions point you to it.</p>
      <p className="flex flex-wrap gap-3 mt-3">
        <Link href="/quiz" className={`${s.btn} ${s.btnQuiet}`}>Where do I start?</Link>
        <Link href={PILOT_CTA.href} className={`${s.btn} ${s.btnPrimary}`}>{PILOT_CTA.label}</Link>
      </p>
      <p className={s.muted}>Pilot: {pilotPriceLine()}.</p>
    </div>
  );
}
