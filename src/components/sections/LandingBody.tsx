"use client";

import { useSiteContent } from "@/src/context/SiteContentContext";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import Hero from "./Hero";
import Services from "./Services";
import BeforeAfter from "./BeforeAfter";
import AiDesignPreview from "./AiDesignPreview";
import Process from "./Process";
import Testimonials from "./Testimonials";
import Faq from "./Faq";
import VirtualTour from "../tours/VirtualTour";

export default function LandingBody() {
  const { isVisible } = useSiteContent();
  return (
    <main>
      <Navbar />
      <Hero />
      <Services />
      {isVisible("beforeAfter") && <BeforeAfter />}
      {isVisible("aiDesign") && <AiDesignPreview />}
      {isVisible("process") && <Process />}
      {isVisible("tours") && <VirtualTour />}
      {isVisible("reviews") && <Testimonials />}
      {isVisible("faq") && <Faq />}
      <Footer />
    </main>
  );
}
