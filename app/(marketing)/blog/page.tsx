import type { Metadata } from "next";
import s from "@/components/marketing/press.module.css";

export const metadata: Metadata = {
  title: "Blog",
  description: "Tips on preparing local government bids for small trade contractors.",
};

// No CMS or posts table exists yet — static entries for now, matching
// BUILD-ORDER-BIDPULSE.md's "start simple." No individual post routes
// until there's real content to link to.

const POSTS = [
  {
    category: "Bid tips",
    title: "Five things to check before submitting a bid",
    date: "2026-08-01",
    excerpt:
      "A last-pass checklist covering the details agencies actually reject bids over: page limits, required forms, and signature pages.",
  },
  {
    category: "Bid tips",
    title: "Why a compliance matrix matters more than your pitch",
    date: "2026-07-18",
    excerpt:
      "Evaluators score against the RFP's requirements line by line. A clear compliance matrix makes that scoring easy, and easy to score well.",
  },
];

// 2026-09-23: a dated ledger instead of cards. Posts have no pages of
// their own yet, so rows are deliberately not links (and have no hover
// affordance promising a click that goes nowhere).
export default function BlogPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Blog</h1>
        <p className={s.lede}>Plain-language tips for bidding on local contracts.</p>
      </header>
      <section className={s.narrow}>
        <div className={s.ledger}>
          {POSTS.map((post) => (
            <article key={post.title}>
              <div className={s.meta}>
                <time dateTime={post.date} className={s.mono}>
                  {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                </time>
                <span>{post.category}</span>
              </div>
              <h2 className={s.rowTitle}>{post.title}</h2>
              <p className={s.muted}>{post.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
