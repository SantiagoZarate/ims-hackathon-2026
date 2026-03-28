import Link from "next/link"

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
      <Link
        href="/"
        className="font-heading text-sm font-medium tracking-tight text-foreground hover:opacity-80"
      >
        Mixtract
      </Link>
    </header>
  )
}
