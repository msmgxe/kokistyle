import type { Language } from "./translations";

export interface MaterialItem {
  area: string;
  name: string;
  spec: string;
  dimensions: string;
  swatch: string;
}

export interface PaletteColor {
  hex: string;
  name: string;
  usage: string;
}

export interface BudgetLine {
  item: string;
  range: string;
}

export interface BudgetPackage {
  tag: string;
  name: string;
  range: string;
  description: string;
  features: string[];
  highlighted: boolean;
}

const en = {
  meta: {
    title: "Client 01 · Bathroom Remodel — KokiStyle",
    description:
      "Full bathroom remodel showcase: 360° virtual tour, sage green tile design, materials, dimensions, and Miami / Boca Raton budget packages.",
  },
  hero: {
    eyebrow: "Client 01 · Project Showcase",
    title: "Bathroom Remodel — Sage Green Spa Concept",
    location: "Miami / Boca Raton, FL",
    size: "2.00 m × 2.50 m (6'7\" × 8'2\") · 5 m² / 54 sq ft",
    description:
      "Complete transformation of a 5 m² bathroom: vertical sage green subway tile, brushed brass fixtures, warm oak vanity and an open walk-in shower. Explore the space in interactive 360° from the same standing points a buyer would use.",
    ctaTour: "Explore 360° Tour",
    ctaBudget: "View Budget",
  },
  photos: {
    eyebrow: "Starting Point",
    title: "Current bathroom & design inspiration",
    description:
      "The existing bathroom features a corner glass shower, Hollywood-style vanity and a toilet behind a pony wall. The design direction comes from a spa-inspired palette: sage green stacked tile, brass hardware and warm wood.",
    beforeLabel: "Current Condition",
    beforeCaption: "Existing bathroom — beige tile, corner shower cabin, pony wall",
    inspirationLabel: "Design Inspiration",
    inspirationCaption: "Sage green vertical tile · brass fixtures · oak vanity",
  },
  viewer: {
    eyebrow: "Interactive Experience",
    title: "360° Virtual Tour with viewing points",
    description:
      "Drag to look around, scroll to zoom, and jump between the standing points marked on the floor plan — just like a real-estate virtual tour. Press play for an automatic cinematic walkthrough.",
    tabCurrent: "Current Layout",
    tabProposed: "Proposed Design",
    badgeCurrent: "Current Layout",
    badgeProposed: "Proposed Design",
    hint: "Drag to look around · Scroll to zoom",
    tourPlay: "Cinematic tour",
    tourStop: "Stop tour",
    labelsShow: "Show labels",
    labelsHide: "Hide labels",
    minimapTitle: "Viewing points",
    viewpoints: {
      entrance: "Entrance",
      center: "Center",
      shower: "Shower",
      vanity: "Vanity",
    },
    sceneLabels: {
      shower: "Walk-in shower",
      showerCurrent: "Shower cabin",
      vanity: "Oak vanity",
      vanityCurrent: "Vanity + mirror",
      toilet: "Toilet",
      door: "Entry door",
    },
  },
  materials: {
    eyebrow: "Specifications",
    title: "Selected materials & finish dimensions",
    description:
      "Every finish was selected to match the inspiration palette and the real 2.00 × 2.50 m footprint of the room.",
    dimensionLabel: "Dimensions",
    items: [
      {
        area: "Walls",
        name: "Sage Green Subway Tile",
        spec: "Vertical stacked ceramic, satin glaze, light grout",
        dimensions: "10 × 20 cm (4×8\") tiles · ≈ 19.6 m² wall area · height 2.40 m",
        swatch: "#8BA890",
      },
      {
        area: "Floor",
        name: "Calacatta-Look Porcelain",
        spec: "Large format, rectified edges, matte anti-slip finish",
        dimensions: "60 × 60 cm (24×24\") · 5 m² + 1 m² waste",
        swatch: "#E8E4D8",
      },
      {
        area: "Walk-in Shower",
        name: "Open Spa Shower",
        spec: "Curbless tray, ceiling rain head + brass hand shower, tiled niche",
        dimensions: "1.40 × 0.80 m area · rain head Ø 25 cm at 2.30 m · niche 32 × 14 cm",
        swatch: "#C8F0EB",
      },
      {
        area: "Vanity",
        name: "Warm Oak Floating Vanity",
        spec: "Solid oak doors, quartz countertop, white ceramic vessel sink",
        dimensions: "100 × 50 cm, height 86 cm · sink Ø 36 cm",
        swatch: "#7D5A3C",
      },
      {
        area: "Mirror & Lighting",
        name: "Brass-Framed LED Mirror",
        spec: "Backlit LED strip 3000K, brass frame, demister pad",
        dimensions: "92 × 88 cm · mounted at 1.00–1.88 m",
        swatch: "#C9A840",
      },
      {
        area: "Fixtures",
        name: "Brushed Brass Hardware",
        spec: "Faucet, shower valve, towel bar, paper holder, door handle",
        dimensions: "Towel bar 60 cm at 1.20 m · faucet spout reach 12 cm",
        swatch: "#C9A840",
      },
      {
        area: "Toilet",
        name: "White Elongated Toilet",
        spec: "Two-piece porcelain, soft-close seat, dual flush brass button",
        dimensions: "70 × 40 cm footprint · seat height 42 cm",
        swatch: "#F5F3EF",
      },
      {
        area: "Doors",
        name: "White Panel Doors",
        spec: "Entry door + double closet doors, satin nickel→brass hardware swap",
        dimensions: "Entry 0.80 × 2.10 m · closet 2 × 0.55 × 2.10 m",
        swatch: "#F9F7F4",
      },
    ] as MaterialItem[],
  },
  palette: {
    eyebrow: "Color Story",
    title: "Project color palette",
    description:
      "A spa-inspired palette taken directly from the inspiration image: sage green as the protagonist, balanced with warm neutrals and brass accents.",
    colors: [
      { hex: "#8BA890", name: "Sage Green", usage: "Wall tile — shower & main walls" },
      { hex: "#E8E4D8", name: "Calacatta Cream", usage: "Porcelain floor & countertop" },
      { hex: "#C9A840", name: "Brushed Brass", usage: "Faucets, frames & hardware" },
      { hex: "#7D5A3C", name: "Warm Oak", usage: "Vanity cabinet" },
      { hex: "#F5F3EF", name: "Porcelain White", usage: "Toilet, sink & ceiling" },
      { hex: "#0F3D56", name: "KokiStyle Navy", usage: "Presentation accents" },
    ] as PaletteColor[],
  },
  plan: {
    eyebrow: "Floor Plan",
    title: "Dimensions — 2.00 m × 2.50 m",
    description:
      "Proposed distribution: open walk-in shower along the back wall, floating oak vanity on the right wall, and the toilet relocated to a private corner. Ceiling height 2.40 m.",
    legend: [
      "Walk-in shower 1.40 × 0.80 m",
      "Oak vanity 1.00 × 0.50 m",
      "Toilet zone 0.80 × 0.75 m",
      "Entry door 0.80 m",
      "Circulation ≥ 0.60 m",
    ],
    planLabels: {
      shower: "WALK-IN SHOWER",
      vanity: "VANITY",
      toilet: "WC",
      door: "DOOR",
      niche: "Niche",
    },
  },
  budget: {
    eyebrow: "Investment",
    title: "Estimated budget — Miami / Boca Raton",
    description:
      "Three packages based on 2026 South Florida pricing for a full 5 m² (54 sq ft) bathroom remodel, including labor, materials and standard permits in Miami-Dade / Palm Beach County.",
    perNote: "All prices in USD",
    recommended: "Recommended — matches this design",
    packages: [
      {
        tag: "Essential",
        name: "Refresh",
        range: "$14,500 – $18,900",
        description:
          "Keep the current layout, replace every finish: new tile, vanity, toilet and shower glass with standard-grade fixtures.",
        features: [
          "Same layout (no plumbing relocation)",
          "Ceramic tile walls & porcelain floor",
          "Prefab vanity 90 cm with mirror",
          "New framed shower glass cabin",
          "Standard chrome or black fixtures",
        ],
        highlighted: false,
      },
      {
        tag: "Premium",
        name: "Sage Spa Design",
        range: "$19,800 – $26,500",
        description:
          "The exact design shown in this showcase: walk-in shower conversion, sage subway tile, brass fixtures and custom oak vanity.",
        features: [
          "Walk-in shower conversion (curbless)",
          "Sage green subway tile 10×20 vertical",
          "Calacatta porcelain 60×60 floor",
          "Custom oak vanity + quartz top",
          "Brushed brass fixtures & LED mirror",
          "Waterproofing (Schluter-type system)",
        ],
        highlighted: true,
      },
      {
        tag: "Luxury",
        name: "Full Spa Suite",
        range: "$28,000 – $38,500",
        description:
          "Everything in Premium plus comfort upgrades for a high-end Boca Raton finish level.",
        features: [
          "Frameless glass partition",
          "Heated porcelain floor",
          "Smart toilet with bidet seat",
          "Ceiling rain + body sprays",
          "Custom storage & lighting scenes",
        ],
        highlighted: false,
      },
    ] as BudgetPackage[],
    breakdownTitle: "Premium package — line item breakdown",
    breakdown: [
      { item: "Demolition & debris removal", range: "$1,800 – $2,400" },
      { item: "Plumbing (walk-in conversion + relocations)", range: "$2,600 – $3,500" },
      { item: "Electrical & LED lighting", range: "$1,200 – $1,800" },
      { item: "Waterproofing & substrate prep", range: "$900 – $1,400" },
      { item: "Wall & floor tile (material + labor)", range: "$4,500 – $6,200" },
      { item: "Walk-in shower (tray, glass, rain head)", range: "$3,200 – $4,300" },
      { item: "Oak vanity + quartz countertop + sink", range: "$2,400 – $3,200" },
      { item: "Toilet, faucets & brass accessories", range: "$1,700 – $2,600" },
      { item: "Paint, ceiling & finish carpentry", range: "$800 – $1,200" },
      { item: "Permits (Miami-Dade / Palm Beach)", range: "$700 – $900" },
    ] as BudgetLine[],
    disclaimer:
      "Conceptual estimate based on average South Florida 2026 contractor pricing. Final proposal requires an on-site technical visit, material confirmation and HOA/permit review.",
    cta: "Request formal estimate",
  },
  cta: {
    title: "Ready to build this bathroom?",
    description:
      "Schedule a site visit in Miami or Boca Raton and receive a formal line-item proposal within 48 hours.",
    primary: "Start my estimate",
    secondary: "Back to home",
  },
};

