import Link from "next/link";
import s from "./press.module.css";

// The spec-table pricing used on both the landing page and /pricing, so the
// two can never drift apart visually. Each page passes its own tier data
// (the landing preview shows fewer features per tier). The optional
// `terms` row only renders when a tier supplies terms.
export type PricingTier = {
  name: string;
  tagline: string;
  priceLine: string;
  terms?: string;
  features: string[];
  cta: { label: string; href: string };
  highlight: boolean;
  badgeLabel: string | null;
};

export function PricingSpec({ tiers }: { tiers: PricingTier[] }) {
  const showTerms = tiers.some((t) => t.terms);
  return (
    <>
    <div className={`${s.tableWrap} ${s.pricingWrap}`}>
      <table className={`${s.table} ${s.pricing}`}>
        <thead>
          <tr>
            <th scope="col">Plan</th>
            {tiers.map((tier) => (
              <th key={tier.name} scope="col" className={tier.highlight ? s.live : ""}>
                <span className={`${s.serif} ${s.planName}`}>{tier.name}</span>
                {tier.badgeLabel && <span className={s.planNote}>{tier.badgeLabel}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Price</th>
            {tiers.map((tier) => (
              <td key={tier.name} className={tier.highlight ? s.live : ""}>
                <PriceLine line={tier.priceLine} />
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">For</th>
            {tiers.map((tier) => (
              <td key={tier.name} className={tier.highlight ? s.live : ""}>
                {tier.tagline}
              </td>
            ))}
          </tr>
          {showTerms && (
            <tr>
              <th scope="row">Terms</th>
              {tiers.map((tier) => (
                <td key={tier.name} className={tier.highlight ? s.live : ""}>
                  {tier.terms}
                </td>
              ))}
            </tr>
          )}
          <tr>
            <th scope="row">Included</th>
            {tiers.map((tier) => (
              <td key={tier.name} className={tier.highlight ? s.live : ""}>
                {tier.features[0]}
                {tier.features.length > 1 && <span className={s.sub}>{tier.features.slice(1).join(" · ")}</span>}
              </td>
            ))}
          </tr>
          <tr className={s.ctaRow}>
            <th scope="row">
              <span className="sr-only">Choose a plan</span>
            </th>
            {tiers.map((tier) => (
              <td key={tier.name} className={tier.highlight ? s.live : ""}>
                <Link href={tier.cta.href} className={`${s.btn} ${tier.highlight ? s.btnPrimary : s.btnQuiet}`}>
                  {tier.cta.label}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
    {/* Phones: one spec block per plan instead of a sideways-scrolling table. */}
    <div className={s.plansMobile}>
      {tiers.map((tier) => (
        <article key={tier.name} className={tier.highlight ? s.liveCard : ""}>
          <span className={`${s.serif} ${s.planName}`}>
            {tier.name}
            {tier.badgeLabel && <span className={s.planNote}>{tier.badgeLabel}</span>}
          </span>
          <dl>
            <dt>Price</dt>
            <dd>
              <PriceLine line={tier.priceLine} />
            </dd>
            <dt>For</dt>
            <dd>{tier.tagline}</dd>
            {tier.terms && (
              <>
                <dt>Terms</dt>
                <dd>{tier.terms}</dd>
              </>
            )}
            <dt>Included</dt>
            <dd>
              {tier.features[0]}
              {tier.features.length > 1 && <span className={s.sub}>{tier.features.slice(1).join(" · ")}</span>}
            </dd>
          </dl>
          <Link href={tier.cta.href} className={`${s.btn} ${tier.highlight ? s.btnPrimary : s.btnQuiet}`}>
            {tier.cta.label}
          </Link>
        </article>
      ))}
    </div>
    </>
  );
}

// "Starting at $399" / "Starting at $649/mo" / "Free for the first 10 clients"
// rendered as a spec-table price: the figure in navy monospace with its
// qualifier underneath. Pilot's line has no figure, so it reads "On us"
// (the product's own wording -- never a bare "free", PRODUCT.md) above the
// real terms.
function PriceLine({ line }: { line: string }) {
  const m = line.match(/^Starting at (\$[\d,]+)(\/mo)?$/);
  if (m) {
    return (
      <>
        <span className={`${s.price} ${s.mono}`}>
          {m[1]}
          {m[2] && <span className={s.muted} style={{ fontSize: 14 }}>{m[2]}</span>}
        </span>
        <span className={s.sub}>Starting at</span>
      </>
    );
  }
  return (
    <>
      <span className={`${s.price} ${s.priceWord}`}>On us</span>
      <span className={s.sub}>{line}</span>
    </>
  );
}
