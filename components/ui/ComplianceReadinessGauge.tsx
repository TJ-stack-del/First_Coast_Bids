// Real progress bar (same markup pattern as app/(marketing)/quiz/QuizForm.tsx's
// step indicator), not a fake circular "gauge" graphic. Deliberately a
// separate metric from the dashboard's "X% complete" badge
// (lib/compliance/profile-completeness.ts) -- see that file's own comment
// for why the two must never be conflated into one number.
export function ComplianceReadinessGauge({
  percent,
  verifiedCount,
  total,
}: {
  percent: number;
  verifiedCount: number;
  total: number;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-title-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">speed</span>
          Compliance readiness
        </h2>
        <span className="text-title-lg text-on-surface font-bold font-code">{percent}%</span>
      </div>
      <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary-container h-2 rounded-full transition-[width] duration-300 ease-in-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-body-md text-on-surface-variant mt-3">
        {total === 0
          ? "Add a certification, insurance policy, or bond below to start building your readiness score."
          : `${verifiedCount} of ${total} record${total === 1 ? "" : "s"} verified by our team.`}
      </p>
    </div>
  );
}
