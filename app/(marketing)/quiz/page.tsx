import type { Metadata } from "next";
import { QuizForm } from "./QuizForm";
import s from "@/components/marketing/press.module.css";

export const metadata: Metadata = {
  title: "Fit-Score Quiz",
  description: "Four quick questions to see if your business is ready to bid on a local government contract.",
};

export default function QuizPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Are you ready to bid?</h1>
        <p className={s.lede}>Four quick questions.</p>
      </header>
      <QuizForm />
    </>
  );
}
