import s from "./desk.module.css";
import { redHatDisplay, redHatMono, redHatText } from "./desk-fonts";
import { DeskScene } from "./DeskScene";
import { WhoDoesWhat } from "./WhoDoesWhat";
import { DrawnCanvas } from "./DrawnCanvas";
import { Mark } from "./Mark";
import { PaperworkLine } from "./PaperworkLine";

// The homepage: the approved Hallmark "Furrow" reference build
// (design-drafts/2026-11-02-desk-home/, brief in its README) ported to
// components. Its own nav and mast footer, not MarketingShell's, because
// every link here is an anchor on this page.
//
// Two values are still open and shown as dashed boxes on purpose: the price
// and the phone or email. Ask Mike for them; never make them up.

// Marks this page as scripted before hydration, so the desk labels and the
// second tab panel don't flash before the components take over. React leaves
// the attribute alone (suppressHydrationWarning on the wrapper).
const MARK_JS = "document.currentScript.parentElement.setAttribute('data-js','')";

const NAV = [
  { href: "#split", label: "Who does what" },
  { href: "#where", label: "Where" },
  { href: "#price", label: "Price" },
];

export function DeskHome() {
  return (
    <div
      className={`${s.home} ${redHatDisplay.variable} ${redHatText.variable} ${redHatMono.variable}`}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: MARK_JS }} />

      <header className={s.nav}>
        <div className={s.container}>
          <div className={s.nav__pill}>
            <a className={s.mark} href="#top" aria-label="First Coast Bids, home">
              <Mark />
              First Coast Bids
            </a>
            <nav className={s.nav__links} aria-label="Main">
              {NAV.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
              <a className={s.btn} href="#contact">
                Talk to Mike
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main id="top">
        <section className={s.hero} aria-labelledby="hero-h">
          <div className={`${s.container} ${s.hero__top}`}>
            <h1 id="hero-h">Your bid, complete and in on time.</h1>
            <p className={s.lead}>We do the paperwork for city, county and school bids.</p>
            <div className={s.hero__actions}>
              <a className={`${s.btn} ${s["btn--primary"]}`} href="#contact">
                <span>Send me your next bid</span>
                <span className={s.btn__arrow} aria-hidden="true">
                  <svg viewBox="0 0 20 20" focusable="false">
                    <path d="M3.5 10h12.5M11 4.5 16.5 10 11 15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
          <DeskScene />
        </section>

        <PaperworkLine />

        <section className={s.split} id="split" aria-labelledby="split-h">
          <WhoDoesWhat />
        </section>

        <section className={s.where} id="where" aria-labelledby="where-h">
          <div className={s.container}>
            <div className={s.where__head}>
              <h2 id="where-h">Where we work</h2>
              <p className={s.lead}>City, county and school bids across Northeast Florida.</p>
            </div>
            <div
              className={s.map}
              role="img"
              aria-label="A survey map of the First Coast, not to scale, from Fernandina Beach down to St. Augustine, with five public buyers pinned"
            >
              <DrawnCanvas kind="land" />
              <ul className={s["visually-hidden"]}>
                <li>Nassau County, at Fernandina Beach</li>
                <li>City of Jacksonville</li>
                <li>Duval County Public Schools, in Jacksonville</li>
                <li>Clay County, at Green Cove Springs</li>
                <li>St. Johns County, at St. Augustine</li>
              </ul>
            </div>
            <div className={s.key}>
              <ul>
                <li>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <circle cx="9" cy="9" r="7.5" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="2" />
                  </svg>
                  City
                </li>
                <li>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M9 1 L17 9 L9 17 L1 9 Z" fill="var(--color-ink)" />
                  </svg>
                  County
                </li>
                <li>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M9 1.5 L17 16 L1 16 Z" fill="var(--color-ink)" />
                  </svg>
                  School district
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className={s.price} id="price" aria-labelledby="price-h">
          <DrawnCanvas kind="band" />
          <div className={`${s.container} ${s.price__grid}`}>
            <h2 id="price-h">The price</h2>
            <div className={s.bill}>
              <div>
                <span>One complete bid packet</span>
                <b>
                  <span className={s.fill} data-fill="price">
                    price to be set
                  </span>
                </b>
              </div>
              <div>
                <span>Your bid price</span>
                <b>Yours</b>
              </div>
            </div>
          </div>
        </section>

        <section className={s.contact} id="contact" aria-labelledby="contact-h">
          <div className={`${s.container} ${s.contact__grid}`}>
            <div className={s.contact__text}>
              <h2 id="contact-h">Talk to Mike</h2>
              <p className={s.lead}>Send the bid you want. Mike tells you what it needs and when it’s due.</p>
            </div>
            <dl>
              <div>
                <dt>Who</dt>
                <dd>Mike Coleman</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>Jacksonville, Florida</dd>
              </div>
              <div>
                <dt>Reach him</dt>
                <dd>
                  <span className={s.fill} data-fill="contact">
                    phone or email to be added
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className={s.mast}>
        <div className={s.container}>
          <div className={s.mast__word} aria-hidden="true">
            First Coast Bids
          </div>
          <div className={s.mast__row}>
            <span>Bid paperwork for contractors in Northeast Florida. The map is drawn for illustration.</span>
            <nav aria-label="Footer">
              {NAV.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
              <a href="#contact">Talk to Mike</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
