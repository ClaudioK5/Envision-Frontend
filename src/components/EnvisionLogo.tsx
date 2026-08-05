import { useTheme } from "../theme/ThemeProvider";

type Props = {
  className?: string;
  size?: number;
};

export function EnvisionLogo({ className, size = 36 }: Props) {
  const { theme } = useTheme();
  const src =
    theme === "girlie" ? "/envision-logo-girlie.png" : "/envision-logo.png";

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={size}
      height={size}
      decoding="async"
      aria-hidden
    />
  );
}
