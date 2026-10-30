"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { readBid, GROUP_ORDER, type BidRead as Result, type ReadGroup } from "@/lib/bid-read/read";
import { SAMPLE_BID_NAME, SAMPLE_BID_PAGES } from "@/lib/bid-read/sample-bid";
import s from "./press.module.css";

// The hero's free bid read (lib/bid-read/read.ts): drop a bid, see what it
// asks for, each line with its page and the bid's own words. The file is
// read in this browser tab and never sent anywhere -- no upload, no
// account, no AI -- which is the promise the panel makes, so keep it true:
// nothing here may fetch() the file or its text.

const GROUP_TITLE: Record<ReadGroup, string> = {
  deal_breaker: "Could get the bid thrown out",
  forms: "Forms to fill in and sign",
  money: "Bonds, insurance and wages",
  registrations: "Registrations and staff checks",
};

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_PAGES = 400;

type State =
  | { step: "idle" }
  | { step: "reading"; fileName: string; done: number; total: number | null }
  | { step: "done"; fileName: string; sample: boolean; result: Result }
  | { step: "problem"; fileName: string; message: string };

async function pdfPages(file: File, onPage: (done: number, total: number) => void): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const total = Math.min(pdf.numPages, MAX_PAGES);
  const pages: string[] = [];
  for (let i = 1; i <= total; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
    );
    onPage(i, total);
  }
  return pages;
}

async function filePages(file: File, onPage: (done: number, total: number) => void): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return pdfPages(file, onPage);
  if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return [value];
  }
  if (file.type.startsWith("text/") || name.endsWith(".txt")) return [await file.text()];
  throw new Error("unsupported");
}

