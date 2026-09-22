import type { Metadata } from "next";
import { Reveal } from "@/components/ui/Reveal";

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

export default function BlogPage() {
  return (
    <>
      <section className="max-w-2xl mx-auto w-full flex flex-col gap-2 text-center">
        <Reveal mode="mount" as="div">
          <h1 className="text-headline-lg text-primary">Blog</h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-lg text-on-surface-variant">Plain-language tips for bidding on local contracts.</p>
        </Reveal>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-3xl mx-auto w-full">
        {POSTS.map((post, i) => (
          <Reveal
            key={post.title}
            as="article"
            delay={i * 0.1}
            // No hover lift/shadow: these cards aren't links (no post routes
            // yet), so a hover affordance would promise a click that does
            // nothing. It also never worked -- Reveal's motion.article writes
            // an inline `transform: none` that beats `hover:-translate-y-1`.
            // If posts get routes, put the hover on an inner <Link>, not here.
            className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span className="text-primary font-bold">{post.category}</span>
              <span>{new Date(post.date).toLocaleDateString()}</span>
            </div>
            <h2 className="text-title-lg text-primary">{post.title}</h2>
            <p className="text-body-sm text-on-surface-variant">{post.excerpt}</p>
          </Reveal>
        ))}
      </div>
    </>
  );
}
