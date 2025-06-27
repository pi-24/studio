
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle, Calculator, UserPlus, LogIn } from 'lucide-react';
import type { Metadata } from 'next';

// For client components, Metadata should be handled in a parent server component or layout if needed globally.
// export const metadata: Metadata = {
//   title: 'About OnTheDoc',
//   description: 'Learn more about OnTheDoc - Your NHS Rota Compliance and Salary Tool.',
// };

export default function AboutPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
            <Calculator className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline text-primary">Welcome to OnTheDoc!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            Your essential tool for managing NHS rotas, ensuring compliance, and estimating your pay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 py-8">
          <p className="text-center text-card-foreground">
            OnTheDoc is designed specifically for NHS professionals to simplify the complexities of work schedules.
          </p>
          <ul className="space-y-3">
            {[
              "Easily input your rota data.",
              "Automatically check compliance against NHS guidelines.",
              "Estimate your salary based on worked hours and pay scales.",
              "Visualize your rota compliance status clearly.",
              "Securely store your rota data."
            ].map((feature, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="text-center text-card-foreground pt-4">
            Take control of your work-life balance and finances with OnTheDoc.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4 justify-center pt-6 border-t">
          <Button asChild size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/signup">
              <UserPlus className="mr-2 h-5 w-5" /> Create Your Account
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/login">
              <LogIn className="mr-2 h-5 w-5" /> Login to Existing Account
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
