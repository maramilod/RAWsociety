const stats = [
  {
    number: "2,400+",
    label: "Creators on the platform",
  },
  {
    number: "180+",
    label: "Brands hired through RAW",
  },
  {
    number: "48 HRS",
    label: "Avg. time to first match",
  },
  {
    number: "32",
    label: "Countries represented",
  },
];

export default function Stats() {
  return (
    <section
      className="
      max-w-6xl
      mx-auto
      py-12
      grid
      grid-cols-2
      md:grid-cols-4
      gap-10
      text-center
      "
    >

      {stats.map((item) => (

        <div key={item.number}>


          <h2
            className="
            text-4xl
            font-black
            text-[var(--text-main)]
            "
          >
            {item.number}
          </h2>



          <p
            className="
            text-[var(--text-muted)]
            mt-3
            text-sm
            "
          >
            {item.label}
          </p>


        </div>

      ))}

    </section>
  );
}