export function BidRead() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);

  const show = (next: State) => {
    setState(next);
    // Move focus to the result so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => results.current?.focus());
  };

  async function read(file: File) {
    if (file.size > MAX_BYTES) {
      show({ step: "problem", fileName: file.name, message: "That file is over 60 MB, too big to read here. Our team can still read it when you start a bid." });
      return;
    }
    setState({ step: "reading", fileName: file.name, done: 0, total: null });
    try {
      const pages = await filePages(file, (done, total) => setState({ step: "reading", fileName: file.name, done, total }));
      if (pages.join("").replace(/\s/g, "").length < 40) {
        show({
          step: "problem",
          fileName: file.name,
          message: "We couldn't find any text in this file. It's probably a scan (a picture of the pages). This quick read can't see into scans, but our team reads them every day.",
        });
        return;
      }
      show({ step: "done", fileName: file.name, sample: false, result: readBid(pages) });
    } catch (e) {
      show({
        step: "problem",
        fileName: file.name,
        message:
          e instanceof Error && e.message === "unsupported"
            ? "This quick read takes PDF, Word (.docx) or text files. Our team can work with other formats when you start a bid."
            : "We couldn't open this file. It may be damaged or password-protected. Our team can still help when you start a bid.",
      });
    }
  }

  function trySample() {
    show({ step: "done", fileName: SAMPLE_BID_NAME, sample: true, result: readBid(SAMPLE_BID_PAGES) });
  }

  function reset() {
    setState({ step: "idle" });
    if (input.current) input.current.value = "";
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <div className={s.read}>
      {(state.step === "idle" || state.step === "reading") && (
        <div
          className={`${s.drop} ${dragging ? s.dropOn : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && state.step !== "reading") read(file);
          }}
        >
          <span className={`${s.mono} ${s.readCap}`}>Free bid read · no sign-up</span>
          {state.step === "reading" ? (
            <div className={s.reading} role="status" aria-live="polite">
              <p className={s.serif}>Reading {state.fileName}</p>
              <div className={s.meter} aria-hidden="true">
                <span style={{ width: state.total ? `${(state.done / state.total) * 100}%` : "8%" }} />
              </div>
              <p className={`${s.mono} ${s.muted}`}>
                {state.total ? `Page ${state.done} of ${state.total}` : "Opening the file"}
              </p>
            </div>
          ) : (
            <>
              <p className={`${s.serif} ${s.dropTitle}`}>Drop your bid here. See what it asks for.</p>
              <p className={s.muted}>
                The deadline, the forms to sign, bonds, insurance, site visits: every line with its page and the
                bid&apos;s own words.
              </p>
              <div className={s.ctas}>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => input.current?.click()}>
                  Choose a bid file
                </button>
                <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={trySample}>
                  Try a sample bid
                </button>
              </div>
              <p className={s.private}>
                Read right here in your browser. Your file never leaves your computer. PDF, Word or text.
              </p>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className={s.srOnly}
            aria-label="Choose a bid file to read"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) read(file);
            }}
          />
        </div>
      )}

      {state.step === "problem" && (
        <div ref={results} tabIndex={-1} className={s.readSheet}>
          <div className={s.sheetTop}>
            <h2 className={s.serif}>{state.fileName}</h2>
          </div>
          <p className={s.readProblem}>{state.message}</p>
          <ReadActions onReset={reset} />
        </div>
      )}

      {state.step === "done" && <ReadResult state={state} onReset={reset} focusRef={results} />}
    </div>
  );
}

function ReadResult({
  state,
  onReset,
  focusRef,
}: {
  state: Extract<State, { step: "done" }>;
  onReset: () => void;
  focusRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { items, pagesRead } = state.result;
  const dealBreakers = items.filter((i) => i.group === "deal_breaker").length;

  return (
    <div ref={focusRef} tabIndex={-1} className={s.readSheet} aria-labelledby="bid-read-title">
      <div className={s.sheetTop}>
        <h2 id="bid-read-title" className={s.serif}>
          {items.length === 0
            ? "Nothing on our quick list turned up."
            : `This bid asks for ${items.length} thing${items.length === 1 ? "" : "s"} you can't miss.`}
        </h2>
        <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 13 }}>
          {state.fileName} · {pagesRead} page{pagesRead === 1 ? "" : "s"}
          {state.sample && " · synthetic"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className={s.readProblem}>
          That doesn&apos;t mean the bid asks for nothing. Bids word things a hundred ways, and this quick read only
          knows the common ones. Our team reads every page.
        </p>
      ) : (
        <>
          {dealBreakers > 0 && (
            <p className={s.readAlert}>
              {dealBreakers === 1 ? "One of them" : `${dealBreakers} of them`} can get a bid rejected before anyone
              looks at your price.
            </p>
          )}
          {GROUP_ORDER.map((group) => {
            const rows = items.filter((i) => i.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} className={s.readGroup} aria-label={GROUP_TITLE[group]}>
                <h3 className={`${s.mono} ${group === "deal_breaker" ? s.hold : s.muted}`}>{GROUP_TITLE[group]}</h3>
                <ol>
                  {rows.map((item) => (
                    <li key={item.key} className={s.row}>
                      <span className={s.req}>{item.label}</span>
                      <span className={`${s.mono} ${s.readPage}`}>p. {item.page}</span>
                      {item.why && <span className={s.readWhy}>{item.why}</span>}
                      <span className={s.src}>
                        <q>{item.quote}</q>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </>
      )}

      <div className={s.readNext}>
        <p className={s.serif}>
          That&apos;s the checklist. <em>We do the paperwork for every line on it.</em>
        </p>
        <p className={s.muted}>
          Your capability statement, compliance matrix and technical narrative, checked against this bid. You review,
          sign and send.
        </p>
      </div>
      <ReadActions onReset={onReset} />
      <p className={s.readFine}>
        A first read by plain pattern-matching, not our full review. It can miss things written in unusual ways and
        can&apos;t see into scanned pages. Nothing here was sent anywhere.
      </p>
    </div>
  );
}

function ReadActions({ onReset }: { onReset: () => void }) {
  return (
    <div className={s.readActions}>
      <Link href="/intake?package=pilot" className={`${s.btn} ${s.btnPrimary}`}>
        Start a pilot bid
      </Link>
      <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={onReset}>
        Read another bid
      </button>
    </div>
  );
}
