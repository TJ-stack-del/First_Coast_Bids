import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import s from "@/components/marketing/press.module.css";
import { ARTICLES, getArticle } from "@/lib/guide/articles";
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

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const i = ARTICLES.indexOf(a);
  const prev = ARTICLES[i - 1];
  const next = ARTICLES[i + 1];
  return (
    <div className={s.prose}>
      <header className={s.pageHead}>
        <p className={s.meta}>
          <Link href="/guide">New to bidding?</Link>
        </p>
        <h1 className={s.pageTitle}>{a.title}</h1>
        <p className={s.lede}>{a.summary}</p>
      </header>
      <GuideBlocks blocks={a.body} />
      <NextStep />
      <section className={s.proseSection}>
        <h2>Sources</h2>
        <ul>
          {a.sources.map((src) => (
            <li key={src.url}>
              <a href={src.url} target="_blank" rel="noreferrer">{src.label}</a>
            </li>
          ))}
        </ul>
      </section>
      <nav aria-label="More in the guide" className="flex flex-wrap justify-between gap-3 mt-6">
        {prev ? <Link href={`/guide/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/guide/${next.slug}`}>{next.title} →</Link> : <Link href="/guide">All guide articles</Link>}
      </nav>
    </div>
  );
}
