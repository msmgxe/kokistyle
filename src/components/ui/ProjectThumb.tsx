import { initials } from "@/src/lib/utils";

interface Props {
  photoUrl?: string | null;
  title: string;
  size?: number;
  rounded?: string;
}

export default function ProjectThumb({ photoUrl, title, size = 36, rounded = "rounded-lg" }: Props) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      style={{ width: size, height: size }}
      className={`flex-none object-cover ring-1 ring-[#E6DDCB] ${rounded}`}
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.28)) }}
      className={`grid flex-none place-items-center bg-[#16323D] font-bold tracking-wide text-[#F5E9DA] ${rounded}`}
    >
      {initials(title)}
    </span>
  );
}
