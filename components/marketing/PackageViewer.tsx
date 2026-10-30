"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SAMPLE_PACKAGES } from "@/lib/marketing/sample-packages";
import s from "./package.module.css";

// "See the package you'd get": builds the sample package in the browser with
// the same packet builder a client's real package comes from
// (lib/pdf/deliverables-packet.ts), from the synthetic content in
// lib/marketing/sample-packages.ts, then shows each page as an image. What
// the visitor sees is the real output, not a mock-up of it. Built on demand
// and cached per trade; nothing is sent anywhere.

type Built = { pages: string[]; url: string; file: string };

export function PackageViewer() {
  const [i, setI] = useState(0);
  const [built, setBuilt] = useState<Record<number, Built>>({});
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const pkg = SAMPLE_PACKAGES[i];
  const current = built[i];
  const working = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (built[i] || working.current.has(i)) return;
    working.current.add(i);
    let cancelled = false;
    (async () => {
      try {
        const [{ generateDeliverablesPacket }, { getDocumentProxy, renderPageAsImage }] = await Promise.all([
          import("@/lib/pdf/deliverables-packet"),
          import("unpdf"),
        ]);
        const doc = generateDeliverablesPacket(pkg.submission, pkg.deliverables);
        const bytes = new Uint8Array(doc.output("arraybuffer"));
        const blob = new Blob([bytes.slice()], { type: "application/pdf" });
        const pdf = await getDocumentProxy(bytes.slice());
        const pages: string[] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          pages.push(await renderPageAsImage(pdf, n, { scale: 1.6, toDataURL: true }));
        }
        if (cancelled) return;
        setBuilt((b) => ({
          ...b,
          [i]: { pages, url: URL.createObjectURL(blob), file: `Sample-bid-package-${pkg.tradeId}.pdf` },
        }));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        working.current.delete(i);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [i, built, pkg]);

  function pick(n: number) {
    setI(n);
    setPage(0);
  }

  const total = current?.pages.length ?? 0;

  return (
    <div className={s.viewer}>
      <div className={s.trades} role="group" aria-label="Show a sample package for your trade">
        {SAMPLE_PACKAGES.map((p, n) => (
          <button key={p.tradeId} type="button" aria-pressed={n === i} onClick={() => pick(n)}>
            {p.bid.trade}
          </button>
        ))}
      </div>

      <div className={s.stage}>
        <div className={s.main}>
          {current ? (
            <>
              {/* Rendered pages of a generated PDF: a data URL, not a static asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.pages[page]}
                alt={`Page ${page + 1} of ${total} of the sample package for ${pkg.bid.trade}`}
                className={s.page}
              />
              <div className={s.pager}>
                <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
                  ←
                </button>
                <span>
                  Page {page + 1} of {total}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
                  disabled={page >= total - 1}
                  aria-label="Next page"
                >
                  →
                </button>
              </div>
            </>
          ) : (
            <div className={s.loading} role="status">
              {failed ? "This sample didn't load. Try another trade or reload the page." : "Building the sample package…"}
            </div>
          )}
        </div>

        <div className={s.side}>
          {current && (
            <ol className={s.thumbs} aria-label="Pages">
              {current.pages.map((src, n) => (
                <li key={n}>
                  <button type="button" aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <span>{["Cover and bid details", "Capability statement", "Compliance matrix", "Technical narrative"][n] ?? `Page ${n + 1}`}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className={s.about}>
            <p>
              <b>{pkg.bid.title}</b>
              <br />
              {pkg.submission.agency} · {pkg.bid.number}
            </p>
            <p>
              Built just now by the same tool that makes your real package. Everything in brackets is a fact you
              supply; we never fill one in with a guess.
            </p>
            <div className={s.actions}>
              {current && (
                <a className={`${s.btn} ${s.btnLine}`} href={current.url} download={current.file}>
                  Download this sample
                </a>
              )}
              <Link href="/intake?package=pilot" className={`${s.btn} ${s.btnDark}`}>
                Start a pilot bid
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
