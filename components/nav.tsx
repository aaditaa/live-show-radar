import Link from 'next/link';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/artists', label: 'Artists' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/scans', label: 'Scans' },
  { href: '/how-it-works', label: 'How it works' },
];

export function Nav() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <Link href="/" className="font-semibold tracking-tight text-white">
          Live Show Radar
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-inset ring-white/10">
          demo mode · read-only
        </span>
      </div>
    </header>
  );
}
