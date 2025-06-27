
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hourglass } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

// export const metadata: Metadata = { // Metadata needs to be defined outside client component
//   title: 'Pay Estimator - Coming Soon',
//   description: 'OnTheDoc Pay Estimator feature is under development.',
// };
// For client components, Metadata should be handled in a parent server component or layout if needed globally.
// Or use document.title directly if simple. For now, we'll omit static metadata from here.

export default function PayCheckerComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Card className="w-full max-w-lg text-center shadow-xl bg-card">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
            <Hourglass className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline text-primary">Pay Estimator - Coming Soon!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            We're working hard to bring you this feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-8">
          <p className="text-muted-foreground mb-8">
            This tool will help you estimate your salary based on your NHS contract,
            rota details, grade, and other financial factors. Please check back later for updates!
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
