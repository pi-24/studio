
"use client";

import type { ProcessedRotaResult, ComplianceResultDetail } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock, Coffee, CircleDollarSign, ListChecks, BarChart3, Hourglass, ShieldAlert, BedDouble, Umbrella } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ComplianceReportProps {
  result: ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null;
  isProcessing: boolean;
}

const iconMap: Record<ComplianceResultDetail['category'] | 'Other', React.ComponentType<{ className?: string }>> = {
  'Average Hours': BarChart3,
  'Maximum Hours & Shifts': Hourglass,
  'On-Call Hours & Shifts': ShieldAlert,
  'Rest Requirements': BedDouble,
  'Weekend Work': Umbrella,
  'Break Entitlements': Coffee,
  'Other': ListChecks, // Default icon
};

const getCategoryIcon = (categoryName: string) => {
    return iconMap[categoryName as keyof typeof iconMap] || ListChecks;
};

const CATEGORY_ORDER = [
    'Average Hours',
    'Maximum Hours & Shifts',
    'On-Call Hours & Shifts',
    'Rest Requirements',
    'Weekend Work',
    'Break Entitlements',
    'Other'
];

export default function ComplianceReport({ result, isProcessing }: ComplianceReportProps) {
  if (isProcessing) {
    return (
      <Card className="w-full mt-8 shadow-lg">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
        <Card className="w-full mt-8 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2">
                    <ListChecks className="text-primary"/> Rota Analysis Report
                </CardTitle>
                <CardDescription>Results will appear here after processing.</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-10">
                <CalendarDays size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Input your rota details and click "Calculate & Check Compliance".</p>
            </CardContent>
        </Card>
    );
  }

  if ('error' in result) {
    return (
      <Card className="w-full mt-8 shadow-lg border-destructive">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-destructive flex items-center gap-2"><XCircle />Error Processing Rota</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Processing Error</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
            {result.fieldErrors && (
              <ul className="mt-2 list-disc list-inside text-sm">
                {result.fieldErrors.map((err: any, idx: number) => ( // Type ZodIssue if available
                  <li key={idx}>{`${err.path.join('.')} - ${err.message}`}</li>
                ))}
              </ul>
            )}
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  const getSummaryColor = (summary: string) => {
    if (summary === "Compliant") return "text-green-500";
    if (summary === "Review Needed") return "text-yellow-500";
    return "text-blue-500"; // For "Information" or other statuses
  };

  const groupedMessages = result.complianceMessages.reduce((acc, msg) => {
    const category = msg.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(msg);
    return acc;
  }, {} as Record<string, ComplianceResultDetail[]>);


  return (
    <Card className="w-full mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <ListChecks className="text-primary"/> Rota Analysis Report
        </CardTitle>
        <CardDescription className={`text-lg font-semibold ${getSummaryColor(result.complianceSummary)}`}>
          Overall Status: {result.complianceSummary}
        </CardDescription>
        <p className="text-sm text-muted-foreground">Total Hours Calculated: {result.totalHours.toFixed(2)} hrs</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATEGORY_ORDER.map(categoryName => {
            const messagesInCategory = groupedMessages[categoryName];
            if (!messagesInCategory || messagesInCategory.length === 0) return null;
            const CategoryIcon = getCategoryIcon(categoryName);
            return (
                <div key={categoryName} className="mb-6">
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary border-b pb-2">
                        <CategoryIcon className="h-5 w-5"/> {categoryName}
                    </h3>
                    <Accordion type="multiple" className="w-full space-y-3">
                        {messagesInCategory.map((msg, index) => (
                            <AccordionItem value={`item-${msg.id}-${index}`} key={msg.id + index} className={`rounded-lg border ${msg.isViolated ? 'border-destructive/70 bg-destructive/10' : 'border-green-600/70 bg-green-500/10'}`}>
                                <AccordionTrigger className={`px-4 py-3 text-sm font-medium hover:no-underline ${msg.isViolated ? 'text-destructive-foreground' : 'text-green-700 dark:text-green-400'}`}>
                                    <div className="flex items-center gap-2 flex-1">
                                        {msg.isViolated ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                        <span className="flex-1 text-left">{msg.name}</span>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${msg.isViolated ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                            {msg.isViolated ? 'VIOLATION' : 'OK'}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-3 pt-0 text-xs">
                                    <p className="text-muted-foreground mb-1">{msg.description}</p>
                                    {msg.pdfReference && <p className="text-muted-foreground/70 mb-2 text-xxs italic">Ref: {msg.pdfReference}</p>}
                                    <div className="space-y-0.5 bg-background/30 p-2 rounded-md border border-border">
                                        <p><strong className="text-foreground/80">Your Value:</strong> {typeof msg.userValue === 'number' ? msg.userValue.toFixed(2) : String(msg.userValue)}</p>
                                        <p><strong className="text-foreground/80">Limit:</strong> {String(msg.limitValue)}</p>
                                        <p><strong className="text-foreground/80">Difference:</strong> {String(msg.difference)}</p>
                                        {msg.details && <p className="mt-1 pt-1 border-t border-border/50 text-muted-foreground/90 text-xxs"><em>Details: {msg.details}</em></p>}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            );
        })}
        
        {Object.keys(groupedMessages).length === 0 && !isProcessing && (
             <p className="text-muted-foreground text-center py-6">No compliance messages to display for the processed rota.</p>
        )}

        <p className="text-xs text-muted-foreground mt-4 italic">
          Disclaimer: This tool provides an estimation and basic compliance check based on simplified rules. Always refer to your specific NHS contract, Trust policies, and official Working Time Regulations guidance for definitive information.
        </p>
      </CardContent>
    </Card>
  );
}

