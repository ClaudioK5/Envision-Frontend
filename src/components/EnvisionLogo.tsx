type Props = {
  className?: string;
  size?: number;
};

export function EnvisionLogo({ className, size = 36 }: Props) {
  return (
    <img
      src="/envision-logo.png"
      alt=""
      className={className}
      width={size}
      height={size}
      decoding="async"
      aria-hidden
    />
  );
}
