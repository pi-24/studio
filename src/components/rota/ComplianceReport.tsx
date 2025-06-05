"use client";

import type { ProcessedRotaResult, ComplianceMessage } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock, Coffee, CircleDollarSign, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ComplianceReportProps {
  result: ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null; // Allow fieldErrors for detailed form errors
  isProcessing: boolean;
}

const iconMap: Record<ComplianceMessage['type'], React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const iconColorMap: Record<ComplianceMessage['type'], string> = {
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
  info: 'text-blue-600',
};

const variantMap: Record<ComplianceMessage['type'], "default" | "destructive"> = {
  success: "default",
  warning: "default", // Shadcn alert doesn't have warning variant by default, use default
  error: "destructive",
  info: "default", // Use default for info
};


export default function ComplianceReport({ result, isProcessing }: ComplianceReportProps) {
  if (isProcessing) {
    return (
      <Card className="w-full mt-8 shadow-lg">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-8 w-3/4" />
              </Card>
            ))}
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return null; // Don't render anything if no result yet and not processing
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
                {result.fieldErrors.map((err, idx) => (
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
    if (summary === "Compliant") return "text-green-600";
    if (summary === "Review Needed") return "text-yellow-600";
    return "text-blue-600"; // For "Information" or other statuses
  };


  return (
    <Card className="w-full mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <ListChecks className="text-primary"/> Rota Analysis Report
        </CardTitle>
        <CardDescription className={`text-lg font-semibold ${getSummaryColor(result.complianceSummary)}`}>
          Overall Status: {result.complianceSummary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-4 bg-muted/30 shadow-sm">
            <CardTitle className="text-lg font-medium flex items-center gap-2 mb-1"><Clock className="text-primary h-5 w-5" />Total Hours</CardTitle>
            <p className="text-3xl font-bold text-primary">{result.totalHours.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </Card>
          <Card className="p-4 bg-muted/30 shadow-sm">
            <CardTitle className="text-lg font-medium flex items-center gap-2 mb-1"><Coffee className="text-primary h-5 w-5" />Total Break</CardTitle>
            <p className="text-3xl font-bold text-primary">{result.totalBreakHours.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">hrs</span></p>
          </Card>
          <Card className="p-4 bg-muted/30 shadow-sm">
            <CardTitle className="text-lg font-medium flex items-center gap-2 mb-1"><CircleDollarSign className="text-accent h-5 w-5" />Est. Salary</CardTitle>
            <p className="text-3xl font-bold text-accent">£{result.estimatedSalary.toFixed(2)}</p>
             <p className="text-xs text-muted-foreground">(Based on £25/hr mock rate)</p>
          </Card>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 font-headline text-primary">Compliance Details:</h3>
          {result.complianceMessages.length > 0 ? (
            <div className="space-y-3">
              {result.complianceMessages.map((msg, index) => {
                const IconComponent = msg.icon || iconMap[msg.type];
                const alertVariant = variantMap[msg.type];
                return (
                  <Alert key={index} variant={alertVariant} className={`${msg.type === 'success' ? 'bg-green-50 border-green-300' : msg.type === 'warning' ? 'bg-yellow-50 border-yellow-300' : msg.type === 'info' ? 'bg-blue-50 border-blue-300' : ''}`}>
                    <IconComponent className={`h-5 w-5 ${iconColorMap[msg.type]}`} />
                    <AlertTitle className={`font-semibold ${iconColorMap[msg.type]}`}>{msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}</AlertTitle>
                    <AlertDescription className="text-foreground/80">
                      {msg.text}
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No specific compliance messages.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4 italic">
          Disclaimer: This tool provides an estimation and basic compliance check based on simplified rules and mocked AI responses. Always refer to your specific NHS contract, Trust policies, and official Working Time Regulations guidance for definitive information. Salary estimation is illustrative.
        </p>
      </CardContent>
    </Card>
  );
}
