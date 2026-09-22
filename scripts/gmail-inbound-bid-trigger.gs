// Google Apps Script — polls a Gmail label for new bid-notification emails
// (forwarded from IONOS to bids@firstcoastbids.com, which should point at a
// real Gmail inbox/alias -- bidpulse.co is being fully decommissioned,
// 30-day sunset as of 2026-09-22, do not set up anything new against it)
// and POSTs each one to First Coast Bids' inbound-bid-email webhook. Runs
// on a time-driven trigger, not a real-time push — Apps Script has no
// native "new email arrived" event for a plain Gmail label.
//
// Setup (see README.md in this same directory for the full walkthrough):
//   1. Paste this file's contents into script.google.com as a new project
//      bound to the Gmail account that receives bids@firstcoastbids.com mail.
//   2. Set the two script properties below (File > Project properties >
//      Script properties, or Apps Script's PropertiesService UI):
//        WEBHOOK_URL    -> https://<your-vercel-domain>/api/inbound-bid-email
//        WEBHOOK_SECRET -> same value as Vercel's INBOUND_BID_EMAIL_SECRET
//   3. Create a Gmail label named "BidPulse/Inbound" (or change LABEL_NAME
//      below) and a Gmail filter that applies it to mail landing at
//      bids@firstcoastbids.com.
//   4. Add a time-driven trigger for processInboundBidEmails, e.g. every
//      15 minutes (Apps Script editor: Triggers > Add Trigger).

const LABEL_NAME = "BidPulse/Inbound";
const PROCESSED_LABEL_NAME = "BidPulse/Inbound/Processed";

function processInboundBidEmails() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty("WEBHOOK_URL");
  const webhookSecret = props.getProperty("WEBHOOK_SECRET");

  if (!webhookUrl || !webhookSecret) {
    throw new Error("Set WEBHOOK_URL and WEBHOOK_SECRET in Script properties first.");
  }

  const label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    throw new Error(`Gmail label "${LABEL_NAME}" doesn't exist yet — create it and the filter that applies it first.`);
  }

  const processedLabel =
    GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME) || GmailApp.createLabel(PROCESSED_LABEL_NAME);

  // Unread within the label = "not yet sent to BidPulse." Marking read
  // (not deleting/archiving) after a successful POST is what prevents the
  // same email from being resent on the next run.
  const threads = label.getThreads();

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      if (!message.isUnread()) return;

      const payload = {
        from: message.getFrom(),
        subject: message.getSubject(),
        body: message.getPlainBody(),
      };

      const response = UrlFetchApp.fetch(webhookUrl, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${webhookSecret}` },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        message.markRead();
        thread.addLabel(processedLabel);
      } else {
        // Left unread on purpose — a failed send (extraction error, secret
        // mismatch, Vercel hiccup) should retry on the next trigger run
        // rather than silently disappearing.
        console.error(`Inbound bid email webhook returned ${status}: ${response.getContentText()}`);
      }
    });
  });
}
