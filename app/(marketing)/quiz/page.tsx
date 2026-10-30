import type { Metadata } from "next";
import { QuizForm } from "./QuizForm";
import { sourceSerif, publicSans } from "@/components/marketing/story-fonts";

export const metadata: Metadata = {
  title: "Where do I start?",
  description:
    "Four yes-or-no questions, then your road to a first government bid: what you've done, your next step, and what comes after.",
};

export default function QuizPage() {
  return (
    <div className={`${sourceSerif.variable} ${publicSans.variable}`} style={{ fontFamily: "var(--font-public-sans), system-ui, sans-serif", display: "grid", gap: 32 }}>
      <header style={{ display: "grid", gap: 14, maxWidth: 820 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgb(12 45 82)" }}>
          Where do I start?
        </p>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontWeight: 600,
            fontSize: "clamp(2.4rem, 1.6rem + 3vw, 4rem)",
            lineHeight: 1.03,
            letterSpacing: "-0.02em",
          }}
        >
          Your road to a first government bid.
        </h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "rgb(96 90 80)" }}>
          Four yes-or-no questions. Then you&apos;ll see the whole road, where you are on it, and the one thing to do
          next.
        </p>
      </header>
      <QuizForm />
    </div>
  );
}
