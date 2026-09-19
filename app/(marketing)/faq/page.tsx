import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "./FaqAccordion";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about First Coast Bids' done-for-you bid prep service.",
};

const CATEGORIES = [
  {
    name: "About First Coast Bids",
    faqs: [
      {
        q: "What is First Coast Bids?",
        a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
      },
      {
        q: "Do you guarantee I'll win the bid?",
        a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
      },
      {
        q: "Is my data secure?",
        a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
      },
    ],
  },
  {
    name: "Pricing",
    faqs: [
      {
        q: "How does pricing work?",
        a: "One-off starts at $399, Retainer starts at $649/mo, and Pilot is free for our first 10 clients — see the Pricing page for the full breakdown. We confirm the exact number with you directly before any work starts. No card is required to get started.",
      },
    ],
  },
  {
    name: "Getting started",
    faqs: [
      {
        q: "What do I need to get started?",
        a: "Just the RFP itself (or a link to it) and basic company info: NAICS codes, small-business status, and set-asides if you have them.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="max-w-2xl mx-auto w-full flex flex-col gap-4 text-center">
        <Reveal mode="mount">
          <h1 className="text-headline-lg text-primary">Frequently asked questions</h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-lg text-on-surface-variant">
            Straight answers about how First Coast Bids works.
          </p>
        </Reveal>
      </section>

      <section className="max-w-3xl mx-auto w-full flex flex-col gap-10">
        {CATEGORIES.map((cat, i) => (
          <Reveal key={cat.name} delay={i * 0.08} className="flex flex-col gap-4">
            <h2 className="text-headline-md text-primary border-b border-outline-variant pb-2">{cat.name}</h2>
            <FaqAccordion faqs={cat.faqs} />
          </Reveal>
        ))}
      </section>

      <Reveal as="div" className="text-center flex flex-col items-center gap-4">
        <p className="text-body-lg text-on-surface-variant">Can&apos;t find the answer you&apos;re looking for?</p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Contact support
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </Reveal>
    </>
  );
}
