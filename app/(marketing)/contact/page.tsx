import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the First Coast Bids team.",
};

export default function ContactPage() {
  return (
    <>
      <section className="max-w-xl mx-auto w-full flex flex-col gap-4 text-center">
        <Reveal mode="mount">
          <h1 className="text-headline-lg text-primary">Contact us</h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-lg text-on-surface-variant">
            Questions about a bid, your account, or anything else. Send us a message and we&apos;ll get back to you.
          </p>
        </Reveal>
      </section>

      <Reveal
        as="div"
        mode="mount"
        delay={0.16}
        className="max-w-xl mx-auto w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8"
      >
        <ContactForm />
      </Reveal>
    </>
  );
}
