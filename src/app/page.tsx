import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import BeforeAfter from "../components/sections/BeforeAfter";
import Hero from "../components/sections/Hero";
import Services from "../components/sections/Services";
import AiDesignPreview from "../components/sections/AiDesignPreview";
import Process from "../components/sections/Process";
import Testimonials from "../components/sections/Testimonials";
import Faq from "../components/sections/Faq";
import VirtualTour from "../components/tours/VirtualTour";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Services />
      <BeforeAfter />
      <AiDesignPreview />
      <Process />
      <VirtualTour />
      <Testimonials />
      <Faq />
      <Footer />
    </main>
  );
}
