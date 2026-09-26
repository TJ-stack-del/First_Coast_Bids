import type { ReactNode } from "react";

// The admin how-to: ONE source, shown in two places -- the "?" drawer on
// every admin page (AdminGuide.tsx, to read beside the bid you're working)
// and the full "How to" page (/admin/how-to). It merges the original job
// aid (requested by Mike so he never hunts for a separate document) with
// the federal-bid-mode steps and the review checklists that used to live in
// Admin-Review-Rubric.md. Content mirrors the REAL screens -- button names,
// stages, thresholds. When a screen changes, edit the matching section here
// the same day; there is no other copy to update.
//
// No hooks: this renders inside the client drawer and the server page alike.
// Sections are native <details> (keyboard- and screen-reader-operable with
// no extra JS), collapsed in the drawer for scanning and all open on the
// page so the contents links land on visible text.

export const HOW_TO_SECTIONS = [
  { id: "setup", title: "One-time setup", icon: "tune" },
  { id: "inbox", title: "Inbox", icon: "inbox" },
  { id: "matches", title: "Finding bids (Matches)", icon: "travel_explore" },
  { id: "any-bid", title: "Working any bid", icon: "assignment" },
  { id: "federal", title: "Extra steps on a federal bid", icon: "account_balance" },
  { id: "review", title: "Review checklists", icon: "checklist" },
  { id: "messages", title: "Messages", icon: "mail" },
  { id: "demo", title: "Demoing to a prospect", icon: "co_present" },
  { id: "trouble", title: "When something looks off", icon: "build" },
] as const;

type SectionId = (typeof HOW_TO_SECTIONS)[number]["id"];

