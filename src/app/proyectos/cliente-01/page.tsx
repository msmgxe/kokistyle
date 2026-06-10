import type { Metadata } from "next";

import Footer from "@/src/components/layout/Footer";
import Navbar from "@/src/components/layout/Navbar";
import Cliente01Showcase from "@/src/components/projects/Cliente01Showcase";
import { LanguageProvider } from "@/src/context/LanguageContext";

export const metadata: Metadata = {
  title: "Cliente 01 · Remodelación de Baño 360° | KokiStyle Remodeling",
  description:
    "Showcase de remodelación de baño 2.00 × 2.50 m: tour virtual 360° con puntos de observación, diseño verde salvia con bronce, materiales, dimensiones y presupuesto para Miami / Boca Raton.",
};

export default function Cliente01Page() {
  return (
    <LanguageProvider>
      <main>
        <Navbar />
        <Cliente01Showcase />
        <Footer />
      </main>
    </LanguageProvider>
  );
}
