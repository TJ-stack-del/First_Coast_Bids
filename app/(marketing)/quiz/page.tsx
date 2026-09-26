import type { Metadata } from "next";
import { QuizForm } from "./QuizForm";
import s from "@/components/marketing/press.module.css";

export const metadata: Metadata = {
  title: "Where do I start?",
  description: "Four yes-or-no questions that point you to your next step with government bids, whether you're brand new or already bidding.",
};

export default function QuizPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Where do I start?</h1>
        <p className={s.lede}>Four yes-or-no questions. New to bids or already bidding, you&apos;ll get your next step.</p>
      </header>
      <QuizForm />
    </>
  );
}
