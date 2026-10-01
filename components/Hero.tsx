import FilmStrip from "@/components/FilmStrip";

export default function Hero() {
  return (
    <section
      className="
      relative
      px-6
      pt-20
      pb-16
      text-center
      md:pt-28
      md:pb-24
      "
    >
      {/* Badge */}
      <span
        className="
        inline-block
        rounded-full
        bg-[var(--hero-badge-bg)]
        px-6
        py-2
        text-sm
        font-medium
        text-[var(--text-main)]
        "
      >
        For brands, businesses &amp; creators
      </span>

      {/* Title */}
      <h1
        className="
        mx-auto
        mt-8
        max-w-4xl
        text-4xl
        leading-tight
        text-[var(--text-main)]
        md:text-6xl
        "
      >
        Find young creative talent — fast
      </h1>

      {/* Subcopy */}
      <p
        className="
        mx-auto
        mt-6
        max-w-2xl
        text-lg
        text-[var(--text-muted)]
        md:text-xl
        "
      >
        Connect with skilled writers, photographers, designers, and more.
        Subscribe to unlock unlimited hires.
      </p>

      {/* Film strip */}
      <div className="mt-12">
        <FilmStrip />
      </div>
    </section>
  );
}
