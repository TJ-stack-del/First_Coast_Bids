"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import s from "./paperwork.module.css";

// The opening (round 8, after superpower.com's hero): the headline in the
// middle, the actual paperwork a bid asks for laid around it as objects with
// captions. Every one is a real document type the service prepares or helps
// the client gather; the faces are drawn, with "Sample" on them, never a real
// agency's or client's form. The pieces drift a few pixels with the pointer
// (off under reduced motion and on touch screens).

type Paper = {
  title: string;
  caption: string;
  kind: "form" | "bond" | "cert" | "doc" | "matrix" | "stamp";
  pos: string; // class from paperwork.module.css placing it on desktop
  depth: number; // how far it drifts with the pointer
};

const PAPERS: Paper[] = [
  { title: "Bid Bond", caption: "5% of your bid, from your surety", kind: "bond", pos: s.p1, depth: 14 },
  { title: "Sworn Statement", caption: "Filled in for you to sign", kind: "form", pos: s.p2, depth: 8 },
  { title: "Addendum No. 2", caption: "Read and acknowledged", kind: "stamp", pos: s.p3, depth: 18 },
  { title: "Certificate of Insurance", caption: "Checked against the minimums", kind: "cert", pos: s.p4, depth: 10 },
  { title: "Capability Statement", caption: "Written for this agency", kind: "doc", pos: s.p5, depth: 16 },
  { title: "Compliance Matrix", caption: "Every rule, with its page", kind: "matrix", pos: s.p6, depth: 12 },
  { title: "Form W-9", caption: "From your company file", kind: "form", pos: s.p7, depth: 9 },
];

function Face({ paper }: { paper: Paper }) {
  return (
    <div className={`${s.face} ${s[paper.kind]}`}>
      <span className={s.faceTitle}>{paper.title}</span>
      {paper.kind === "matrix" ? (
        <span className={s.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} className={i % 3 === 2 ? s.ok : ""} />
          ))}
        </span>
      ) : (
        <span className={s.lines}>
          <i style={{ width: "86%" }} />
          <i style={{ width: "72%" }} />
          <i style={{ width: "80%" }} />
          <i style={{ width: "54%" }} />
        </span>
      )}
      {paper.kind === "bond" && <span className={s.seal}>5%</span>}
      {paper.kind === "stamp" && <span className={s.ack}>Acknowledged</span>}
      {paper.kind === "cert" && <span className={s.certBar}>$1,000,000</span>}
      {(paper.kind === "form" || paper.kind === "stamp") && <span className={s.sign}>Sign here</span>}
      <span className={s.sample}>Sample</span>
    </div>
  );
}

export function PaperworkHero() {
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches;
    if (still) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
      });
    };
    el.addEventListener("pointermove", move);
    return () => {
      el.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className={s.hero} ref={field}>
      <ul className={s.papers} aria-label="The paperwork a government bid asks for">
        {PAPERS.map((paper) => (
          <li key={paper.title} className={`${s.paper} ${paper.pos}`} style={{ "--d": paper.depth } as React.CSSProperties}>
            <Face paper={paper} />
            <span className={s.caption}>
              <b>{paper.title}</b>
              {paper.caption}
            </span>
          </li>
        ))}
      </ul>

      <div className={s.center}>
        <p className={s.kicker}>Government bids · small trade businesses · Northeast Florida</p>
        <h1 className={s.title}>
          Every form a bid asks for. <span>Handled.</span>
        </h1>
        <p className={s.lede}>
          Send us the RFP. We read every page, prepare the package and fill in the forms. You sign, send it in yourself,
          and your bid gets scored on your price and your work.
        </p>
        <div className={s.ctas}>
          <a href="#read" className={`${s.btn} ${s.btnDark}`}>
            Read my bid free
          </a>
          <Link href="/intake?package=pilot" className={`${s.btn} ${s.btnLine}`}>
            Start a pilot bid
          </Link>
        </div>
      </div>
    </section>
  );
}
