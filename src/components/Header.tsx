import Link from 'next/link';
import { Logo } from './Logo';
import AuthButtons from './AuthButtons';

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav>
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
