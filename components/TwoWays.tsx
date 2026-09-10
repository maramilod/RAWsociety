import Link from "next/link";

export default function TwoWays() {
  return (
    <section className="bg-[var(--page-bg)] py-24">

      <div className="max-w-7xl mx-auto px-8">


        {/* Title */}
        <div className="text-center mb-16">

          <h2
            className="
            text-5xl
            font-black
            text-[var(--text-main)]
            uppercase
            "
          >
            One platform, two ways in
          </h2>


          <p
            className="
            mt-4
            text-[var(--text-muted)]
            "
          >
            Pick your side — you can always do both.
          </p>

        </div>




        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8">



          {/* Creator */}

          <div
            className="
            rounded-3xl
            border
            border-[var(--border-soft)]
            bg-[var(--page-bg)]
            p-8
            "
          >


            {/* Icon */}

            <div
              className="
              w-12
              h-12
              rounded-xl
              bg-[var(--icon-bg)]
              mb-8
              flex
              items-center
              justify-center
              "
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="
                w-6
                h-6
                text-[var(--brand-orange)]
                "
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                />

              </svg>

            </div>




            <h3
              className="
              text-4xl
              font-black
              text-[var(--text-main)]
              "
            >
              I'm A Creator
            </h3>




            <p
              className="
              text-[var(--text-muted)]
              mt-5
              leading-7
              "
            >
              Show the world what you make. Create a profile,
              upload your best work, and let clients come to you.
            </p>




            <ul
              className="
              mt-8
              space-y-4
              text-[var(--text-main)]
              "
            >

              <li className="flex items-center gap-3">
                <span className="
                w-2
                h-2
                rounded-full
                bg-[var(--brand-orange)]
                "/>
                Build a portfolio profile in minutes
              </li>


              <li className="flex items-center gap-3">
                <span className="
                w-2
                h-2
                rounded-full
                bg-[var(--brand-orange)]
                "/>
                Get discovered by brands & businesses
              </li>


              <li className="flex items-center gap-3">
                <span className="
                w-2
                h-2
                rounded-full
                bg-[var(--brand-orange)]
                "/>
                Set your rate and manage requests
              </li>

            </ul>




            <Link href="/signup?role=creator" className="w-full">
  <button
    className="
      mt-10
      w-full
      rounded-xl
      bg-[var(--brand-orange)]
      py-4
      text-white
      font-semibold
      hover:bg-[var(--brand-orange-hover)]
      transition
    "
  >
    Create a creator profile
  </button>
</Link>


          </div>







          {/* Client */}

          <div
            className="
            rounded-3xl
            border
            border-[var(--border-soft)]
            bg-[var(--page-bg)]
            p-8
            "
          >


            {/* Icon */}

            <div
              className="
              w-12
              h-12
              rounded-xl
              bg-[var(--icon-bg)]
              mb-8
              flex
              items-center
              justify-center
              "
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="
                w-6
                h-6
                text-[var(--brand-orange)]
                "
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"
                />

              </svg>

            </div>




            <h3
              className="
              text-4xl
              font-black
              text-[var(--text-main)]
              "
            >
              I'm A Client
            </h3>




            <p
              className="
              text-[var(--text-muted)]
              mt-5
              leading-7
              "
            >
              Find the right creative for your next project.
              Browse portfolios, post a brief, and hire with
              confidence.
            </p>




            <ul
              className="
              mt-8
              space-y-4
              text-[var(--text-main)]
              "
            >

              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]"/>
                Browse vetted creative talent
              </li>


              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]"/>
                Post a brief and receive proposals
              </li>


              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]"/>
                Hire and manage projects in one place
              </li>


            </ul>




            <Link href="/signup">

              <button
                className="
                mt-10
                w-full
                rounded-xl
                border-2
                border-[var(--brand-dark)]
                py-4
                font-semibold
                text-[var(--brand-dark)]
                hover:bg-[var(--brand-dark)]
                hover:text-[var(--page-bg)]
                transition
                "
              >
                Create a client profile
              </button>

            </Link>


          </div>


        </div>

      </div>

    </section>
  );
}