export default function Hero() {
  return (
    <section className="flex min-h-screen items-center bg-[#F5E9DA]">
      <div className="mx-auto max-w-7xl px-6 py-20">
        
        <div className="max-w-3xl">
          
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-[#0F3D56]">
            Luxury Remodeling Florida
          </p>

          <h1 className="mb-6 text-5xl font-bold leading-tight text-[#0F3D56] md:text-7xl">
            Transforming Spaces Into Luxury Experiences
          </h1>

          <p className="mb-8 text-lg text-gray-700">
            Modern remodeling, construction and premium renovation services
            for residential and commercial properties in Florida.
          </p>

          <div className="flex gap-4">
            <button className="rounded-xl bg-[#0F3D56] px-8 py-4 text-white">
              Get Estimate
            </button>

            <button className="rounded-xl border border-[#0F3D56] px-8 py-4 text-[#0F3D56]">
              View Projects
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}