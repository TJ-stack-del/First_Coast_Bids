import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import s from "@/components/marketing/press.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the First Coast Bids team.",
};

export default function ContactPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Contact us</h1>
        <p className={s.lede}>
          Questions about a bid, your account, or anything else. Send us a message and we&apos;ll get back to you.
        </p>
      </header>
      <div className={s.formSheet}>
        <ContactForm />
      </div>
    </>
  );
}
