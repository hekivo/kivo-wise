Reference code for node 1:20 "Features" (React + Tailwind).

export default function Features() {
  return (
    <section className="bg-[var(--color-surface,#f5f7fa)] px-[120px] py-[64px] text-center">
      <h2 className="font-bold text-[36px] text-[var(--color-ink,#111827)]">Why Acme</h2>
      <div className="grid grid-cols-3 gap-8">
        <div><h3 className="font-bold text-[20px]">Plan</h3><p className="text-[16px]">Roadmaps everyone can read.</p></div>
        <div><h3 className="font-bold text-[20px]">Build</h3><p className="text-[16px]">Reviews that do not block.</p></div>
        <div><h3 className="font-bold text-[20px]">Launch</h3><p className="text-[16px]">Releases on a schedule.</p></div>
      </div>
    </section>
  );
}

Component instances: Feature Card (1:22, 1:23, 1:24).
