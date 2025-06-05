
"use client";

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Settings, ListChecks, CreditCard, ExternalLink, PlusCircle, CalendarDays, FolderKanban, Info, AlertCircle as AlertErrorIcon } from 'lucide-react'; // Renamed Calendar to CalendarDays
import type { RotaDocument } from '@/types';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/4 mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    // AuthContext should handle redirect to login
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
         <Card className="w-full max-w-md p-8 shadow-lg">
           <CardHeader>
             <CardTitle className="text-2xl text-primary">Loading...</CardTitle>
           </CardHeader>
          <CardContent>
            <p>Redirecting...</p>
          </CardContent>
         </Card>
      </div>
    );
  }
  
   if (!user.isProfileComplete) {
    // AuthContext should handle redirect to /profile/setup
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" /> Almost there!
            </CardTitle>
            <CardDescription>Please complete your profile setup to use RotaCalc.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">Your profile information needs to be configured before you can access the dashboard.</p>
            <Button asChild size="lg">
              <Link href="/profile/setup">
                <Settings className="mr-2 h-5 w-5" /> Go to Profile Setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const hasRotas = user.rotas && user.rotas.length > 0;

  return (
    <div className="space-y-10">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-3xl font-headline text-primary">Welcome to RotaCalc, {user.email?.split('@')[0]}!</CardTitle>
              <CardDescription className="text-md mt-1">
                Manage your rotas, check compliance, and estimate pay.
              </CardDescription>
            </div>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
              <Link href="/upload-rota">
                <PlusCircle className="mr-2 h-5 w-5" /> Upload New Rota
              </Link>
            </Button>
          </div>
        </CardHeader>
        {!hasRotas && (
             <CardContent>
                <div className="p-4 mb-2 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800 flex items-center gap-2" role="alert">
                    <Info size={18}/> <span className="font-medium">No Rotas Found:</span> You haven't uploaded any rotas yet. Click the "Upload New Rota" button to get started.
                </div>
            </CardContent>
        )}
      </Card>

      {hasRotas && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <FolderKanban className="h-5 w-5" /> My Rotas
            </CardTitle>
            <CardDescription>
              View and manage your uploaded rotas. Click a rota to view its compliance report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.rotas?.map((rota: RotaDocument) => (
              <Link key={rota.id} href={`/rota-checker?rotaId=${rota.id}`} passHref>
                <div className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <h3 className="font-medium text-lg text-accent">{rota.name || `Rota starting ${rota.scheduleMeta.scheduleStartDate}`}</h3>
                  <p className="text-sm text-muted-foreground">
                    Site: {rota.scheduleMeta.site || 'N/A'} | Specialty: {rota.scheduleMeta.specialty || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dates: {new Date(rota.scheduleMeta.scheduleStartDate).toLocaleDateString()} - {new Date(rota.scheduleMeta.endDate).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <CalendarDays className="h-6 w-6"/> My Calendar {/* Updated Icon */}
            </CardTitle>
            <CardDescription>
              View your upcoming shifts and schedule in a calendar format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/calendar">
                Open Calendar
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-accent">
              <ListChecks className="h-6 w-6"/> Rota Compliance Checker
            </CardTitle>
            <CardDescription>
              Select a rota from "My Rotas" to analyze its compliance against NHS rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Button disabled={!hasRotas} asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" title={!hasRotas ? "Upload a rota first" : "View Rota Checker"}>
               <Link href={hasRotas && user.rotas && user.rotas.length > 0 ? `/rota-checker?rotaId=${user.rotas[0].id}` : "/rota-checker"}>
                 Open Rota Checker
               </Link>
            </Button>
             {!hasRotas && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 flex items-center gap-1">
                    <AlertErrorIcon size={14}/> Please upload a rota first to use the checker.
                </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <CreditCard className="h-6 w-6"/> Pay Checker
            </CardTitle>
            <CardDescription>
              Estimate your salary based on your rota and NHS pay scales. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              Open Pay Checker (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

       <Card className="mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <Settings className="h-5 w-5" /> Manage Your Personal Profile
                </CardTitle>
                <CardDescription>
                    Update your grade, region, tax details, and other personal information. Rota-specific details (config, shifts, grid) are managed via "Upload New Rota" or by editing an existing rota through the Rota Checker.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline">
                    <Link href="/profile">
                        Go to Profile <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}

