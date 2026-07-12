import { SiteContentProvider } from "@/src/context/SiteContentContext";
import LandingBody from "../components/sections/LandingBody";

export default function Home() {
  return (
    <SiteContentProvider>
      <LandingBody />
    </SiteContentProvider>
  );
}
