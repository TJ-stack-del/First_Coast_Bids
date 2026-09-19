import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

// Design tokens matched to the Stitch "Industrial Precision" design system
// (dark: assets/7f0094d24ac44e9e885c0d324b7805a5, light companion:
// assets/969209daeee94fb5bb6f8c3b04c218ae) — amber/emerald/cyan on a dark
// slate "flight deck" surface (light mode: deep amber/emerald/cyan on a
// daylight-legible near-white surface), Chivo headlines + Hanken Grotesk
// body + JetBrains Mono for metrics/labels/tabular data, 4px-based
// roundness. This is a shared, global file — the token values below affect
// every page in the app. `full` is deliberately NOT overridden to the
// design system's own 0.75rem "xl": Tailwind's real "fully rounded"
// keyword needs to stay 9999px globally so it keeps rendering actual
// circles elsewhere in the app (e.g. AppShell's avatar placeholder).
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Variable-backed — see app/globals.css for the light (:root) and
        // dark (.dark) values. `<alpha-value>` keeps opacity modifiers
        // (bg-secondary/50) working the same as with plain hex.
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        "inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--color-inverse-on-surface) / <alpha-value>)",
        outline: "rgb(var(--color-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",
        "surface-tint": "rgb(var(--color-surface-tint) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",
        "inverse-primary": "rgb(var(--color-inverse-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--color-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",
        tertiary: "rgb(var(--color-tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--color-on-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--color-tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--color-on-tertiary-container) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        "on-error": "rgb(var(--color-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--color-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--color-on-error-container) / <alpha-value>)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        "on-background": "rgb(var(--color-on-background) / <alpha-value>)",
        "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
        // "-fixed" tokens are the same color in both themes by M3 design
        // (a badge/chip that should look identical regardless of theme) —
        // plain static hex, no CSS variable indirection needed.
        // primary-fixed/tertiary-fixed were missed during the navy/gold
        // rebrand (2026-09) since they live here as static hex rather than
        // in globals.css's CSS-variable tokens -- found via an impeccable
        // `document` pass (2026-09-19) that a homepage step badge and
        // LifecycleStepper's active-step highlight were still rendering
        // the old amber/cyan. Values reuse the exact navy/gold hexes
        // already established in globals.css and DESIGN.md (primary/
        // tertiary container + on-container pairs) rather than inventing
        // new ones, and on-tertiary-fixed-variant uses a second dark brown
        // distinct from on-tertiary-fixed -- a first attempt reused the
        // mid-tone "muted brass" text color here, which only reaches
        // 2.78:1 against tertiary-fixed (fails WCAG); verified via the
        // same luminance-contrast script used for the rest of this
        // session's color work.
        "primary-fixed": "#d6e2f0",
        "primary-fixed-dim": "#9dbfe6",
        "on-primary-fixed": "#071b33",
        "on-primary-fixed-variant": "#0c2d52",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",
        "tertiary-fixed": "#e2ba78",
        "tertiary-fixed-dim": "#c19349",
        "on-tertiary-fixed": "#2a1d14",
        "on-tertiary-fixed-variant": "#4a3820",
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "sans-serif"],
        headline: ["Chivo", "sans-serif"],
        code: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        // Sizes/weights/tracking taken directly from the design system's
        // own typography spec; fontFamily added per level so headline/
        // display text renders Chivo and metric/label text renders
        // JetBrains Mono without needing a separate font-headline/font-code
        // class at every call site (font-code is still available directly
        // for spots that want mono text at an arbitrary size, e.g. app/page.tsx).
        // Tailwind's built-in `text-*` utility only reads lineHeight/
        // letterSpacing/fontWeight from this tuple — it silently drops any
        // fontFamily key (confirmed against tailwindcss/src/corePlugins.js).
        // Font family per tier is applied instead via a small selector list
        // in app/globals.css so every text-display-*/text-headline-*/
        // text-title-lg/text-metric-*/text-label-* call site (dozens of
        // files) automatically gets the right family with no per-usage change.
        "display-lg": ["44px", { lineHeight: "52px", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-lg-mobile": ["32px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "30px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "title-lg": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "18px", letterSpacing: "0.005em", fontWeight: "400" }],
        "metric-xl": ["36px", { lineHeight: "44px", letterSpacing: "-0.03em", fontWeight: "700" }],
        "metric-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "500" }],
        // Was 10px -- an impeccable critique pass (2026-09-16) found this
        // sitewide token (used in 20+ files: nav/footer links, badges,
        // step-trackers, eyebrows) sits below the 11px functional-text
        // readability floor, mechanically confirmed via live detector
        // injection and visually confirmed as actual overlapping/truncated
        // text on the intake wizard's mobile step-tracker. A single-token
        // fix rather than patching each usage site, since every instance
        // shares the same underlying problem.
        "label-sm": ["11px", { lineHeight: "15px", letterSpacing: "0.06em", fontWeight: "600" }],
        "label-md-mobile": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "500" }],
        "code-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        gutter: "24px",
        "section-gap": "64px",
        base: "8px",
        // Stitch "Industrial Precision" spacing scale (space-2xs..space-3xl) —
        // used directly by restyled pages so their card/section padding and
        // gaps match the generated screens' own spacing values exactly.
        "space-2xs": "0.125rem",
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "space-base": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "space-2xl": "3rem",
        "space-3xl": "4rem",
      },
      maxWidth: {
        container: "1440px",
        "container-max": "1280px",
      },
    },
  },
  plugins: [forms],
};

export default config;
