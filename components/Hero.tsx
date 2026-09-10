export default function Hero() {
  return (
    <section className="text-center py-24 px-6">


      {/* Badge */}
      <span
        className="
        bg-[var(--home-icon-bg)]
        text-[var(--text-main)]
        px-4
        py-1
        rounded-full
        text-xs
        "
      >
        Our story
      </span>



      {/* Title */}
      <h1
        className="
        text-5xl
        font-black
        max-w-5xl
        mx-auto
        mt-8
        leading-tight
        text-[var(--text-main)]
        "
      >
        WE STARTED RAW SOCIETY BECAUSE TALENT
        <br />
        SHOULDN'T WAIT TO BE DISCOVERED
      </h1>



      {/* Description */}
      <p
        className="
        text-[var(--text-muted)]
        max-w-3xl
        mx-auto
        mt-8
        leading-7
        "
      >
        Every year, thousands of brilliant young writers, photographers,
        editors, and developers go unnoticed—not for lack of skill,
        but lack of access. We built a faster way in.
      </p>


    </section>
  );
}