import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import EstimateBuilder from "../components/estimate/EstimateBuilder";
import BeforeAfter from "../components/sections/BeforeAfter";
import Hero from "../components/sections/Hero";
import Services from "../components/sections/Services";
import VirtualTour from "../components/tours/VirtualTour";
import { LanguageProvider } from "../context/LanguageContext";

export default function Home() {
  return (
    <LanguageProvider>
      <main>
        <Navbar />
        <Hero />
        <Services />
        <BeforeAfter />
        <VirtualTour />
        <EstimateBuilder />
        <Footer />
      </main>
    </LanguageProvider>
  );
}