const es: typeof en = {
  meta: {
    title: "Cliente 01 · Remodelación de Baño — KokiStyle",
    description:
      "Showcase de remodelación de baño: tour virtual 360°, diseño en verde salvia, materiales, dimensiones y paquetes de presupuesto para Miami / Boca Raton.",
  },
  hero: {
    eyebrow: "Cliente 01 · Showcase de Proyecto",
    title: "Remodelación de Baño — Concepto Spa Verde Salvia",
    location: "Miami / Boca Raton, FL",
    size: "2.00 m × 2.50 m (6'7\" × 8'2\") · 5 m² / 54 pies²",
    description:
      "Transformación completa de un baño de 5 m²: azulejo subway verde salvia en colocación vertical, grifería de bronce cepillado, vanidad de roble cálido y ducha walk-in abierta. Explora el espacio en 360° interactivo desde los mismos puntos donde se pararía un comprador.",
    ctaTour: "Explorar Tour 360°",
    ctaBudget: "Ver Presupuesto",
  },
  photos: {
    eyebrow: "Punto de Partida",
    title: "Baño actual e inspiración de diseño",
    description:
      "El baño existente tiene cabina de ducha esquinera, vanidad estilo Hollywood e inodoro tras media pared. La dirección de diseño viene de una paleta tipo spa: azulejo verde salvia apilado, herrajes de bronce y madera cálida.",
    beforeLabel: "Condición Actual",
    beforeCaption: "Baño existente — azulejo beige, cabina esquinera, media pared",
    inspirationLabel: "Inspiración de Diseño",
    inspirationCaption: "Azulejo vertical verde salvia · grifería bronce · vanidad roble",
  },
  viewer: {
    eyebrow: "Experiencia Interactiva",
    title: "Tour Virtual 360° con puntos de observación",
    description:
      "Arrastra para mirar alrededor, usa la rueda para hacer zoom y salta entre los puntos marcados en el plano — como en un tour inmobiliario real. Presiona play para un recorrido cinemático automático.",
    tabCurrent: "Distribución Actual",
    tabProposed: "Diseño Propuesto",
    badgeCurrent: "Distribución Actual",
    badgeProposed: "Diseño Propuesto",
    hint: "Arrastra para girar · Rueda para zoom",
    tourPlay: "Tour cinemático",
    tourStop: "Detener tour",
    labelsShow: "Ver etiquetas",
    labelsHide: "Ocultar etiquetas",
    minimapTitle: "Puntos de observación",
    viewpoints: {
      entrance: "Entrada",
      center: "Centro",
      shower: "Ducha",
      vanity: "Vanidad",
    },
    sceneLabels: {
      shower: "Ducha walk-in",
      showerCurrent: "Cabina de ducha",
      vanity: "Vanidad de roble",
      vanityCurrent: "Vanidad + espejo",
      toilet: "Inodoro",
      door: "Puerta de entrada",
    },
  },
  materials: {
    eyebrow: "Especificaciones",
    title: "Materiales elegidos y dimensiones de acabados",
    description:
      "Cada acabado fue seleccionado para coincidir con la paleta de inspiración y la huella real de 2.00 × 2.50 m de la habitación.",
    dimensionLabel: "Dimensiones",
    items: [
      {
        area: "Paredes",
        name: "Subway Verde Salvia",
        spec: "Cerámica apilada vertical, esmalte satinado, fragua clara",
        dimensions: "Piezas 10 × 20 cm · ≈ 19.6 m² de pared · altura 2.40 m",
        swatch: "#8BA890",
      },
      {
        area: "Piso",
        name: "Porcelanato tipo Calacatta",
        spec: "Gran formato, bordes rectificados, acabado mate antideslizante",
        dimensions: "60 × 60 cm · 5 m² + 1 m² de merma",
        swatch: "#E8E4D8",
      },
      {
        area: "Ducha Walk-in",
        name: "Ducha Abierta tipo Spa",
        spec: "Plato a ras de piso, regadera de lluvia + teléfono de bronce, nicho enchapado",
        dimensions: "Área 1.40 × 0.80 m · regadera Ø 25 cm a 2.30 m · nicho 32 × 14 cm",
        swatch: "#C8F0EB",
      },
      {
        area: "Vanidad",
        name: "Mueble Flotante de Roble Cálido",
        spec: "Puertas de roble macizo, tope de cuarzo, lavabo blanco tipo vessel",
        dimensions: "100 × 50 cm, alto 86 cm · lavabo Ø 36 cm",
        swatch: "#7D5A3C",
      },
      {
        area: "Espejo e Iluminación",
        name: "Espejo LED con Marco de Bronce",
        spec: "Retroiluminación LED 3000K, marco de bronce, antiempañante",
        dimensions: "92 × 88 cm · montado entre 1.00–1.88 m",
        swatch: "#C9A840",
      },
      {
        area: "Grifería",
        name: "Herrajes de Bronce Cepillado",
        spec: "Grifo, válvula de ducha, toallero, portarrollos, manija de puerta",
        dimensions: "Toallero 60 cm a 1.20 m · alcance del grifo 12 cm",
        swatch: "#C9A840",
      },
      {
        area: "Inodoro",
        name: "Inodoro Alargado Blanco",
        spec: "Porcelana dos piezas, asiento de cierre suave, doble descarga con botón de bronce",
        dimensions: "Huella 70 × 40 cm · altura de asiento 42 cm",
        swatch: "#F5F3EF",
      },
      {
        area: "Puertas",
        name: "Puertas Blancas de Paneles",
        spec: "Puerta de entrada + clóset doble, cambio de herrajes a bronce",
        dimensions: "Entrada 0.80 × 2.10 m · clóset 2 × 0.55 × 2.10 m",
        swatch: "#F9F7F4",
      },
    ] as MaterialItem[],
  },
  palette: {
    eyebrow: "Historia de Color",
    title: "Paleta de colores del proyecto",
    description:
      "Una paleta tipo spa tomada directamente de la imagen de inspiración: verde salvia como protagonista, balanceado con neutros cálidos y acentos de bronce.",
    colors: [
      { hex: "#8BA890", name: "Verde Salvia", usage: "Azulejo de paredes — ducha y muros principales" },
      { hex: "#E8E4D8", name: "Crema Calacatta", usage: "Porcelanato de piso y tope" },
      { hex: "#C9A840", name: "Bronce Cepillado", usage: "Grifería, marcos y herrajes" },
      { hex: "#7D5A3C", name: "Roble Cálido", usage: "Mueble de vanidad" },
      { hex: "#F5F3EF", name: "Blanco Porcelana", usage: "Inodoro, lavabo y techo" },
      { hex: "#0F3D56", name: "Navy KokiStyle", usage: "Acentos de presentación" },
    ] as PaletteColor[],
  },
  plan: {
    eyebrow: "Plano de Planta",
    title: "Dimensiones — 2.00 m × 2.50 m",
    description:
      "Distribución propuesta: ducha walk-in abierta en la pared trasera, vanidad flotante de roble en la pared derecha e inodoro reubicado en esquina privada. Altura de techo 2.40 m.",
    legend: [
      "Ducha walk-in 1.40 × 0.80 m",
      "Vanidad de roble 1.00 × 0.50 m",
      "Zona de inodoro 0.80 × 0.75 m",
      "Puerta de entrada 0.80 m",
      "Circulación ≥ 0.60 m",
    ],
    planLabels: {
      shower: "DUCHA WALK-IN",
      vanity: "VANIDAD",
      toilet: "WC",
      door: "PUERTA",
      niche: "Nicho",
    },
  },
  budget: {
    eyebrow: "Inversión",
    title: "Presupuesto estimado — Miami / Boca Raton",
    description:
      "Tres paquetes basados en precios 2026 del sur de Florida para la remodelación completa de un baño de 5 m² (54 pies²), incluyendo mano de obra, materiales y permisos estándar en Miami-Dade / Palm Beach County.",
    perNote: "Todos los precios en USD",
    recommended: "Recomendado — corresponde a este diseño",
    packages: [
      {
        tag: "Essential",
        name: "Renovación",
        range: "$14,500 – $18,900",
        description:
          "Mantiene la distribución actual y reemplaza todos los acabados: azulejo, vanidad, inodoro y vidrio de ducha con línea estándar.",
        features: [
          "Misma distribución (sin mover plomería)",
          "Cerámica en paredes y porcelanato en piso",
          "Vanidad prefabricada 90 cm con espejo",
          "Nueva cabina de ducha con marco",
          "Grifería estándar cromo o negro",
        ],
        highlighted: false,
      },
      {
        tag: "Premium",
        name: "Diseño Spa Salvia",
        range: "$19,800 – $26,500",
        description:
          "El diseño exacto de este showcase: conversión a ducha walk-in, subway verde salvia, grifería de bronce y vanidad de roble a medida.",
        features: [
          "Conversión a ducha walk-in (a ras de piso)",
          "Subway verde salvia 10×20 vertical",
          "Porcelanato Calacatta 60×60 en piso",
          "Vanidad de roble a medida + tope de cuarzo",
          "Grifería de bronce cepillado y espejo LED",
          "Impermeabilización (sistema tipo Schluter)",
        ],
        highlighted: true,
      },
      {
        tag: "Luxury",
        name: "Suite Spa Completa",
        range: "$28,000 – $38,500",
        description:
          "Todo lo del Premium más mejoras de confort para un nivel de acabado alto de Boca Raton.",
        features: [
          "Mampara de vidrio sin marco",
          "Piso porcelánico con calefacción",
          "Inodoro inteligente con asiento bidé",
          "Lluvia de techo + jets corporales",
          "Almacenaje a medida y escenas de luz",
        ],
        highlighted: false,
      },
    ] as BudgetPackage[],
    breakdownTitle: "Paquete Premium — desglose por partida",
    breakdown: [
      { item: "Demolición y retiro de escombros", range: "$1,800 – $2,400" },
      { item: "Plomería (conversión walk-in + reubicaciones)", range: "$2,600 – $3,500" },
      { item: "Electricidad e iluminación LED", range: "$1,200 – $1,800" },
      { item: "Impermeabilización y preparación de sustrato", range: "$900 – $1,400" },
      { item: "Azulejo de paredes y piso (material + mano de obra)", range: "$4,500 – $6,200" },
      { item: "Ducha walk-in (plato, vidrio, regadera de lluvia)", range: "$3,200 – $4,300" },
      { item: "Vanidad de roble + tope de cuarzo + lavabo", range: "$2,400 – $3,200" },
      { item: "Inodoro, grifería y accesorios de bronce", range: "$1,700 – $2,600" },
      { item: "Pintura, techo y carpintería de acabado", range: "$800 – $1,200" },
      { item: "Permisos (Miami-Dade / Palm Beach)", range: "$700 – $900" },
    ] as BudgetLine[],
    disclaimer:
      "Estimado conceptual basado en precios promedio de contratistas del sur de Florida 2026. La propuesta final requiere visita técnica en sitio, confirmación de materiales y revisión de HOA/permisos.",
    cta: "Solicitar presupuesto formal",
  },
  cta: {
    title: "¿Listo para construir este baño?",
    description:
      "Agenda una visita en Miami o Boca Raton y recibe una propuesta formal partida por partida en 48 horas.",
    primary: "Iniciar mi presupuesto",
    secondary: "Volver al inicio",
  },
};

export const cliente01Content: Record<Language, typeof en> = { en, es };
export type Cliente01Content = typeof en;
