import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Features from "@/components/Features";
import CTA from "@/components/CTA";
import TwoWays from "@/components/TwoWays";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
export default function Home() {
  return (
    <main className="bg-[var(--background)]
 min-h-screen text-[var(--foreground)]
">
      <Navbar />

      <Hero />

      <Stats />

      <Features />
      <TwoWays />

      <CTA />
     
      <Footer />
      <BackToTop />

    </main>
  );
}