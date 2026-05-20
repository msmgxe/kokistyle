export default function Navbar() {
  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        
        <h1 className="text-2xl font-bold text-[#0F3D56]">
          KokiStyle
        </h1>

        <div className="hidden gap-6 md:flex">
          <a href="#">Home</a>
          <a href="#">Projects</a>
          <a href="#">Services</a>
          <a href="#">Contact</a>
        </div>

      </div>
    </nav>
  );
}