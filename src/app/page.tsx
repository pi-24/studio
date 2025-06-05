
"use client";

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Settings, CreditCard, ExternalLink, PlusCircle, CalendarDays, FolderKanban, Info, CheckCircle2, HelpCircle } from 'lucide-react';
import type { RotaDocument } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Helper function to get icon and tooltip text based on compliance summary
const getComplianceIconDetails = (summary?: string) => {
  if (summary === 'Compliant') {
    return { Icon: CheckCircle2, color: 'text-green-500', tooltipText: 'Compliant' };
  }
  if (summary === 'Review Needed') {
    return { Icon: AlertTriangle, color: 'text-amber-500', tooltipText: 'Review Needed' };
  }
  return { Icon: HelpCircle, color: 'text-muted-foreground', tooltipText: 'Compliance status unknown. Process in Rota Checker.' };
};

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
    <TooltipProvider>
      <div className="space-y-10">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-headline text-primary">Welcome to RotaCalc, {user.email?.split('@')[0]}!</CardTitle>
            <CardDescription className="text-md mt-1">
              Manage your rotas, check compliance, and estimate pay.
            </CardDescription>
          </CardHeader>
          {!hasRotas && (
              <CardContent>
                  <div className="p-4 mb-2 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800 flex items-center gap-2" role="alert">
                      <Info size={18}/> <span className="font-medium">No Rotas Found:</span> You haven't uploaded any rotas yet. Click the "Upload New Rota" button in the 'My Rotas' section below to get started.
                  </div>
              </CardContent>
          )}
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" /> My Rotas
                  </CardTitle>
                  <CardDescription className="mt-1">
                    View your uploaded rotas and access compliance or pay estimation tools.
                  </CardDescription>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
                  <Link href="/upload-rota">
                    <PlusCircle className="mr-2 h-5 w-5" /> Upload New Rota
                  </Link>
                </Button>
              </div>
            </CardHeader>
            {hasRotas && (
              <CardContent className="space-y-4">
                {user.rotas?.map((rota: RotaDocument) => {
                  const { Icon: ComplianceStatusIcon, color: complianceIconColor, tooltipText: complianceTooltipText } = getComplianceIconDetails(rota.complianceSummary);
                  return (
                    <div key={rota.id} className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-lg text-accent">{rota.name || `Rota starting ${new Date(rota.scheduleMeta.scheduleStartDate).toLocaleDateString()}`}</h3>
                          <p className="text-sm text-muted-foreground">
                            Site: {rota.scheduleMeta.site || 'N/A'} | Specialty: {rota.scheduleMeta.specialty || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Dates: {new Date(rota.scheduleMeta.scheduleStartDate).toLocaleDateString()} - {new Date(rota.scheduleMeta.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild variant="outline" size="sm" className="flex-1 justify-start text-left">
                              <Link href={`/rota-checker?rotaId=${rota.id}`}>
                                <ComplianceStatusIcon className={`h-4 w-4 ${complianceIconColor}`} />
                                <span className="ml-2">Compliance Check Results</span>
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{complianceTooltipText}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button asChild variant="outline" size="sm" className="flex-1 justify-start text-left">
                          <Link href="/pay-checker/coming-soon">
                            <CreditCard className="h-4 w-4 text-primary/80" />
                            <span className="ml-2">Estimated Pay Results</span>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
             {!hasRotas && (
              <CardContent>
                <p className="text-muted-foreground text-center py-6">
                  No rotas uploaded yet. Click "Upload New Rota" above to add your first one.
                </p>
              </CardContent>
            )}
          </Card>

        {/* "My Calendar" Card - This remains from the original structure */}
        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <CalendarDays className="h-6 w-6"/> My Calendar
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

        {/* "Manage Your Personal Profile" Card - This remains */}
        <Card className="mt-10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <Settings className="h-5 w-5" /> Manage Your Personal Profile
            </CardTitle>
            <CardDescription>
              Update your grade, region, tax details, and other personal information. Rota-specific details are managed via "Upload New Rota" or by editing an existing rota.
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
    </TooltipProvider>
  );
}
