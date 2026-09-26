import type { Block } from "@/lib/guide/types";
import s from "@/components/marketing/press.module.css";

// Renders a guide article's structured blocks with the press styles, as
// plain text (never HTML), inside the page's s.prose container.
export function GuideBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "h2") return <h2 key={i}>{b.text}</h2>;
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        if (b.kind === "list") {
          // The press styles reset list markers; guide lists need them
          // (numbered steps, bulleted checklists), so they're set here.
          const items = b.items.map((it, j) => <li key={j} className="pl-1">{it}</li>);
          return b.ordered ? (
            <ol key={i} className="list-decimal pl-6 flex flex-col gap-2 my-4">{items}</ol>
          ) : (
            <ul key={i} className="list-disc pl-6 flex flex-col gap-2 my-4">{items}</ul>
          );
        }
        if (b.kind === "callout")
          return (
            <div key={i} className={s.panel}>
              <p className={s.panelLabel}>{b.title}</p>
              <p>{b.text}</p>
            </div>
          );
        return (
          <dl key={i} className="my-4">
            {b.items.map((t) => (
              <div key={t.term} className="mb-3">
                <dt><strong>{t.term}</strong></dt>
                <dd>{t.meaning}</dd>
              </div>
            ))}
          </dl>
        );
      })}
    </>
  );
}
