"use client";

import { useState } from "react";
import s from "./landing.module.css";

// The landing page's proof section: part of a synthetic compliance matrix on
// a workbench grid, with engineering-drawing balloons (1-4) cross-referenced
// to the notes beside it, and the packet those notes describe. Hovering or
// focusing a note lights up its balloon and row, and vice versa -- the only
// motion is an 80ms color change. Everything shown is illustrative and
// labelled as such (PRODUCT.md: never present sample content as a real
// client's work).

const NOTES = [
  {
    k: 1,
    title: "Page and quote for every requirement",
    body: "Each row shows the page number and the exact sentence it came from, so you can check it against the real RFP without rereading the whole thing.",
  },
  {
    k: 2,
    title: "Missing details stay visible",
    body: "If you haven't given us a fact, it shows as a bracketed placeholder. We never fill one in with a guess, and you can't download the packet until every placeholder is filled.",
  },
  {
    k: 3,
    title: "Rules specific to the agency",
    body: "Schools mean background checks. Airports mean SIDA badges. Transit means DBE goals. We check what this agency actually asks for, not a generic list.",
  },
  {
    k: 4,
    title: "You sign it and send it",
    body: "You submit through your own portal account. We never touch your login and never submit on your behalf.",
  },
];

export function SampleSpecimen() {
  const [active, setActive] = useState<number | null>(null);
  const on = (k: number) => (active === k ? s.on : "");
  const hover = (k: number) => ({
    onMouseEnter: () => setActive(k),
    onMouseLeave: () => setActive(null),
  });

  return (
    <div className={s.specimen}>
      <div className={s.bed}>
        <div className={s.bedCap}>
          <span>Synthetic sample, not a real client</span>
          <span className={s.mono}>Sheet 2 of 3</span>
        </div>
        <div className={s.sheet}>
          <div className={s.sheetTop}>
            <h3 className={s.serif}>Compliance matrix</h3>
            <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
              Sample Solicitation · No. [SAMPLE-0000]
            </span>
          </div>

          <div className={`${s.row} ${on(1)}`} {...hover(1)}>
            <span className={s.balloon} aria-hidden="true">1</span>
            <span className={s.req}>General liability, $2,000,000 per occurrence</span>
            <span className={`${s.status} ${s.ok}`}>Met</span>
            <span className={s.src}>
              <span className={s.mono}>p. 14</span> ·{" "}
              <q>Contractor shall maintain commercial general liability coverage of not less than $2,000,000 per occurrence.</q>
            </span>
          </div>

          <div className={`${s.row} ${on(2)}`} {...hover(2)}>
            <span className={s.balloon} aria-hidden="true">2</span>
            <span className={s.req}>
              State contractor license on file: <span className={`${s.ph} ${s.mono}`}>[License number]</span>
            </span>
            <span className={`${s.status} ${s.hold}`}>Needs you</span>
            <span className={s.src}>
              <span className={s.mono}>p. 6</span> · <q>Bidder shall provide a current state license number.</q>
            </span>
          </div>

          <div className={`${s.row} ${on(3)}`} {...hover(3)}>
            <span className={s.balloon} aria-hidden="true">3</span>
            <span className={s.req}>Airport work: SIDA badging for every crew member on site</span>
            <span className={`${s.status} ${s.ok}`}>Checked</span>
            <span className={s.src}>
              <span className={s.mono}>p. 22</span> ·{" "}
              <q>All personnel requiring unescorted access shall obtain a SIDA badge.</q>
            </span>
          </div>

          <div className={`${s.sign} ${on(4)}`} {...hover(4)}>
            <span className={`${s.balloon} ${s.signBalloon}`} aria-hidden="true">4</span>
            <div>Authorized signature</div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <div className={s.aside}>
        <div className={s.object}>
          <div
            className={s.packet}
            role="img"
            aria-label="A sample bid submission package: capability statement, compliance matrix and technical narrative behind a navy cover"
          >
            <div className={s.doc}>Technical narrative</div>
            <div className={s.doc}>Compliance matrix</div>
            <div className={s.doc}>Capability statement</div>
            <div className={s.cover}>
              <div className={s.foil}>
                <span className={s.foilRule} />
                <span className={s.foilTitle}>Bid Submission Package</span>
                <span className={s.foilSub}>Sample · Synthetic</span>
                <span className={s.foilRule} />
              </div>
            </div>
          </div>
          <p className={s.caption}>Three documents, bound as one packet, ready for your signature.</p>
        </div>

        <ol className={s.key}>
          {NOTES.map((n) => (
            <li
              key={n.k}
              tabIndex={0}
              className={active === n.k ? s.on : ""}
              {...hover(n.k)}
              onFocus={() => setActive(n.k)}
              onBlur={() => setActive(null)}
            >
              <span className={s.n} aria-hidden="true">
                {n.k}
              </span>
              <div>
                <h3 className={s.serif}>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
