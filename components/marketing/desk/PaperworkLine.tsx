import s from "./desk.module.css";
import { Mark } from "./Mark";

// One big line of the paperwork in a packet, drifting slowly left. The
// moving copy is decorative (aria-hidden, shown twice so the loop is
// seamless); the same list is given once as text for screen readers. It
// pauses on hover, and on focus so a keyboard user can stop it too. With
// reduced motion it stands still and wraps instead.
const ITEMS = ["Bid form", "W-9", "Insurance certificate", "Addenda", "State forms", "Price sheet", "Signed"];

function Run({ copy }: { copy: number }) {
  return (
    <span className={s.line__run} data-copy={copy}>
      {ITEMS.map((t) => (
        <span key={t} className={s.line__item}>
          {t}
          <Mark className={s.line__mark} />
        </span>
      ))}
    </span>
  );
}

export function PaperworkLine() {
  return (
    <section className={s.line} tabIndex={0} aria-labelledby="line-h">
      <h2 id="line-h" className={s["visually-hidden"]}>
        What goes in your packet
      </h2>
      <ul className={s["visually-hidden"]}>
        {ITEMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className={s.line__view} aria-hidden="true">
        <div className={s.line__track}>
          <Run copy={1} />
          <Run copy={2} />
        </div>
      </div>
    </section>
  );
}
