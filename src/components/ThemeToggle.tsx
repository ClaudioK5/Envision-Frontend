import { useTheme, type EnvisionTheme } from "../theme/ThemeProvider";

const OPTIONS: { id: EnvisionTheme; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "girlie", label: "Girlie" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label="Choose Envision look"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`theme-toggle__btn ${active ? "theme-toggle__btn--active" : ""} ${
              option.id === "girlie" ? "theme-toggle__btn--girlie" : ""
            }`}
            aria-pressed={active}
            onClick={() => setTheme(option.id)}
          >
            {option.id === "girlie" ? (
              <span className="theme-toggle__spark" aria-hidden />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
