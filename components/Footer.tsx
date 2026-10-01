export default function Footer() {
  return (
    <footer
      className="
      py-20
      bg-[var(--page-bg)]
      shadow-[0_-12px_35px_rgba(53,37,36,0.04)]
      "
    >

      <div className="max-w-7xl mx-auto px-8">

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr_1fr_1fr] gap-12">


          {/* RAW */}
          <div className="flex items-start">

            <div
              className="
              font-logo
              text-5xl
              font-light
              leading-8
              tracking-wide
              opacity-20
              "
            >
              <div>RAW</div>
              <div>society</div>
            </div>

          </div>




          {/* Links wrapper */}

          <div className="grid grid-cols-3 gap-6 lg:contents">


            {/* Platform */}

            <div className="flex flex-col items-start gap-3">

              <h4 className="font-bold text-[var(--text-main)]">
                Platform
              </h4>


              <ul
                className="
                flex
                flex-col
                gap-2
                text-[var(--text-muted)]
                "
              >
                <li>Browse</li>
                <li>How it works</li>
                <li>Creators</li>
              </ul>

            </div>





            {/* Company */}

            <div className="flex flex-col items-start gap-3">

              <h4 className="font-bold text-[var(--text-main)]">
                Company
              </h4>


              <ul
                className="
                flex
                flex-col
                gap-2
                text-[var(--text-muted)]
                "
              >
                <li>About</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>

            </div>





            {/* Legal */}

            <div className="flex flex-col items-start gap-3">

              <h4 className="font-bold text-[var(--text-main)]">
                Legal
              </h4>


              <ul
                className="
                flex
                flex-col
                gap-2
                text-[var(--text-muted)]
                "
              >
                <li>Privacy</li>
                <li>Terms</li>
              </ul>

            </div>


          </div>


        </div>


      </div>





      {/* Copyright */}

      <div
        className="
        max-w-7xl
        mx-auto
        px-8
        mt-16
        pt-8
        border-t
        border-[var(--border-default)]
        "
      >

        <div
          className="
          text-center
          text-sm
          text-[var(--text-muted)]
          opacity-60
          "
        >
          © 2026 RAW Society. All rights reserved.
        </div>


      </div>


    </footer>
  );
}