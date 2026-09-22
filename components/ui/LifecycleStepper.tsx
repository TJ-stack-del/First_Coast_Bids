// Matches the submission_stage enum in schema.sql, in order.
export const SUBMISSION_STAGES = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "closed",
] as const;

const STAGES = ["Submitted", "In Review", "Deliverables Ready", "Client Review", "Closed"];

// Converts a submissions.stage value into the 1-indexed number this
// component expects (stage 1 = Submitted).
export function stageNumber(stage: string): number {
  const index = SUBMISSION_STAGES.indexOf(stage as (typeof SUBMISSION_STAGES)[number]);
  return index === -1 ? 1 : index + 1;
}

export function LifecycleStepper({ currentStage }: { currentStage: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mt-4">
      {/* Equal columns (not justify-between) so every dot center sits at a
          known fraction of the width -- that's what lets the filled rail
          end exactly on the current stage's dot instead of wherever a long
          label pushed it. The rail runs through the dots' centers (top-4 =
          half the 32px dot), from the first dot's center to the last's. */}
      <div className="grid grid-cols-5 relative">
        <div className="absolute top-4 left-[10%] right-[10%] h-[2px] bg-outline-variant -translate-y-1/2 z-0" />
        {currentStage > 1 && (
          <div className="absolute top-4 left-[10%] right-[10%] h-[2px] -translate-y-1/2 z-0" aria-hidden="true">
            {/* Draws from Submitted to the current stage on load: shows how
                far along the bid is, not just which box is highlighted. */}
            <div
              className="animate-rail-draw h-full bg-primary"
              style={{ width: `${((Math.min(currentStage, STAGES.length) - 1) / (STAGES.length - 1)) * 100}%` }}
            />
          </div>
        )}
        {STAGES.map((label, i) => {
          const stageNum = i + 1;
          const isDone = stageNum < currentStage;
          const isActive = stageNum === currentStage;
          return (
            <div key={label} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-label-md font-bold border-4 border-surface-container-lowest ${
                  isDone
                    ? "bg-tertiary-fixed text-on-tertiary-fixed"
                    : isActive
                    ? "bg-primary-container text-on-primary-container shadow-[0_0_0_2px_rgb(var(--color-primary))]"
                    : "bg-surface text-outline border-2 border-outline-variant"
                }`}
              >
                {stageNum}
              </div>
              <span
                // Phones: five equal columns are ~60px wide, too narrow for
                // "Deliverables" -- labels overlapped their neighbours. Only
                // the current stage is named there (the dots still show the
                // position); all five labels return from xl up (at lg, 1024px, the
                // closest pair sat only 3px apart; at xl the gap is ~21px).
                className={`text-label-md text-center ${
                  isActive ? "text-primary font-bold" : "hidden xl:block text-on-surface-variant"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
