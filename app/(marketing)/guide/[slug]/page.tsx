import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import s from "@/components/marketing/press.module.css";
import { ARTICLES, getArticle, STEP_LABELS } from "@/lib/guide/articles";
import g from "@/components/marketing/guide.module.css";
import { contents, readingMinutes } from "@/lib/guide/reading";
import { ReadingProgress } from "@/components/marketing/ReadingProgress";
import { GuideBlocks } from "@/components/marketing/GuideBlocks";
import { NextStep } from "@/components/marketing/NextStep";

// One guide article. Statically generated; an unknown slug is the site's 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = getArticle((await params).slug);
  return a ? { title: a.title, description: a.description } : {};
}

// 2026-10-30 (round 17): the article with a reading bar, an "In this
// article" list from its own headings, a free bid read card beside it, and
// a "Next up" card to the next lesson.
export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const i = ARTICLES.indexOf(a);
  const next = ARTICLES[i + 1];
  const toc = contents(a);
  return (
    <div className={g.wrap}>
      <ReadingProgress />
      <header className={g.head}>
        <p className={g.kicker}>
          <Link href="/guide">New to bidding?</Link> · Lesson {i + 1} of {ARTICLES.length}
        </p>
        <h1 className={g.title}>{a.title}</h1>
        <p className={g.lede}>{a.summary}</p>
        <p className={g.meta}>
          <span>{readingMinutes(a)} min read</span>
          <span>{STEP_LABELS[a.step]}</span>
        </p>
      </header>

      <div className={g.article}>
        <div className={s.prose} style={{ maxWidth: "none" }}>
          <GuideBlocks blocks={a.body} />
          <NextStep />
          <section className={s.proseSection}>
            <h2>Sources</h2>
            <ul>
              {a.sources.map((src) => (
                <li key={src.url}>
                  <a href={src.url} target="_blank" rel="noreferrer">
                    {src.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          {next ? (
            <Link href={`/guide/${next.slug}`} className={g.next}>
              <span>Next up · Lesson {i + 2}</span>
              <b>{next.title}</b>
              <small>
                {next.summary} {readingMinutes(next)} min.
              </small>
            </Link>
          ) : (
            <Link href="/guide" className={g.next}>
              <span>You&apos;ve read them all</span>
              <b>Back to the guide</b>
              <small>Or send us your first bid: the Pilot is the easiest way to start.</small>
            </Link>
          )}
        </div>

        <aside className={g.side} aria-label="About this article">
          {toc.length > 1 && (
            <nav className={g.toc} aria-label="In this article">
              <p>In this article</p>
              <ol>
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`}>{t.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className={g.bidCard}>
            <b>Have a bid already?</b>
            <p>See what it asks for in seconds: the deadline, site visits, bonds and forms, each with its page. Free.</p>
            <Link href="/#read">Read my bid free</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
