import { Calculator } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="OnTheDoc Home">
      <Calculator className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
      <span className="text-xl sm:text-2xl font-bold text-primary font-headline">OnTheDoc</span>
    </div>
  );
}
