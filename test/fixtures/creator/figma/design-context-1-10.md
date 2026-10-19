Reference code for node 1:10 "Hero/Default" (React + Tailwind). Adapt it to the project; do not copy classes.

export default function HeroDefault() {
  return (
    <section className="bg-white px-[120px] py-[80px] flex gap-12 items-center">
      <div className="flex flex-col gap-4">
        <h1 className="font-['Inter'] font-bold text-[56px] leading-[64px] text-[var(--color-ink,#111827)]">Acme ships faster</h1>
        <p className="font-['Inter'] text-[18px] text-[var(--color-muted,#4b5563)]">Plan, build and launch in one place.</p>
        <a href="https://acme.test/signup" className="bg-[var(--color-brand,#0a84ff)] text-white px-6 py-3">Start free</a>
      </div>
      <img src="https://acme.test/hero.png" alt="Acme dashboard" className="w-[520px] h-[420px]" />
    </section>
  );
}

Variables used: color/ink, color/muted, color/brand. Component instance: Button/Primary (1:13).
