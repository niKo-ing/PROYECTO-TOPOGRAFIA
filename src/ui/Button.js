export function Button({ className = "", disabled, type = "button", ...props }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
        "bg-zinc-900 text-white hover:bg-zinc-800",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
