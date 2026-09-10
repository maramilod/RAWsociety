const cards = [
  {
    title: "Young talent, first",
    body: "We built RAW for creatives early in their careers—not yet a long resume.",
  },
  {
    title: "Speed without the rush",
    body: "Fast matching doesn't mean rushed work. Every creator is vetted before they appear.",
  },
  {
    title: "Real work, real pricing",
    body: "No hidden fees. No bidding wars. What's on a profile is what you pay.",
  },
  {
    title: "Built by creators too",
    body: "Our team has sat on both sides of the table hiring talent and being hired.",
  },
];

export default function Features() {
  return (
    <section
      className="
      py-24
      bg-[var(--white)]
      "
    >

      <h2
        className="
        text-center
        text-4xl
        font-black
        mb-16
        text-[var(--text-main)]
        "
      >
        HOW WE WORK
      </h2>


      <div
        className="
        max-w-7xl
        mx-auto
        grid
        md:grid-cols-4
        gap-6
        px-8
        "
      >

        {cards.map((card) => (

          <div
            key={card.title}
            className="
            rounded-2xl
            bg-[var(--home-card-bg)]
            border
            border-[var(--home-card-border)]
            p-8
            "
          >

            <h3
              className="
              font-bold
              uppercase
              mb-5
              text-[var(--text-main)]
              "
            >
              {card.title}
            </h3>


            <p
              className="
              text-[var(--text-muted)]
              text-sm
              leading-6
              "
            >
              {card.body}
            </p>


          </div>

        ))}

      </div>

    </section>
  );
}