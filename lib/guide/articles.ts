import type { GuideArticle, Step } from "./types.ts";

// The "New to bidding?" guide's articles, in reading order
// (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md). Undated and
// evergreen. Every fact was checked against the sources listed with it on
// 2026-09-26; the user reads every article before it goes live. When a fact
// changes, update the article and its sources together.

export const STEP_LABELS: Record<Step, string> = { learn: "Learn the basics", ready: "Get ready", start: "Start bidding" };

export const ARTICLES: GuideArticle[] = [
  {
    slug: "what-is-an-rfp",
    title: "What's an RFP?",
    summary: "The words you'll meet in every government bid, in plain English.",
    description: "RFP, ITB, RFQ, addendum, pre-bid meeting, bid bond: what the words in a government bid mean, in plain English.",
    step: "learn",
    body: [
      {
        kind: "p",
        text: "When a city, county, school district or federal agency needs work done, it usually can't just call a company it likes. It's spending public money, so the law expects it to ask for offers in the open and pick fairly. The document it puts out to ask for those offers is called a solicitation. RFP is one kind, and it's the name people often use for all of them.",
      },
      {
        kind: "p",
        text: "Solicitations are long and full of their own words. You don't need to know all of them. The ones below come up in almost every bid a trade business will see.",
      },
      { kind: "h2", text: "The main kinds of solicitation" },
      {
        kind: "terms",
        items: [
          {
            term: "ITB (Invitation to Bid), sometimes IFB",
            meaning: "The agency knows exactly what it wants and asks for sealed prices. Usually the lowest price from a business that meets every requirement wins. A lot of cleaning, mowing and repair work is bought this way.",
          },
          {
            term: "RFP (Request for Proposals)",
            meaning: "The agency asks for sealed proposals: your price plus how you'll do the work, your experience and your staff. A committee scores each proposal against the criteria written in the RFP, so the lowest price doesn't automatically win.",
          },
          {
            term: "RFQ (Request for Quotes)",
            meaning: "Often used for smaller or simpler jobs. It's usually quicker and lighter on paperwork than an ITB or RFP, but read it just as carefully.",
          },
          {
            term: "ITN (Invitation to Negotiate)",
            meaning: "Used in Florida when an agency wants to talk terms with one or more businesses before picking one. Less common for routine trade work.",
          },
        ],
      },
      { kind: "h2", text: "Words inside the solicitation" },
      {
        kind: "terms",
        items: [
          { term: "Scope of work", meaning: "The part that says exactly what work, where, how often and to what standard. Price only what's in it." },
          { term: "Addendum (plural: addenda)", meaning: "A change or answer the agency issues after the solicitation is posted. Addenda can change dates, quantities or requirements. You're expected to know about every one, and often to sign and return a form saying you received it." },
          { term: "Pre-bid meeting or site visit", meaning: "A meeting, often at the job site, where the agency walks bidders through the work. If the solicitation calls it mandatory, check its exact wording: missing a mandatory meeting can mean you aren't allowed to bid." },
          { term: "Questions deadline", meaning: "The last day you can ask the agency questions in writing. Answers usually come back as an addendum that every bidder sees." },
          { term: "Due date and time", meaning: "The exact moment bids must be in. Treat it as a hard stop, not a goal." },
          { term: "Bid bond", meaning: "A guarantee, usually from a surety company (a company that backs contractors' promises, a bit like an insurer), that you'll sign the contract if you win. Only some solicitations ask for one, and they say how much." },
          { term: "Responsive", meaning: "Your bid answers everything the solicitation asks for, in all the ways that matter. A bid that isn't responsive can be thrown out, however good the price." },
          { term: "Responsible", meaning: "You can actually do the job, with the ability, integrity and reliability to perform it in good faith. The agency may check your license, insurance, references and finances." },
        ],
      },
      {
        kind: "callout",
        title: "Make this a habit",
        text: "Read the whole solicitation, including every addendum, before you decide to bid. Bids get thrown out for a missed requirement, a missing form or a missed deadline, however good the price.",
      },
      {
        kind: "p",
        text: "Federal agencies use slightly different names for some of these, but the idea is the same: sealed bids where price decides, or proposals scored on several factors. Once you know which one you're looking at, you know how you'll be judged.",
      },
    ],
    sources: [
      { label: "Florida Statutes, s. 287.012 (definitions: invitation to bid, request for proposals, responsive and responsible vendor)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.012" },
      { label: "Federal Acquisition Regulation, Part 14: Sealed Bidding", url: "https://www.acquisition.gov/far/part-14" },
      { label: "Federal Acquisition Regulation, Part 15: Contracting by Negotiation", url: "https://www.acquisition.gov/far/part-15" },
    ],
  },
  {
    slug: "is-government-work-for-me",
    title: "Is government work right for my business?",
    summary: "What agencies buy from trade businesses, and the honest trade-offs.",
    description: "What cleaning, grounds, HVAC, electrical and IT businesses can sell to government, and the honest pros and cons of bidding.",
    step: "learn",
    body: [
      {
        kind: "p",
        text: "Government agencies buy a lot of the same work your private customers do. Offices, schools, libraries, fire stations, parks and ports all need cleaning, grounds care, heating and cooling, electrical work and computer support. The difference is how they buy it, and that's what decides whether it's a good fit for you.",
      },
      { kind: "h2", text: "What trade work agencies buy" },
      {
        kind: "list",
        items: [
          "Cleaning: janitorial and custodial services for offices, schools, terminals and other public buildings, sometimes with floor care or window cleaning added.",
          "Grounds: mowing, landscaping, tree trimming and irrigation care for parks, road edges, campuses and ponds.",
          "HVAC and plumbing: maintenance contracts, repairs and replacements, such as preventive maintenance on boilers and chillers.",
          "Electrical: repairs, lighting upgrades, generator and panel work, and maintenance.",
          "IT support: help desk, network and computer support for offices and schools.",
        ],
      },
      { kind: "h2", text: "The good side" },
      {
        kind: "list",
        items: [
          "Agencies are required to pay. In Florida, a local government generally has 45 days to pay a proper invoice for goods and services other than construction, and owes interest if it pays late. Federal agencies generally pay within 30 days of a proper invoice or of accepting the work, whichever is later.",
          "Contracts often run for a year or more, sometimes with option years, which means steady, predictable work.",
          "The rules are written down. Everyone gets the same information and the same deadline, so a small business can compete on the same terms as a big one.",
        ],
      },
      { kind: "h2", text: "The harder side" },
      {
        kind: "list",
        items: [
          "Paperwork. Expect forms, signatures, insurance certificates and sworn statements with every bid.",
          "Fixed deadlines. A late bid is generally refused, even by a minute.",
          "Sealed prices. You usually get one shot at the price, with no back-and-forth.",
          "Price pressure. On many bids the lowest price from a qualified business wins.",
          "Wage rules on federal service work. Federal service contracts over $2,500 are generally covered by the Service Contract Act, which sets minimum wages and fringe benefits (paid extras such as health and welfare pay, vacation and holidays) for the workers on the job. You have to price with those rates in mind.",
          "Licensing. In Florida, HVAC, electrical and plumbing contractors need a state license. Cleaning, mowing and basic lawn care don't, but applying fertilizer or pesticide for pay needs certification from the Florida Department of Agriculture and Consumer Services. Every business also needs a local business tax receipt.",
        ],
      },
      { kind: "h2", text: "When it's a good fit" },
      {
        kind: "list",
        items: [
          "You already do this work well for commercial customers and can show it.",
          "You have your license (if your trade needs one), insurance and a local business tax receipt.",
          "You can handle being paid on invoice rather than on the day of the job.",
          "You're willing to read a long document carefully and meet a hard deadline.",
        ],
      },
      { kind: "h2", text: "When to wait" },
      {
        kind: "list",
        items: [
          "Your insurance or license isn't in place yet. Sort those first: agencies check.",
          "You can't carry payroll for a month or two while an invoice is processed.",
          "You're stretched thin. A bid you rush is a bid that gets thrown out.",
        ],
      },
      {
        kind: "p",
        text: "If the good-fit list mostly sounds like you, government work can be a steady part of your business. The next step is knowing where the bids are posted.",
      },
    ],
    sources: [
      { label: "Florida Statutes, s. 218.74 (Local Government Prompt Payment Act: payment within 45 days, interest on late payments)", url: "https://www.flsenate.gov/Laws/Statutes/2025/218.74" },
      { label: "FAR 52.232-25, Prompt Payment (federal due date: 30 days)", url: "https://www.acquisition.gov/far/52.232-25" },
      { label: "U.S. Department of Labor: McNamara-O'Hara Service Contract Act", url: "https://www.dol.gov/agencies/whd/government-contracts/service-contracts" },
      { label: "Florida DBPR: Electrical Contractors, frequently asked questions", url: "https://www2.myfloridalicense.com/electrical-contractors/faqs/" },
      { label: "Florida DBPR: Construction Industry Licensing Board (plumbing and air conditioning contractors)", url: "https://www2.myfloridalicense.com/construction-industry/" },
      { label: "Florida Department of Agriculture and Consumer Services: Pest Control Licensing and Certification (including limited fertilizer certification)", url: "https://www.fdacs.gov/Business-Services/Pest-Control/Licensing-and-Certification" },
      { label: "Duval County Tax Collector: Local Business Tax", url: "https://taxcollector.jacksonville.gov/taxes/local-business-tax" },
    ],
  },
  {
    slug: "where-bids-are-posted",
    title: "Where bids are posted around Jacksonville",
    summary: "Federal, city, county, school and authority bids, and the sites they use.",
    description: "Where Jacksonville-area agencies post bids: SAM.gov, the city, the counties, school districts, JEA, JTA, JAXPORT and the sites they use.",
    step: "learn",
    body: [
      {
        kind: "p",
        text: "There's no single list of every government bid. Each agency posts its own, and many use an outside website to do it. That's the main reason bids are hard to find at first. Once you know where your local agencies post, it gets much easier.",
      },
      { kind: "h2", text: "Federal bids: SAM.gov" },
      {
        kind: "p",
        text: "Federal agencies, including military bases and the VA, post contract opportunities on SAM.gov. Anyone can search the listings there without an account. You can filter by location and by the kind of work, using industry (NAICS) codes. To actually bid on federal work, your business has to be registered in SAM.gov.",
      },
      { kind: "h2", text: "Local agencies and where they post" },
      {
        kind: "p",
        text: "Around Northeast Florida, these are some of the biggest buyers and where they post. Agencies change systems from time to time, so always check the agency's own purchasing page.",
      },
      {
        kind: "list",
        items: [
          "City of Jacksonville: its procurement pages on jacksonville.gov.",
          "Duval County Public Schools: DemandStar and Public Purchase.",
          "Clay County: its OpenGov procurement portal.",
          "St. Johns County: DemandStar, or the new system its purchasing page points to.",
          "St. Johns County School District: VendorLink.",
          "Nassau County: PlanetBids.",
          "JEA: its own procurement pages, with sourcing events in its supplier portal.",
          "JTA (Jacksonville Transportation Authority): its OpenGov procurement portal.",
          "JAXPORT: the active solicitations page on its website.",
          "State of Florida agencies: the state's Vendor Bid System, part of MyFloridaMarketPlace.",
        ],
      },
      {
        kind: "callout",
        title: "Why you can't always see the list",
        text: "Many of these sites only show open bids once you've created a vendor account. For vendors, the accounts on the sites we checked are free. Some also offer paid upgrades, which you don't need to bid. It's worth signing up on the ones your local agencies use.",
      },
      { kind: "h2", text: "Let the bids come to you" },
      {
        kind: "p",
        text: "Checking a dozen websites by hand every week isn't realistic. Many of these systems will email you when a new bid is posted in the categories you pick. When you register, choose the categories that match your trade (for example janitorial services, lawn and grounds maintenance, HVAC maintenance or electrical work) and turn on the email alerts.",
      },
      { kind: "h2", text: "Tips for sorting what you find" },
      {
        kind: "list",
        items: [
          "Check the due date first. If it's in a few days, there may not be time to do it well.",
          "Look for a pre-bid meeting or site visit date. If it's mandatory and it has already passed, you likely can't bid.",
          "Check where the work is. Some bids cover one building; others cover a whole county.",
          "Check the size. A small first job is a good way to learn the process.",
        ],
      },
      {
        kind: "p",
        text: "Once you've found where your agencies post, the next step is getting registered so you can see, and later submit, their bids.",
      },
    ],
    sources: [
      { label: "SAM.gov: contract opportunities", url: "https://sam.gov/opportunities" },
      { label: "City of Jacksonville: Procurement", url: "https://www.jacksonville.gov/departments/office-of-administrative-services/procurement" },
      { label: "Duval County Public Schools: Purchasing", url: "https://www.duvalschools.org/page/purchasing" },
      { label: "Clay County: Formal Bid Solicitations", url: "https://www.claycountygov.com/government/purchasing/formal-bid-solicitations" },
      { label: "St. Johns County: Active Bids", url: "https://www.sjcfl.us/active-bids/" },
      { label: "St. Johns County School District: Open Bids and RFPs", url: "https://www.stjohns.k12.fl.us/purchasing/active/" },
      { label: "Nassau County: Procurement", url: "https://www.nassaucountyfl.com/1442/Procurement" },
      { label: "JEA: Procurement", url: "https://www.jea.com/procurement/" },
      { label: "JTA: Procurement", url: "https://www.jtafla.com/contact-us/business-opportunities/procurement/" },
      { label: "JAXPORT: Active Solicitations", url: "https://www.jaxport.com/procurement/active-solicitations/" },
      { label: "Florida Department of Management Services: Vendor Bid System", url: "https://www.dms.myflorida.com/business_operations/state_purchasing/vendor_bid_system_vbs" },
      { label: "Florida DMS: MyFloridaMarketPlace, understanding the transaction fee", url: "https://www.dms.myflorida.com/content/download/117595/646394/MFMP_U_Vendor_Understanding_the_Transaction_Fee.pdf" },
    ],
  },
  {
    slug: "getting-registered",
    title: "Getting registered",
    summary: "SAM.gov, local vendor accounts, and what to have ready.",
    description: "How to register to bid: SAM.gov for federal work, free vendor accounts for local agencies, and the documents to have ready.",
    step: "ready",
    body: [
      {
        kind: "p",
        text: "Before you can bid, agencies need to know who you are. That means registering as a vendor: once with the federal government if you want federal work, and on the websites your local agencies use. Registering shouldn't cost you anything.",
      },
      { kind: "h2", text: "Federal work: register in SAM.gov" },
      {
        kind: "p",
        text: "To bid on federal contracts, your business must complete a full registration in SAM.gov. You'll get a Unique Entity ID, which identifies your business to the federal government. A few things to know:",
      },
      {
        kind: "list",
        items: [
          "Registration is free. The government never charges to register, update or renew.",
          "It can take up to 10 business days to become active, so don't leave it until you've found a bid.",
          "You must renew every 365 days to stay active.",
          "Getting only a Unique Entity ID, without the full registration, isn't enough to bid on federal contracts.",
          "Free help is available from APEX Accelerators, an official government program for small businesses.",
        ],
      },
      {
        kind: "callout",
        title: "Watch out for registration scams",
        text: "Once you register, you may get emails, calls or official-looking letters saying you must pay to complete, activate or renew your registration. The General Services Administration warns that any email or website asking for money, however official it looks, is not a government message. Check your registration yourself by signing in at SAM.gov directly.",
      },
      { kind: "h2", text: "Local work: vendor accounts" },
      {
        kind: "p",
        text: "Each local agency, or the website it uses, has its own vendor registration. On the systems we checked, vendor accounts are free, though some sites also sell paid upgrades you don't need to bid. To sell to state agencies, register in MyFloridaMarketPlace: registration is free, but the state takes a 1% transaction fee from payments on state contracts. Sign up on the ones your local agencies use, choose the categories that match your trade, and turn on email alerts. Each agency's purchasing page says which system it uses.",
      },
      { kind: "h2", text: "What to have ready" },
      {
        kind: "list",
        items: [
          "Your legal business name and address, exactly as they appear on your IRS records.",
          "Your tax ID (EIN).",
          "Bank account details, for federal registration, so you can be paid.",
          "A local business tax receipt. In Duval County, the Tax Collector issues it, and you need one if you sell goods or services to the public or work as an independent contractor. Other counties and cities have their own.",
          "Your state license, if your trade needs one. In Florida, electrical, air conditioning (HVAC) and plumbing contractors are licensed through the Department of Business and Professional Regulation. Janitorial work and mowing don't need a state license, but applying fertilizer or pesticide for pay needs certification from the Florida Department of Agriculture and Consumer Services.",
          "A certificate of insurance. Many solicitations ask for general liability insurance and set minimum amounts.",
          "Workers' compensation, when Florida law requires it: construction businesses with one or more employees, and other businesses with four or more. Owners who are corporate officers or LLC members count toward those numbers, and can apply for an exemption. HVAC, electrical and plumbing work counts as construction. Many solicitations ask for proof of coverage or of your exemption.",
        ],
      },
      {
        kind: "p",
        text: "Keep digital copies of your license, tax receipt and insurance certificate in one folder. Almost every bid asks for them, and having them ready saves hours.",
      },
      {
        kind: "p",
        text: "With your registrations done and your documents ready, you're set up to bid. The next article walks through your first bid, step by step.",
      },
    ],
    sources: [
      { label: "SAM.gov: Get started with registration and the Unique Entity ID", url: "https://sam.gov/entity-registration" },
      { label: "GSA: Don't take the bait, beware of misleading marketing, imposters and phishing", url: "https://content.govdelivery.com/accounts/USGSA/bulletins/358af1f" },
      { label: "Duval County Tax Collector: Local Business Tax", url: "https://taxcollector.jacksonville.gov/taxes/local-business-tax" },
      { label: "Florida DBPR: Electrical Contractors, frequently asked questions", url: "https://www2.myfloridalicense.com/electrical-contractors/faqs/" },
      { label: "Florida DBPR: Certified Air Conditioning Contractor", url: "https://www.myfloridalicense.com/intentions2.asp?chBoard=true&SID=&boardid=06&professionid=0601" },
      { label: "Florida Department of Financial Services: Workers' Compensation coverage requirements", url: "https://www.myfloridacfo.com/division/wc/employer/coverage-requirements" },
      { label: "Florida DBPR: Construction Industry Licensing Board (plumbing and air conditioning contractors)", url: "https://www2.myfloridalicense.com/construction-industry/" },
      { label: "Florida Department of Agriculture and Consumer Services: Pest Control Licensing and Certification (including limited fertilizer certification)", url: "https://www.fdacs.gov/Business-Services/Pest-Control/Licensing-and-Certification" },
      { label: "Florida DMS: MyFloridaMarketPlace, understanding the transaction fee", url: "https://www.dms.myflorida.com/content/download/117595/646394/MFMP_U_Vendor_Understanding_the_Transaction_Fee.pdf" },
    ],
  },
  {
    slug: "your-first-bid",
    title: "Your first bid, step by step",
    summary: "From finding a bid to hearing back, in order.",
    description: "Your first government bid, step by step: reading it, the dates that matter, site visits, questions, pricing, submitting and what comes after.",
    step: "start",
    body: [
      {
        kind: "p",
        text: "Every bid follows roughly the same path. The dates matter more than anything else, because missing one usually ends your chance. Here's the order, from the moment you find a bid to the moment you hear back.",
      },
      { kind: "h2", text: "Before you decide to bid" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Read all of it. Download the whole solicitation and every addendum, and read them start to finish before deciding. Look for anything you can't do or can't provide.",
          "Write down every date. The questions deadline, any pre-bid meeting or site visit, and the due date and exact time. Put them in your calendar with reminders.",
          "Check what you'll need. Required forms, signatures, license, insurance amounts, references and any bid bond. If you can't meet a requirement, it's usually better to pass.",
        ],
      },
      { kind: "h2", text: "While you prepare" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Go to the pre-bid meeting or site visit. If it's marked mandatory, treat it as required: check the solicitation's wording, because missing it can mean you can't bid. Even when it's optional, seeing the site helps you price it right.",
          "Ask questions the right way. Send them in writing to the contact named in the solicitation, before the questions deadline. Many agencies put a \"cone of silence\" on a bid while it's open: you may only talk to that named contact, and contacting anyone else, such as staff or council members, can get your bid disqualified.",
          "Watch for addenda. Answers and changes come out as addenda. Keep checking until the due date, and acknowledge each one the way the solicitation asks.",
          "Gather the forms. Fill in and sign every required form. Some need a notary.",
          "Price it. Work out your real cost for the whole contract, including labor, supplies, equipment, insurance and overhead, then your profit. On federal service work, your labor cost must meet the wage determination: the Labor Department's list of minimum pay and benefits for each job on that contract.",
          "Check it against the requirements. Go line by line through what the solicitation asks for and make sure your bid answers each one.",
        ],
      },
      { kind: "h2", text: "Submitting" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Submit it exactly the way they ask: online portal, email or sealed envelope, with the labels and number of copies they list.",
          "Submit early. Portals slow down near deadlines and uploads fail. Federal rules generally don't consider late bids, and local agencies usually refuse them too.",
          "Keep a copy of everything you sent and any confirmation you get back.",
        ],
      },
      {
        kind: "callout",
        title: "Late is a no",
        text: "Plan to submit at least a day early. A bid that arrives a minute after the deadline is almost always rejected, however good it is.",
      },
      { kind: "h2", text: "After you submit" },
      {
        kind: "list",
        items: [
          "Bid opening. For sealed bids, the agency often opens and reads out the prices publicly. You can usually attend or watch.",
          "Evaluation. Staff or a committee check each bid for completeness and score proposals against the criteria in the solicitation.",
          "Notice of intended award. Many agencies, including Florida state agencies, post who they plan to award the contract to.",
          "Protest window. If you believe the process was unfair, there's a short window to protest. For Florida state agencies it's 72 hours to file a notice of protest, then 10 days for a formal written protest. Local agencies set their own rules, which are in the solicitation.",
          "Award and contract. The winner signs the contract, provides insurance certificates and gets started.",
        ],
      },
      {
        kind: "p",
        text: "If you don't win, ask for the results or the bid tabulation (the list of every bidder and their price). Seeing the winning price is one of the best ways to price your next bid well.",
      },
    ],
    sources: [
      { label: "FAR 14.304: Submission, modification and withdrawal of bids (late bids)", url: "https://www.acquisition.gov/far/14.304" },
      { label: "Florida Statutes, s. 120.57 (protest deadlines for state agency solicitations)", url: "https://www.flsenate.gov/Laws/Statutes/2025/120.57" },
      { label: "City of Jacksonville: Bid Opening", url: "https://www.jacksonville.gov/departments/office-of-administrative-services/procurement/meetings/bid-opening" },
      { label: "City of Jacksonville Beach, Invitation to Bid 2122-12 (an example of a Cone of Silence clause)", url: "https://jacksonvillebeach.org/DocumentCenter/View/2631/2b_Bid_2122-12-Line-803-Relay-Panel" },
      { label: "U.S. Department of Labor: Service Contract Act (wage determinations)", url: "https://www.dol.gov/agencies/whd/government-contracts/service-contracts" },
    ],
  },
  {
    slug: "before-you-submit",
    title: "Five things to check before submitting",
    summary: "The last-pass checks agencies actually reject bids over.",
    description: "A last-pass checklist before you submit a government bid: page limits, required forms, signatures, addenda and the price form.",
    step: "start",
    body: [
      {
        kind: "p",
        text: "In Florida, a responsive bid is one that conforms in all material respects to the solicitation. In plain words: if you leave out something the agency asked for, your bid can be thrown out before anyone looks at your price. These five checks catch common problems. Do them the day before you submit, not an hour before.",
      },
      { kind: "h2", text: "1. Format and page limits" },
      {
        kind: "p",
        text: "Check every formatting rule: page limits, font size, file type, file names, and how sections must be ordered or tabbed. If there's a page limit, evaluators may simply stop reading at the limit. Check whether the agency wants one combined file or separate files.",
      },
      { kind: "h2", text: "2. Every required form, filled in and signed" },
      {
        kind: "p",
        text: "Make a list of every form the solicitation asks for, then tick each one off against what's in your bid. Common ones include the bid or proposal form, forms many Florida solicitations include, such as a public entity crimes statement or a drug-free workplace form, conflict-of-interest forms and references. Check each form is signed by someone authorized to sign for your business, and notarized where it says so.",
      },
      { kind: "h2", text: "3. Every addendum acknowledged" },
      {
        kind: "p",
        text: "Go back to where the bid is posted and check for addenda one last time. Many solicitations require you to acknowledge each addendum, often on a form or on the bid form itself. Missing one can make your bid non-responsive, and an addendum can quietly change quantities, dates or requirements you priced against.",
      },
      { kind: "h2", text: "4. The price form, complete and correct" },
      {
        kind: "list",
        items: [
          "Every line item filled in, even if the price is zero or the line doesn't apply (follow the instructions for those).",
          "Unit prices times quantities equal the line totals, and the lines add up to the grand total.",
          "Prices entered in the units the form asks for: per month, per year, per visit or lump sum.",
          "Option years priced if the form asks for them.",
          "Nothing written outside the boxes, and no conditions added unless the form allows it.",
        ],
      },
      { kind: "h2", text: "5. How and when to submit" },
      {
        kind: "p",
        text: "Re-read the submission instructions: the method (portal, email or sealed envelope), the exact address or upload location, the due time and time zone, and the labeling on envelopes. If it's a portal, log in a day early and make sure your account works and your files upload.",
      },
      {
        kind: "callout",
        title: "Get a second pair of eyes",
        text: "Fresh eyes spot a missing signature or a wrong total faster than the person who wrote it. It's why every bid we prepare goes back to you to review before you sign.",
      },
    ],
    sources: [
      { label: "Florida Statutes, s. 287.012 (definition of a responsive bid)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.012" },
      { label: "FAR 14.304: Submission, modification and withdrawal of bids", url: "https://www.acquisition.gov/far/14.304" },
      { label: "Florida Statutes, s. 287.133 (public entity crimes)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.133" },
      { label: "Florida Statutes, s. 287.087 (preference to businesses with drug-free workplace programs)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.087" },
    ],
  },
  {
    slug: "compliance-matrix",
    title: "Why a compliance matrix matters",
    summary: "How evaluators score your bid, and how a matrix makes it easy to score well.",
    description: "Evaluators score against the RFP's requirements line by line. A compliance matrix shows them where you meet each one.",
    step: "start",
    body: [
      {
        kind: "p",
        text: "When an agency scores proposals, it isn't reading for the best story. Evaluators have a list of requirements and scoring criteria, taken from the solicitation itself, and they check each proposal against that list. Federal rules say it plainly: proposals are evaluated solely on the factors and subfactors specified in the solicitation. Local agencies work the same way.",
      },
      {
        kind: "p",
        text: "That means the easiest proposal to score well is the one where the evaluator can find, quickly, where you meet each requirement. That's what a compliance matrix is for.",
      },
      { kind: "h2", text: "What a compliance matrix is" },
      {
        kind: "p",
        text: "It's a table. Each row is one requirement from the solicitation. The columns show where the requirement came from (the section or page), whether you meet it, and where in your bid you answer it. Some agencies ask for one; even when they don't, making one is a reliable way to check your own bid before it goes out.",
      },
      { kind: "h2", text: "Why it helps you" },
      {
        kind: "list",
        items: [
          "It catches gaps before you submit. If a requirement has no answer in your bid, you'll see an empty cell, not a rejection letter.",
          "It makes the evaluator's job easy, and an evaluator who finds everything quickly is more likely to give full credit.",
          "It keeps you honest. Every claim has to point to something real: a license, an insurance certificate, a reference, a real process.",
          "It speeds up the next bid. Many requirements repeat from bid to bid, so your answers become reusable.",
        ],
      },
      { kind: "h2", text: "How to build one" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Go through the solicitation and pull out every requirement: every \"must\", \"shall\" and \"required\", plus each scoring criterion and each form.",
          "Put each one in its own row, with the section and page it came from.",
          "For each row, write down how you meet it and where in your bid you show it.",
          "Mark anything you don't meet yet, and decide how to fix it before the due date, or whether to bid at all.",
          "Check the matrix again after every addendum, because addenda can add or change requirements.",
        ],
      },
      {
        kind: "callout",
        title: "How we do it",
        text: "When we prepare a bid, each row of the compliance matrix quotes the exact sentence from the solicitation and the page it's on, so anyone can check it against the real document. If something isn't in the file we have for you, we mark it as a gap rather than guess.",
      },
      {
        kind: "p",
        text: "A strong price wins bids, but only in a proposal that meets every requirement. The matrix is how you make sure yours does.",
      },
    ],
    sources: [
      { label: "FAR 15.305: Proposal evaluation", url: "https://www.acquisition.gov/far/15.305" },
      { label: "Florida Statutes, s. 287.012 (responsive bids and proposals)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.012" },
    ],
  },
];

export function getArticle(slug: string): GuideArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
