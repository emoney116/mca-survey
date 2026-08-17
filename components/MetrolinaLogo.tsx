import Image from "next/image";

type MetrolinaLogoProps = {
  className?: string;
  priority?: boolean;
};

export function MetrolinaLogo({ className, priority = false }: MetrolinaLogoProps) {
  return (
    <Image
      src="/metrolina-logo.png"
      alt="Metrolina Christian Academy Warriors logo"
      width={1879}
      height={1779}
      priority={priority}
      className={className}
      sizes="(max-width: 600px) 110px, 132px"
    />
  );
}
