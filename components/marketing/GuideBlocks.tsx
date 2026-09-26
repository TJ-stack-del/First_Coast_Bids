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
          const items = b.items.map((it, j) => <li key={j}>{it}</li>);
          return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        if (b.kind === "callout")
          return (
            <div key={i} className={s.panel}>
              <p className={s.panelLabel}>{b.title}</p>
              <p>{b.text}</p>
            </div>
          );
        return (
          <dl key={i}>
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