function Section({ id, open, children }: { id: SectionId; open: boolean; children: ReactNode }) {
  const s = HOW_TO_SECTIONS.find((x) => x.id === id)!;
  return (
    <details id={id} open={open} className="group border-b border-outline-variant last:border-b-0 scroll-mt-6">
      <summary className="flex items-center gap-2 py-3 cursor-pointer list-none text-title-md font-bold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
        <span aria-hidden className="material-symbols-outlined text-[20px] text-primary">{s.icon}</span>
        <h2 className="text-title-md font-bold text-on-surface">{s.title}</h2>
        <span aria-hidden className="material-symbols-outlined ml-auto text-[20px] text-on-surface-variant transition-transform group-open:rotate-180 motion-reduce:transition-none">
          expand_more
        </span>
      </summary>
      <div className="pb-4 flex flex-col gap-3 text-body-md text-on-surface">{children}</div>
    </details>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-6 flex flex-col gap-2">{children}</ol>;
}

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Checks({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div>
      <h3 className="text-body-md font-bold text-on-surface mb-2">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">check_box_outline_blank</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A button or label exactly as it appears on screen.
function B({ children }: { children: ReactNode }) {
  return <strong className="font-bold">{children}</strong>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-body-sm text-on-surface-variant bg-surface-container-high rounded-lg px-3 py-2">{children}</p>;
}

export function AdminHowToContent({ expandAll = false }: { expandAll?: boolean }) {
  const open = (id: SectionId) => expandAll || id === "setup";
  return (
    <div>
      <p className="text-body-md text-on-surface-variant mb-2">
        Work reaches you two ways: a client submits through the intake form on their own, or you find a bid under Matches and
        assign it to a client. Either way it becomes a submission that moves through five stages: Submitted, In Review,
        Deliverables Ready, Client Review, Closed. Button names are in <strong>bold</strong>, exactly as on screen.
      </p>

      <Section id="setup" open={open("setup")}>
        <p>Do these once. Everything after this pre-fills from them.</p>
        <Steps>
          <li>
            <B>Settings</B> → <B>Trades</B>: for each trade you work, click <B>Edit</B> and fill in the <B>Wage worksheet</B> box with
            the five-digit position code from the wage determination (Janitorial: <strong>11150</strong>, Janitor; Landscaping:{" "}
            <strong>11210</strong>, Laborer, Grounds Maintenance). It is not a NIGP code: NIGP codes go in the box above it.
          </li>
          <li>
            <B>Settings</B> → <B>Lean package threshold</B>: bids below this dollar value get the lean 3-document package suggested
            (Rate Sheet, Executive Cover, Certificate of Insurance) instead of the full set. The default, $35,000, is Florida&apos;s
            state Category Two threshold; adjust it if a local agency you deal with often uses a different number.
          </li>
        </Steps>
        <Note>
          Each client&apos;s own pricing numbers (supplies, overhead, profit, square feet per hour, yearly increase) are not in
          Settings. You enter them once per client, on that client&apos;s first federal bid. The client never fills in a form.
        </Note>
      </Section>

      <Section id="inbox" open={open("inbox")}>
        <Points
          items={[
            "Every client's submissions, oldest first. Drafts don't show up here yet since there's nothing to review.",
            <>Opening a submission that&apos;s still &quot;Submitted&quot; moves it to &quot;In Review&quot; the moment you view it. That&apos;s how the queue knows you&apos;ve started.</>,
            <>The banner at the top counts submissions past the 48-hour turnaround (&quot;Past due&quot;) and submissions untouched for 3+ days (&quot;Needs attention&quot;). Click it to filter straight to those.</>,
            "Board view groups by stage; List view is a sortable list. Toggle at the top. Sort by submission order (first in, first worked) or by due date.",
            <>&quot;Include test submissions&quot; and &quot;Show closed&quot; are off by default: test rows never count toward the real queue, and closed work is done.</>,
            <>Bids you assigned from Matches wait under <B>Waiting on client</B> until the client adds their bid file. Resend the email or <B>Withdraw</B> from there.</>,
          ]}
        />
      </Section>

      <Section id="matches" open={open("matches")}>
        <p>
          <B>Matches</B> lists new bids found by the daily scans (SAM.gov federal bids for Florida, and the local sources), sorted into{" "}
          <B>Your trades</B> (trades in your trade list) and <B>Other trades</B>.
        </p>
        <Steps>
          <li>Open a match to read <B>About the bid</B> and check the deadline.</li>
          <li>
            Pick the client and <B>Assign</B>. That creates a draft submission with the agency, scope and due date filled in, and emails
            the client to attach the real bid file. If the trade doesn&apos;t fit that client you&apos;ll see{" "}
            <B>Trade doesn&apos;t match this client</B>; use <B>Assign anyway</B> only when you&apos;re sure.
          </li>
          <li>
            If the client passes or the bid is cancelled, <B>Withdraw</B> it from the Inbox&apos;s <B>Waiting on client</B> list (you
            can email the client at the same time).
          </li>
          <li>Not pursuing a match? <B>Dismiss</B> it; no submission is created.</li>
          <li>
            Found a bid somewhere else? <B>Log opportunity</B>: upload the solicitation to auto-fill the fields, or type Title, Agency,
            Solicitation #, Due date and Scope by hand.
          </li>
        </Steps>
        <Note>Deleting a logged opportunity never touches a submission it already produced, only the Matches entry.</Note>
      </Section>

      <Section id="any-bid" open={open("any-bid")}>
        <p>Open the submission from <B>Inbox</B> and work down the page.</p>
        <Steps>
          <li>
            <strong>Pre-flight badges</strong> at the top are mechanical checks (deliverable content present, certifications verified,
            no leftover [bracket placeholders]). Green means clear; amber means look closer before moving on.
          </li>
          <li>
            <strong>Estimated value</strong> is admin-only, never asked of the client. Fill it in once you know the job&apos;s size; it
            drives the lean-package suggestion.
          </li>
          <li>
            <strong>Upload the solicitation</strong> (and each amendment) under the bid&apos;s documents with <B>Choose file</B>. Use PDF
            or Word. The page reads it by itself; there&apos;s no need to reload.
          </li>
          <li>
            <strong>Checklist suggestions.</strong> The app lists what the solicitation says must be submitted, each with a quote from
            the document.
            <ul className="list-disc pl-6 mt-1 flex flex-col gap-1">
              <li>
                <B>Needs a look</B> comes first: federal items, items you own, and anything whose quote couldn&apos;t be verified.
                Check each against the document (the page link opens it).
              </li>
              <li><B>Approve routine items</B> approves the rest in one click, after you&apos;ve glanced at them.</li>
              <li>
                Set each item&apos;s owner, <B>Me</B> or <B>Client</B>, and <B>Reject</B> anything that doesn&apos;t belong.
              </li>
              <li><B>Send the client their list</B> emails the client just their items not already sent.</li>
            </ul>
          </li>
          <li>
            <strong>Compliance checklist:</strong> whatever is on it is exactly what the client sees on their dashboard as &quot;What
            we still need from you.&quot; Update each item: Not started, In progress, Done, Waived.
          </li>
          <li>
            <strong>Certifications:</strong> the client uploads the document from their dashboard. Open it, then mark it reviewed. A
            certification only counts anywhere generated (drafts, the final PDF) once you&apos;ve verified it.
          </li>
          <li>
            <B>Request info from client</B>: pick an outstanding checklist item to email the client about it (marks it in progress), or
            choose &quot;Other&quot; for a one-off request, which also adds it to the checklist. Never guess a missing fact.
          </li>
          <li>
            <strong>Payment:</strong> link a package (new, or one already on file for that client, useful for retainer clients) and{" "}
            <B>Mark as paid</B>. That is the real gate on the client downloading deliverables. Pilot packages are always unlocked.
          </li>
          <li>
            <strong>Deliverables:</strong> for each, <B>Auto-draft</B> (a starting draft to edit), type your own and <B>Save text</B>, or{" "}
            <B>Upload file instead</B>. Review each against its checklist (see Review checklists). For a small job,{" "}
            <B>Switch to lean package</B>.
          </li>
          <li>
            <B>Preview packet</B> shows the combined client-facing document; skim it end to end. When every required deliverable has real
            content and no [bracketed placeholder], the bid moves to Deliverables Ready by itself.
          </li>
          <li>
            <B>Move to stage</B> moves the bid by hand. It can send the client a real notification email; a message under the buttons says
            whether it sent, and why not if it didn&apos;t.
          </li>
        </Steps>
        <Points
          items={[
            "Internal notes are private. The client never sees them.",
            "Fit check runs on its own when a client submits or when you assign a match. You don't trigger it.",
            "Mark as test submission for rehearsal or demo work: it's excluded from revenue totals and queue priority. Delete submission is permanent and asks you to type the agency name.",
            "The audit log at the bottom records everything that's happened on the submission.",
          ]}
        />
      </Section>

      <Section id="federal" open={open("federal")}>
        <p>
          A federal bid shows two more panels under the checklist: the <B>Wage worksheet</B> and <B>CLIN pricing</B>. They fill themselves
          in from the solicitation; your job is to check what&apos;s highlighted.
        </p>
        <h3 className="text-body-md font-bold">Wage worksheet (the legal labor-cost floor)</h3>
        <Steps>
          <li>
            It opens once the checklist finds the wage determination (WD). If it asks for one, type the number from the solicitation, e.g.{" "}
            <strong>2015-4539 (Rev. 32)</strong>, and click <B>Fetch</B>. Check that the area named matches the place of performance.
          </li>
          <li>
            <strong>First federal bid for a client:</strong> fill in <B>&lt;Client&gt;&apos;s numbers</B> (supplies, overhead %, profit %,
            square feet per hour, yearly increase %) from your pricing conversation with them, and click <B>Save for &lt;Client&gt;</B>.
            Every later bid for that client fills itself in. Blank boxes are highlighted: never guess them.
          </li>
          <li>Check the positions and hours (hours come from the square footage and the client&apos;s square feet per hour).</li>
          <li>
            Enter the agreed <B>Bid price</B>. Below the labor-cost floor, you get a warning. The client sees one read-only &quot;Wage law
            check&quot; line on their bid, including that warning.
          </li>
          <li>
            If an amendment names a newer WD, a banner offers <B>Update the worksheet</B>. <B>Re-fill from &lt;Client&gt;&apos;s numbers</B>{" "}
            applies changed client numbers; the bid price is kept.
          </li>
        </Steps>
        <h3 className="text-body-md font-bold">CLIN pricing (the solicitation&apos;s price table)</h3>
        <Steps>
          <li>
            The app reads the price table (the CLINs) and prices every line from the bid price, the client&apos;s yearly increase and,
            where needed, your split. Only lines that need you are highlighted.
          </li>
          <li>
            Check each line against its quote (the page link opens the document): CLIN, description, quantity and unit, and period (Base,
            Option 1–4). Correct anything right in the table; your corrections are kept if the table is read again.
          </li>
          <li>
            <strong>Several buildings priced separately:</strong> enter each building&apos;s <B>Split %</B> once. It carries into every
            option year, and each year must add up to 100%.
          </li>
          <li>
            A whole-period line shows &quot;Lump sum&quot; and its months (a 9-month base is 9/12 of the year). A line the app can&apos;t
            price (per job, per hour) needs a unit price typed; typed prices are marked &quot;typed&quot;.
          </li>
          <li>
            Click <B>Update the Rate sheet</B>. The priced table becomes the client&apos;s Rate sheet, so a federal full package has four
            documents. If a price changes later, the panel says the Rate sheet is out of date; update it again.
          </li>
        </Steps>
        <Note>
          The price is always the client&apos;s decision. The worksheet and the CLIN table only work out the numbers from what the client
          gave you and what the documents say.
        </Note>
      </Section>

      <Section id="review" open={open("review")}>
        <p>Keep this open while reviewing. Don&apos;t move to the next deliverable until every box is checked or has a written reason.</p>
        <Checks
          title="Every deliverable, every time (do this first)"
          items={[
            <>No bracketed placeholder (<code>[ADD: ...]</code>, <code>[Client name]</code>, etc.) remains, except deliberately left, clearly-marked gaps the client still needs to supply.</>,
            "Every fact stated (certification number, insurance amount, years in business, NAICS code) traces back to something the client actually entered, not something that reads as plausible.",
            "No certification is referenced as held or valid unless it shows “Document Reviewed” (verified) on the Company Profile.",
            "Agency name, solicitation number and due date match the bid record exactly.",
            "Plain-language check: would an 8th-grade reader understand every sentence? No unexplained jargon.",
          ]}
        />
        <Checks
          title="Capability statement"
          items={[
            "The company overview reflects the client's actual differentiators, not generic filler.",
            "The trade and service description matches the client's NAICS codes and trade keywords, not a mismatched or overly broad claim.",
            "Years in business, license number and insurance figures match the Company Profile exactly.",
            "No implied past performance beyond what the client entered in Differentiators or past performance.",
          ]}
        />
        <Checks
          title="Compliance matrix"
          items={[
            "Every always-mandatory item appears on the matrix; nothing silently dropped.",
            "Agency-specific items are present when they should be (airport → SIDA badging; school → background checks; transit → DBE; law enforcement or detention → background check and bloodborne pathogen certification), and absent when they shouldn't be.",
            "Conditional items (bid bond, socioeconomic certifications, quality accreditations) are mandatory only if the solicitation text supports it.",
            "Every row says “NEEDS VERIFICATION” or similar, not a confirmed claim the client holds or has completed the item.",
            "The table really renders as a table in the packet preview, not broken text.",
          ]}
        />
        <Checks
          title="Technical narrative"
          items={[
            "The approach is plausible for the actual trade and scope, not a generic or mismatched methodology.",
            "No equipment brand, methodology name or certification is invented; placeholders are used where the client hasn't given details.",
            "Staffing and approach are consistent with what the client described.",
          ]}
        />
        <Checks
          title="Rate sheet (federal bids with CLINs)"
          items={[
            "Every CLIN number and description matches the solicitation's price table (check the quotes), including any amendment's changes.",
            "Quantities, units and periods (Base, Option 1–4) match the solicitation; lump-sum lines show the right months.",
            "The base year's total matches the agreed bid price (or its share, when split); option years rise by the client's yearly increase.",
            "Any typed unit price is intentional and agreed with the client.",
            "No placeholders remain, and the CLIN panel doesn't say the Rate sheet is out of date.",
          ]}
        />
        <Checks
          title="Before Deliverables Ready"
          items={[
            "Every deliverable in the package has passed its own checklist.",
            "The combined packet has been opened with Preview packet and skimmed end to end at least once.",
            "Any checklist items still outstanding for the client are resolved or flagged to them with Request info from client.",
          ]}
        />
        <Note>
          This is a living checklist. If a real mistake gets through despite every box being checked, it needs a new line: add it here the
          same day.
        </Note>
      </Section>

      <Section id="messages" open={open("messages")}>
        <Points
          items={[
            "This is the general contact form from firstcoastbids.com/contact, not client-submission messaging (that lives on each submission's own page).",
            "Mark read/unread to track what you've handled. There's no reply button here; reply using the sender's email address shown on each message.",
          ]}
        />
      </Section>

      <Section id="demo" open={open("demo")}>
        <Points
          items={[
            "Use a dedicated demo account, never a real client's data. Sign up through the normal intake flow with an obviously fake company name (e.g. \"Sample Co Demo\"), then open its submission from the inbox and mark it as a test submission, so it never pollutes real reporting.",
            "Set it up ahead of time, not live on the call. Move the demo submission through a couple of stages and prepare at least one real-looking deliverable beforehand.",
            "Open on the homepage: the \"before and after\" panel under the hero shows the transformation (messy RFP in, clean package out) in one moment.",
            "Walk the intake wizard from their seat: three short steps, plain-language questions, and the optional \"upload a document to autofill\" step. Point out there's no card required and no long form.",
            "Show the client dashboard next: \"What we still need from you\", stage progress, and the messaging thread. This is what they'll live in after they sign up.",
            "If it feels right, show one screen from your side (the submission page): a real person checking off a checklist reads as more credible than an all-automated process. Skip this if they care more about speed than process.",
            "Close on a real, finished deliverable: open Preview packet on the demo submission so they see an actual capability statement and compliance matrix, not a mockup.",
            "Wrap up with pricing (Pilot for a free first bid, One-off, Retainer) and a clear next step: send them to /intake, or start it together on the call.",
            "Never open another real client's row or submission during a demo, even by accident. Filter or scroll to the demo row before you start sharing.",
          ]}
        />
      </Section>

      <Section id="trouble" open={open("trouble")}>
        <Points
          items={[
            <><strong>A reading failed or &quot;timed out&quot;.</strong> Use <B>Check again</B> (checklist) or <B>Read again</B> (CLIN pricing). Long solicitations occasionally need a second try.</>,
            <><strong>&quot;Quote not found&quot;.</strong> The AI&apos;s quote isn&apos;t in the document word for word. Open the page and check the item yourself before approving it.</>,
            <><strong>&quot;Couldn&apos;t verify: scanned document&quot;.</strong> The file is a scan with no text. Check it by eye, or ask for a text PDF.</>,
            <><strong>No wage worksheet or CLIN panel on a federal bid.</strong> The agency name wasn&apos;t recognised as federal. Once the checklist finds federal items (SF forms, FAR clauses) the panels appear; for CLINs, click <B>Read the price table</B>.</>,
            <><strong>A price schedule in an Excel file.</strong> It can&apos;t be read automatically; the CLIN panel says so. Add those lines with <B>+ Add a line</B>.</>,
            <><strong>The client can&apos;t download the packet.</strong> Either it isn&apos;t marked paid (Pilot is always unlocked), or a deliverable still has a [bracketed placeholder]. Find it (the Rate sheet shows which CLIN is unpriced), fill it or get it from the client, and save.</>,
            <><strong>&quot;The Rate sheet is out of date&quot;.</strong> A price, split or line changed after you updated it. Click <B>Update the Rate sheet</B>.</>,
          ]}
        />
      </Section>
    </div>
  );
}
