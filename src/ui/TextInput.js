export function TextInput({ className = "", ...props }) {
  return (
    <input
      className={[
        "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
        "placeholder:text-zinc-400",
        "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

