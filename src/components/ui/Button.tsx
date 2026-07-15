import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface BaseButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

type ButtonProps = BaseButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkButtonProps = BaseButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0F3D56] text-white shadow-[0_18px_45px_rgba(15,61,86,0.24)] hover:bg-[#0a3045]",
  secondary:
    "border border-[#0F3D56]/25 bg-white/85 text-[#0F3D56] dark:text-[#e8edf7] hover:border-[#0F3D56] hover:bg-white dark:hover:bg-[#111a2e]",
  ghost: "text-[#0F3D56] dark:text-[#e8edf7] hover:bg-[#0F3D56]/8",
};

export default function Button(props: ButtonProps | LinkButtonProps) {
  const {
    children,
    variant = "primary",
    className = "",
    ...rest
  } = props;

  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition duration-300 focus:outline-none focus:ring-2 focus:ring-[#0F3D56]/35 focus:ring-offset-2 ${variantClasses[variant]} ${className}`;

  if ("href" in props && props.href) {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
