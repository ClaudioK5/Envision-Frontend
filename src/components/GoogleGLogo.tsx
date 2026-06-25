const GOOGLE_G_URI =
  "https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png";

type GoogleGLogoProps = {
  size?: number;
};

export function GoogleGLogo({ size = 20 }: GoogleGLogoProps) {
  return (
    <img
      src={GOOGLE_G_URI}
      alt=""
      width={size}
      height={size}
      className="google-g-logo"
      aria-hidden
    />
  );
}
