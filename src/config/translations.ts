export type Language = "en" | "es";

export const translations = {
  en: {
    nav: {
      services: "Services",
      beforeAfter: "Before / After",
      tours: "Tours",
      estimate: "Estimate",
      startEstimate: "Start Estimate",
      openNavigation: "Open navigation",
      closeNavigation: "Close navigation",
      bath360: "Bathroom 360°",
    },
    hero: {
      eyebrow: "Luxury remodeling in Florida",
      title: "Transforming spaces into luxury experiences",
      description:
        "Premium residential and commercial remodeling with curated design, precise construction, and sales-ready project showcases for Florida properties.",
      primaryCta: "Get Estimate",
      secondaryCta: "View Virtual Tour",
      stats: [
        { value: "120+", label: "premium remodels" },
        { value: "18", label: "Florida cities served" },
        { value: "360", label: "tour-ready showcases" },
      ],
      proof: [
        "Design-build workflow",
        "Before/after storytelling",
        "Lead-ready estimates",
      ],
      currentFocusLabel: "Current focus",
      currentFocus: "Kitchens, interiors, commercial upgrades",
    },
    services: {
      eyebrow: "Services",
      title: "Premium remodeling built for visual impact and commercial trust",
      items: [
        {
          title: "Kitchen Remodeling",
          description:
            "Custom cabinetry, stone surfaces, lighting plans, appliance integration, and premium finish coordination.",
          alt: "Kitchen Remodeling project example",
        },
        {
          title: "Interior Design",
          description:
            "Elegant material palettes, space planning, furniture direction, and cohesive residential transformations.",
          alt: "Interior Design project example",
        },
        {
          title: "Commercial Projects",
          description:
            "Polished tenant improvements, hospitality-ready spaces, office upgrades, and brand-aligned buildouts.",
          alt: "Commercial Projects project example",
        },
      ],
    },
    beforeAfter: {
      eyebrow: "Before / After",
      title: "Transformations that sell the quality before a meeting begins",
      description:
        "Show clients the full story: existing conditions, design direction, and finished craft in a format that is fast to scan on mobile and strong enough for sales presentations.",
      before: "Before",
      after: "After",
      projects: [
        { space: "Waterfront Kitchen", city: "Miami, FL" },
        { space: "Modern Living Suite", city: "Orlando, FL" },
      ],
    },
    tours: {
      eyebrow: "Virtual tours",
      title: "Interactive tours for premium project storytelling",
      description:
        "KokiStyle is prepared for Kuula 360 embeds, allowing each remodel to become an immersive sales asset instead of a static gallery.",
      features: [
        "360 walkthrough embeds",
        "Project-ready share links",
        "Mobile sales presentation format",
      ],
      primaryCta: "Plan a Showcase",
      secondaryCta: "View Transformations",
      preview: "Kuula tour preview",
      imageAlt: "Luxury interior prepared for a virtual tour",
      scene: "Scene",
      scenes: ["Kitchen", "Living", "Commercial"],
    },
    estimate: {
      eyebrow: "Estimate system",
      title: "Sales-ready estimates with PDF export and QR tracking",
      description:
        "Capture lead details, adjust scope items, print, export a branded PDF, and generate a dynamic QR payload for project handoff.",
      qrAlt: "Estimate QR code",
      exportPdf: "Export PDF",
      print: "Print",
      clientName: "Client name",
      clientEmail: "Client email",
      projectType: "Project type",
      propertyCity: "Property city",
      item: "Item",
      qty: "Qty",
      unit: "Unit",
      total: "Total",
      removeItem: "Remove item",
      addItem: "Add item",
      subtotal: "Subtotal",
      contingency: "Contingency",
      notes: "Notes",
      pdfTitle: "KokiStyle Estimate",
      client: "Client",
      scope: "Scope",
      estimatedTotal: "Estimated Total",
      scanQr: "Scan estimate QR",
      newScopeItem: "New scope item",
      defaults: {
        clientName: "Sample Client",
        clientEmail: "client@example.com",
        projectType: "Kitchen Remodeling",
        propertyCity: "Miami, FL",
        notes:
          "Premium concept estimate. Final pricing depends on scope, materials, and site verification.",
      },
      initialItems: [
        "Design consultation and site review",
        "Premium remodeling allowance",
      ],
    },
    footer: {
      description:
        "Premium remodeling and construction presentation platform for Florida residential and commercial projects.",
      explore: "Explore",
      contact: "Contact",
      copyright:
        "© 2026 KokiStyle Remodeling. Built for premium project showcases.",
      links: ["Services", "Before / After", "Virtual Tours", "Estimates"],
      socialProfile: "Social profile",
    },
  },
  es: {
    nav: {
      services: "Servicios",
      beforeAfter: "Antes / Después",
      tours: "Tours",
      estimate: "Presupuesto",
      startEstimate: "Crear Presupuesto",
      openNavigation: "Abrir navegación",
      closeNavigation: "Cerrar navegación",
      bath360: "Baño 360°",
    },
    hero: {
      eyebrow: "Remodelación de lujo en Florida",
      title: "Transformamos espacios en experiencias de lujo",
      description:
        "Remodelación residencial y comercial premium con diseño curado, construcción precisa y presentaciones listas para vender proyectos en Florida.",
      primaryCta: "Solicitar Presupuesto",
      secondaryCta: "Ver Tour Virtual",
      stats: [
        { value: "120+", label: "remodelaciones premium" },
        { value: "18", label: "ciudades en Florida" },
        { value: "360", label: "showcases con tour" },
      ],
      proof: [
        "Flujo diseño-construcción",
        "Historias antes/después",
        "Presupuestos listos para leads",
      ],
      currentFocusLabel: "Enfoque actual",
      currentFocus: "Cocinas, interiores, espacios comerciales",
    },
    services: {
      eyebrow: "Servicios",
      title: "Remodelación premium creada para impacto visual y confianza comercial",
      items: [
        {
          title: "Remodelación de Cocinas",
          description:
            "Gabinetes a medida, superficies de piedra, planes de iluminación, integración de electrodomésticos y acabados premium.",
          alt: "Ejemplo de proyecto de remodelación de cocinas",
        },
        {
          title: "Diseño Interior",
          description:
            "Paletas elegantes de materiales, planificación de espacios, dirección de mobiliario y transformaciones residenciales cohesivas.",
          alt: "Ejemplo de proyecto de diseño interior",
        },
        {
          title: "Proyectos Comerciales",
          description:
            "Mejoras de locales, espacios para hospitality, oficinas renovadas y construcciones alineadas con la marca.",
          alt: "Ejemplo de proyecto comercial",
        },
      ],
    },
    beforeAfter: {
      eyebrow: "Antes / Después",
      title: "Transformaciones que venden calidad antes de la primera reunión",
      description:
        "Muestra a tus clientes la historia completa: condiciones iniciales, dirección de diseño y acabados finales en un formato rápido para móvil y potente para ventas.",
      before: "Antes",
      after: "Después",
      projects: [
        { space: "Cocina frente al agua", city: "Miami, FL" },
        { space: "Suite moderna de sala", city: "Orlando, FL" },
      ],
    },
    tours: {
      eyebrow: "Tours virtuales",
      title: "Tours interactivos para contar proyectos premium",
      description:
        "KokiStyle está preparado para integrar tours 360 de Kuula, convirtiendo cada remodelación en un activo de ventas inmersivo en lugar de una galería estática.",
      features: [
        "Recorridos 360 integrados",
        "Enlaces listos para compartir",
        "Formato comercial optimizado para móvil",
      ],
      primaryCta: "Planificar Showcase",
      secondaryCta: "Ver Transformaciones",
      preview: "Vista previa Kuula",
      imageAlt: "Interior de lujo preparado para tour virtual",
      scene: "Escena",
      scenes: ["Cocina", "Sala", "Comercial"],
    },
    estimate: {
      eyebrow: "Sistema de presupuestos",
      title: "Presupuestos listos para ventas con PDF y QR",
      description:
        "Captura datos del lead, ajusta partidas, imprime, exporta un PDF de marca y genera un QR dinámico para el seguimiento del proyecto.",
      qrAlt: "Código QR del presupuesto",
      exportPdf: "Exportar PDF",
      print: "Imprimir",
      clientName: "Nombre del cliente",
      clientEmail: "Email del cliente",
      projectType: "Tipo de proyecto",
      propertyCity: "Ciudad de la propiedad",
      item: "Partida",
      qty: "Cant.",
      unit: "Unitario",
      total: "Total",
      removeItem: "Eliminar partida",
      addItem: "Agregar partida",
      subtotal: "Subtotal",
      contingency: "Contingencia",
      notes: "Notas",
      pdfTitle: "Presupuesto KokiStyle",
      client: "Cliente",
      scope: "Alcance",
      estimatedTotal: "Total Estimado",
      scanQr: "Escanear QR",
      newScopeItem: "Nueva partida",
      defaults: {
        clientName: "Cliente de ejemplo",
        clientEmail: "cliente@ejemplo.com",
        projectType: "Remodelación de Cocina",
        propertyCity: "Miami, FL",
        notes:
          "Presupuesto conceptual premium. El precio final depende del alcance, materiales y verificación en sitio.",
      },
      initialItems: [
        "Consulta de diseño y revisión en sitio",
        "Partida estimada de remodelación premium",
      ],
    },
    footer: {
      description:
        "Plataforma premium de presentación para proyectos residenciales y comerciales de remodelación y construcción en Florida.",
      explore: "Explorar",
      contact: "Contacto",
      copyright:
        "© 2026 KokiStyle Remodeling. Creado para showcases premium de proyectos.",
      links: ["Servicios", "Antes / Después", "Tours Virtuales", "Presupuestos"],
      socialProfile: "Perfil social",
    },
  },
} as const;
