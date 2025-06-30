
"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { FilePlus, Edit, ClipboardCopy, MoreHorizontal, Calendar as CalendarIcon, PlusCircle, Trash2, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

// Zod Schema and types for the CRQ form
const applicationChangesSchema = z.object({
  code: z.boolean().default(false),
  codeVersion: z.string().optional(),
  ccm: z.boolean().default(false),
  ccmVersion: z.string().optional(),
  db: z.boolean().default(false),
  dbVersion: z.string().optional(),
  akeyless: z.boolean().default(false),
  akeylessVersion: z.string().optional(),
});

const applicationSchema = z.object({
  name: z.string().min(1, 'Application name is required'),
  changes: applicationChangesSchema
});

const monitoredChangeSchema = z.object({
  name: z.string().min(1, 'Change name is required'),
  mms: z.string().optional(),
  splunk: z.string().optional(),
});

const formSchema = z.object({
  id: z.string().optional(),
  crqNumber: z.string().optional(),
  summary: z.string().min(1, "Summary is required."),
  briefDescription: z.string().min(1, "Brief description is required."),
  purpose: z.string().min(1, "Purpose is required."),
  testResults: z.object({
    functional: z.boolean().default(false),
    regression: z.boolean().default(false),
    performance: z.boolean().default(false),
  }),
  impactAnalysis: z.object({
    burstAreaOverall: z.string().optional(),
    burstAreaTender: z.string().optional(),
    possibleImpactAreas: z.string().optional(),
    businessUserImpact: z.string().optional(),
    impactedTeams: z.string().optional(),
    instructionsSent: z.string().optional(),
    teamsToNotify: z.string().optional(),
  }),
  riskAssessment: z.object({
    risk: z.enum(["Low", "Medium", "High"]).optional(),
    mitigationPlan: z.string().optional(),
  }),
  implementationPlan: z.object({
    implementationStartDate: z.date().optional(),
    duration: z.string().optional(),
    applications: z.array(applicationSchema).min(1, "At least one application is required."),
  }),
  validationPlan: z.object({
    duration: z.string().optional(),
    monitoredChanges: z.array(monitoredChangeSchema).min(1, "At least one monitored change is required."),
    whenToRollback: z.string().optional(),
  }),
  backoutPlan: z.object({
    isTested: z.boolean().default(false),
    changes: applicationChangesSchema,
    monitoredChanges: z.array(monitoredChangeSchema).min(1, "At least one monitored change is required."),
  }),
});

type FormValues = z.infer<typeof formSchema>;

// CRQ Form Component
const SectionWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-6 pt-6 first:pt-0">
        <h3 className="text-xl font-headline font-semibold">{title}</h3>
        <div className="space-y-6 pl-4 border-l-2 border-primary/20">{children}</div>
    </div>
);

const ChangeFields = ({ form, pathPrefix, versionLabel }: { form: any, pathPrefix: string, versionLabel: string }) => {
    const changeTypes = ["code", "ccm", "db", "akeyless"];
    return (
      <div className="space-y-4">
        {changeTypes.map(type => (
          <div key={type}>
            <FormField
              control={form.control}
              name={`${pathPrefix}.${type}`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-normal capitalize">{type}</FormLabel>
                </FormItem>
              )}
            />
            {form.watch(`${pathPrefix}.${type}`) && (
              <div className="pl-6 pt-2">
                <FormField
                  control={form.control}
                  name={`${pathPrefix}.${type}Version`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{versionLabel}</FormLabel>
                      <FormControl><Input placeholder="Enter version" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
};

function CrqFormComponent({ 
  initialData, 
  onSave, 
  onCancel 
}: {
  initialData: (FormValues & { implementationPlan: { implementationStartDate?: string | Date }}) | null;
  onSave: (data: FormValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
        ...initialData,
        implementationPlan: {
            ...initialData.implementationPlan,
            implementationStartDate: initialData.implementationPlan.implementationStartDate ? new Date(initialData.implementationPlan.implementationStartDate) : undefined,
        }
    } : {
      summary: "",
      briefDescription: "",
      purpose: "",
      testResults: { functional: false, regression: false, performance: false },
      impactAnalysis: {},
      riskAssessment: { risk: "Low" },
      implementationPlan: { applications: [{ name: 'Application 1', changes: {} }] },
      validationPlan: { monitoredChanges: [{ name: 'Change 1'}] },
      backoutPlan: { isTested: false, changes: {}, monitoredChanges: [{ name: 'Change 1' }] },
    },
  });

  const { fields: implAppFields, append: appendImplApp, remove: removeImplApp } = useFieldArray({
    control: form.control, name: "implementationPlan.applications"
  });
  const { fields: valMonFields, append: appendValMon, remove: removeValMon } = useFieldArray({
    control: form.control, name: "validationPlan.monitoredChanges"
  });
  const { fields: backoutMonFields, append: appendBackoutMon, remove: removeBackoutMon } = useFieldArray({
    control: form.control, name: "backoutPlan.monitoredChanges"
  });

  const renderTestResultFields = (testName: "functional" | "regression" | "performance", label: string) => (
    <div>
      <FormField
        control={form.control}
        name={`testResults.${testName}`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="font-normal">{label}</FormLabel>
          </FormItem>
        )}
      />
      {form.watch(`testResults.${testName}`) && (
        <FormDescription className="pl-7 pt-2">
          Please attach PDF on Service Now.
        </FormDescription>
      )}
    </div>
  );
  
  return (
    <TooltipProvider>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-12">
        <div className="space-y-6">
            <FormField control={form.control} name="crqNumber" render={({ field }) => (<FormItem><FormLabel>CRQ Number (Optional)</FormLabel><FormControl><Input placeholder="e.g. CRQ123456" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Add this when the CRQ is officially created in ServiceNow.</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="summary" render={({ field }) => (<FormItem><FormLabel>Summary</FormLabel><FormControl><Textarea placeholder="A brief, one-sentence summary of the change." {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <SectionWrapper title="Description">
            <FormField control={form.control} name="briefDescription" render={({ field }) => (<FormItem><FormLabel>Brief Description of the change</FormLabel><FormControl><Textarea placeholder="A detailed description of what the change entails." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormItem>
              <FormLabel>Release notes confluence page</FormLabel>
              <FormDescription>Please attach PDF on Service Now.</FormDescription>
            </FormItem>
            <FormField control={form.control} name="purpose" render={({ field }) => (<FormItem><FormLabel>Purpose of the Change</FormLabel><FormControl><Textarea placeholder="Explain why this change is necessary (e.g., new feature, bug fix, compliance)." {...field} /></FormControl><FormMessage /></FormItem>)} />
             <div className="space-y-4">
                <FormLabel>Test Results</FormLabel>
                {renderTestResultFields("functional", "Functional")}
                {renderTestResultFields("regression", "Regression")}
                {renderTestResultFields("performance", "Performance")}
            </div>
        </SectionWrapper>
        
        <SectionWrapper title="Impact Analysis & Communication">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <FormField control={form.control} name="impactAnalysis.burstAreaOverall" render={({ field }) => (<FormItem><FormLabel>Overall Impact %</FormLabel><FormControl><Input placeholder="e.g., 5%" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="impactAnalysis.burstAreaTender" render={({ field }) => (<FormItem><FormLabel>Specific Tender Impact %</FormLabel><FormControl><Input placeholder="e.g., 20% of Card payments" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>Burst area helps stakeholders quickly understand the change's blast radius.</span></FormDescription>
            <FormField control={form.control} name="impactAnalysis.possibleImpactAreas" render={({ field }) => (<FormItem><FormLabel>Possible impact areas</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="impactAnalysis.businessUserImpact" render={({ field }) => (<FormItem><FormLabel>Business/User Impact</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="impactAnalysis.impactedTeams" render={({ field }) => (<FormItem><FormLabel>Teams impacted by this change</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="impactAnalysis.instructionsSent" render={({ field }) => (<FormItem><FormLabel>Instructions to upstream/downstream sent out</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="impactAnalysis.teamsToNotify" render={({ field }) => (<FormItem><FormLabel>Teams to be notified</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
        </SectionWrapper>
        
        <SectionWrapper title="Risk Assessment">
            <FormField control={form.control} name="riskAssessment.risk" render={({ field }) => (<FormItem><FormLabel>Risk</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select risk level" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="riskAssessment.mitigationPlan" render={({ field }) => (<FormItem><FormLabel>Risk Mitigation Plan</FormLabel><FormControl><Textarea {...field} /></FormControl><FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>What are the risks associated with this change and what should be done to mitigate them?</span></FormDescription><FormMessage /></FormItem>)} />
        </SectionWrapper>
        
        <SectionWrapper title="Implementation Plan">
            <FormField
              control={form.control}
              name="implementationPlan.implementationStartDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Implementation Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0,0,0,0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="implementationPlan.duration" render={({ field }) => (<FormItem><FormLabel>Implementation Time duration</FormLabel><FormControl><Input placeholder="e.g., 30 minutes" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            <div className="space-y-4">
                <FormLabel>Applications</FormLabel>
                {implAppFields.map((field, index) => (
                    <Card key={field.id} className="p-4 relative">
                        <div className="space-y-4">
                            <FormField control={form.control} name={`implementationPlan.applications.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Application Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <ChangeFields form={form} pathPrefix={`implementationPlan.applications.${index}.changes`} versionLabel="Release Version" />
                        </div>
                        {implAppFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeImplApp(index)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </Card>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendImplApp({ name: `Application ${implAppFields.length + 1}`, changes: {} })}><PlusCircle className="mr-2 h-4 w-4" /> Add Application</Button>
            </div>
            <FormItem>
                <FormLabel>Playbook</FormLabel>
                <FormDescription>Please attach PDF on Service Now.</FormDescription>
            </FormItem>
        </SectionWrapper>
        
        <SectionWrapper title="Validation Plan">
            <FormField control={form.control} name="validationPlan.duration" render={({ field }) => (<FormItem><FormLabel>Validation Time duration</FormLabel><FormControl><Input placeholder="e.g., 1 hour" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            <div className="space-y-4">
                <FormLabel>What to monitor during and post deployment</FormLabel>
                <FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>Example: Monitor API latency for endpoint X, check for 5xx errors in Splunk for service Y.</span></FormDescription>
                {valMonFields.map((field, index) => (
                    <Card key={field.id} className="p-4 relative">
                         <div className="space-y-4">
                            <FormField control={form.control} name={`validationPlan.monitoredChanges.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Change Name</FormLabel><FormControl><Input placeholder="e.g., API Response Time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`validationPlan.monitoredChanges.${index}.mms`} render={({ field }) => (<FormItem><FormLabel>MMS</FormLabel><FormControl><Input placeholder="MMS monitoring details" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`validationPlan.monitoredChanges.${index}.splunk`} render={({ field }) => (<FormItem><FormLabel>Splunk/Openobserve</FormLabel><FormControl><Input placeholder="Splunk query or dashboard link" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        {valMonFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeValMon(index)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </Card>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => appendValMon({ name: `Change ${valMonFields.length + 1}`})}><PlusCircle className="mr-2 h-4 w-4" /> Add Monitored Change</Button>
            </div>
            <FormField control={form.control} name="validationPlan.whenToRollback" render={({ field }) => (<FormItem><FormLabel>When to Rollback</FormLabel><FormControl><Textarea placeholder="Define rollback criteria" {...field} /></FormControl><FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>Example: If 5xx error rate exceeds 1% for 5 minutes, or if critical transaction failures are reported.</span></FormDescription><FormMessage /></FormItem>)} />
            <FormDescription>Post deployment attach the validation screenshots and close the CRQ.</FormDescription>
        </SectionWrapper>
        
        <SectionWrapper title="Backout Plan">
            <FormField control={form.control} name="backoutPlan.isTested" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Is Backout plan tested?</FormLabel>
                </FormItem>)} 
            />
             <div className="space-y-4">
                <FormLabel>Changes to Revert</FormLabel>
                <Card className="p-4"><ChangeFields form={form} pathPrefix="backoutPlan.changes" versionLabel="Previous Release Version" /></Card>
            </div>
             <div className="space-y-4">
                <FormLabel>What to monitor during and after backout</FormLabel>
                {backoutMonFields.map((field, index) => (
                    <Card key={field.id} className="p-4 relative">
                         <div className="space-y-4">
                            <FormField control={form.control} name={`backoutPlan.monitoredChanges.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Change Name</FormLabel><FormControl><Input placeholder="e.g., API Response Time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`backoutPlan.monitoredChanges.${index}.mms`} render={({ field }) => (<FormItem><FormLabel>MMS</FormLabel><FormControl><Input placeholder="MMS monitoring details" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`backoutPlan.monitoredChanges.${index}.splunk`} render={({ field }) => (<FormItem><FormLabel>Splunk/Openobserve</FormLabel><FormControl><Input placeholder="Splunk query or dashboard link" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        {backoutMonFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeBackoutMon(index)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </Card>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => appendBackoutMon({ name: `Change ${backoutMonFields.length + 1}`})}><PlusCircle className="mr-2 h-4 w-4" /> Add Monitored Change</Button>
            </div>
        </SectionWrapper>

        <div className="flex justify-end gap-4 pt-8">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save CRQ</Button>
        </div>
      </form>
    </Form>
    </TooltipProvider>
  )
}


// Dashboard Page Component
type Status = "Pending" | "Approved" | "Rejected" | "Implemented" | "Closed";
type CRQ = FormValues & { 
  id: string;
  sysId?: string;
  status: Status;
  reviewer?: string;
};

const getRiskBadgeVariant = (risk?: "Low" | "Medium" | "High") => {
  switch (risk) {
    case "High":
      return "destructive"
    case "Medium":
      return "secondary"
    case "Low":
    default:
      return "default"
  }
};

const getStatusBadgeVariant = (status?: Status) => {
    switch (status) {
        case 'Approved':
            return 'default';
        case 'Implemented':
            return 'default';
        case 'Rejected':
            return 'destructive';
        case 'Closed':
            return 'secondary';
        case 'Pending':
        default:
            return 'secondary';
    }
};

const CopySection = ({ title, content }: { title: string; content: string }) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content.trim()).then(() => {
      toast({
        title: `Copied ${title} to Clipboard!`,
      });
    }, () => {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy the template section.",
      });
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h4 className="font-headline font-semibold">{title}</h4>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <ClipboardCopy className="mr-2 h-3 w-3" />
          Copy
        </Button>
      </div>
      <div className="max-h-[250px] overflow-y-auto rounded-md border bg-muted/50 p-4">
        <pre className="text-sm whitespace-pre-wrap font-sans">{content.trim()}</pre>
      </div>
    </div>
  );
};


export default function DashboardPage() {
  const [crqs, setCrqs] = useState<CRQ[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [editingCrq, setEditingCrq] = useState<CRQ | null>(null);
  const [crqToCopy, setCrqToCopy] = useState<CRQ | null>(null);
  const { toast } = useToast();

  const [crqNumberFilter, setCrqNumberFilter] = useState('');
  const [summaryFilter, setSummaryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [reviewerFilter, setReviewerFilter] = useState('');

  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [selectedCrqForReview, setSelectedCrqForReview] = useState<CRQ | null>(null);
  const [statusToSetForReview, setStatusToSetForReview] = useState<Status | null>(null);

  useEffect(() => {
    const savedCrqsRaw = localStorage.getItem("crq_list");
    if (savedCrqsRaw) {
      try {
        const savedCrqs = JSON.parse(savedCrqsRaw) as CRQ[];
        const initializedCrqs = savedCrqs.map(crq => ({
            ...crq,
            id: crq.id || crypto.randomUUID(),
            sysId: crq.sysId || crypto.randomUUID(),
            status: crq.status || 'Pending',
        }));
        setCrqs(initializedCrqs);
      } catch (error) {
        console.error("Failed to parse CRQs from localStorage", error);
        localStorage.removeItem("crq_list");
      }
    }
  }, []);

  const handleSave = (data: FormValues) => {
    let updatedCrqs: CRQ[];
    let savedCrq: CRQ;

    if (editingCrq) {
      savedCrq = { ...editingCrq, ...data };
      updatedCrqs = crqs.map(crq => crq.id === editingCrq.id ? savedCrq : crq);
       toast({
        title: "CRQ Updated",
        description: "Your changes have been saved.",
      });
    } else {
      savedCrq = { ...data, id: crypto.randomUUID(), sysId: crypto.randomUUID(), status: "Pending" };
      updatedCrqs = [...crqs, savedCrq];
       toast({
        title: "CRQ Submitted",
        description: "Your new CRQ has been added to the dashboard.",
      });
    }

    setCrqs(updatedCrqs);
    localStorage.setItem("crq_list", JSON.stringify(updatedCrqs));
    setIsFormOpen(false);
    setEditingCrq(null);

    setCrqToCopy(savedCrq);
    setIsCopyOpen(true);
  };
  
  const handleStatusChange = (crq: CRQ, status: Status) => {
    if ((status === 'Approved' || status === 'Rejected') && !crq.reviewer) {
      setSelectedCrqForReview(crq);
      setStatusToSetForReview(status);
      setIsReviewerModalOpen(true);
    } else {
      updateCrqStatus(crq.id, status, crq.reviewer);
    }
  };
  
  const handleConfirmReview = () => {
    if (selectedCrqForReview && statusToSetForReview && reviewerName) {
      updateCrqStatus(selectedCrqForReview.id, statusToSetForReview, reviewerName);
      setIsReviewerModalOpen(false);
      setReviewerName('');
      setSelectedCrqForReview(null);
      setStatusToSetForReview(null);
    } else {
      toast({
        variant: "destructive",
        title: "Reviewer name is required.",
      });
    }
  };

  const updateCrqStatus = (id: string, status: Status, reviewer?: string) => {
    const updatedCrqs = crqs.map(crq =>
        crq.id === id ? { ...crq, status, reviewer: reviewer || crq.reviewer } : crq
    );
    setCrqs(updatedCrqs);
    localStorage.setItem('crq_list', JSON.stringify(updatedCrqs));
    toast({
        title: `CRQ status updated to ${status}.`,
    });
  };

  const handleOpenNew = () => {
    setEditingCrq(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (crq: CRQ) => {
    setEditingCrq(crq);
    setIsFormOpen(true);
  };

  const generateCopySections = (crq: CRQ | null): Record<string, string> => {
    if (!crq) return {};
  
    const { summary, briefDescription, purpose, testResults, impactAnalysis, implementationPlan, validationPlan, backoutPlan, riskAssessment } = crq;

    const testResultsText = [
      `Functional: ${testResults.functional ? 'Yes - Attached on ServiceNow' : 'No'}`,
      `Regression: ${testResults.regression ? 'Yes - Attached on ServiceNow' : 'No'}`,
      `Performance: ${testResults.performance ? 'Yes - Attached on ServiceNow' : 'No'}`,
    ].join('\n  ');
    
    const impactAnalysisText = [
      `Burst Area - Overall: ${impactAnalysis.burstAreaOverall || 'N/A'}`,
      `Burst Area - Tender: ${impactAnalysis.burstAreaTender || 'N/A'}`,
      `Possible impact areas: ${impactAnalysis.possibleImpactAreas || 'N/A'}`,
      `Business/User Impact: ${impactAnalysis.businessUserImpact || 'N/A'}`,
      `Teams impacted by this change: ${impactAnalysis.impactedTeams || 'N/A'}`,
      `Instructions to upstream/downstream sent out: ${impactAnalysis.instructionsSent || 'N/A'}`,
      `Teams to be notified: ${impactAnalysis.teamsToNotify || 'N/A'}`,
    ].join('\n    ');
    
    const riskText = [
        `Risk: ${riskAssessment?.risk || 'N/A'}`,
        `Mitigation Plan: ${riskAssessment?.mitigationPlan || 'N/A'}`
    ].join('\n    ');
    
    const descriptionText = [
      `Brief Description of the change: \n  ${briefDescription}`,
      `Release notes confluence page: \n  Attached on ServiceNow`,
      `Purpose of the change: \n  ${purpose}`,
      `Test results: \n  ${testResultsText}`,
      `Impact Analysis & Communication: \n    ${impactAnalysisText}`,
      `Risk Assessment: \n    ${riskText}`
    ].join('\n\n  ');


    const implementationAppsText = implementationPlan.applications.map(app => 
`  Application: ${app.name}
    Changes in:
      Code: ${app.changes.code ? `Yes - Release Version: ${app.changes.codeVersion || 'N/A'}` : 'No'}
      CCM: ${app.changes.ccm ? `Yes - Release Version: ${app.changes.ccmVersion || 'N/A'}` : 'No'}
      DB: ${app.changes.db ? `Yes - Release Version: ${app.changes.dbVersion || 'N/A'}` : 'No'}
      Akeyless: ${app.changes.akeyless ? `Yes - Release Version: ${app.changes.akeylessVersion || 'N/A'}` : 'No'}`
    ).join('\n');

    const validationChangesText = validationPlan.monitoredChanges.map(change => 
`    Change: ${change.name}
      Monitor:
        MMS: ${change.mms || 'N/A'}
        Splunk/Openobserve: ${change.splunk || 'N/A'}`
    ).join('\n');
    
    const backoutChangesText = backoutPlan.monitoredChanges.map(change =>
`    Change: ${change.name}
      Monitor:
        MMS: ${change.mms || 'N/A'}
        Splunk/Openobserve: ${change.splunk || 'N/A'}`
    ).join('\n');

    return {
      "Summary": summary,
      "Description": descriptionText,
      "Implementation plan": `
  Implementation Start Date: ${implementationPlan.implementationStartDate ? format(new Date(implementationPlan.implementationStartDate), "PPP") : 'N/A'}
  Implementation Time duration: ${implementationPlan.duration || "N/A"}
${implementationAppsText}
  Playbook: Attached on ServiceNow
      `.trim(),

      "Validation plan": `
  Validation Time duration: ${validationPlan.duration || "N/A"}

  What to monitor during and post deployment:
${validationChangesText}

  When to Rollback: ${validationPlan.whenToRollback || "N/A"}
  Post deployment attach the validation screenshots and close the CRQ.
      `.trim(),

      "Backout plan": `
  Is Backout plan tested?: ${backoutPlan.isTested ? "Yes" : "No"}

  Changes to Revert:
    Code: ${backoutPlan.changes.code ? `Yes - Previous Release Version: ${backoutPlan.changes.codeVersion || 'N/A'}` : 'No'}
    CCM: ${backoutPlan.changes.ccm ? `Yes - Previous Release Version: ${backoutPlan.changes.ccmVersion || 'N/A'}` : 'No'}
    DB: ${backoutPlan.changes.db ? `Yes - Previous Release Version: ${backoutPlan.changes.dbVersion || 'N/A'}` : 'No'}
    Akeyless: ${backoutPlan.changes.akeyless ? `Yes - Previous Release Version: ${backoutPlan.changes.akeylessVersion || 'N/A'}` : 'No'}

  What to monitor during and after backout:
${backoutChangesText}
      `.trim(),
    }
  };

  const filteredCrqs = crqs
    .filter(crq => statusFilter === 'All' || crq.status === statusFilter)
    .filter(crq => riskFilter === 'All' || crq.riskAssessment?.risk === riskFilter)
    .filter(crq => !crqNumberFilter || crq.crqNumber?.toLowerCase().includes(crqNumberFilter.toLowerCase()))
    .filter(crq => !summaryFilter || crq.summary.toLowerCase().includes(summaryFilter.toLowerCase()))
    .filter(crq => !reviewerFilter || crq.reviewer?.toLowerCase().includes(reviewerFilter.toLowerCase()))
    .filter(crq => {
      if (!dateFilter) return true;
      if (!crq.implementationPlan.implementationStartDate) return false;
      const crqDate = new Date(crq.implementationPlan.implementationStartDate);
      return format(crqDate, 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">CRQ Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Create, manage, and track all your Change Requests here.
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <FilePlus className="mr-2 h-4 w-4" />
          New CRQ
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Filter Change Requests</CardTitle>
          <CardDescription>Use the filters below to find specific CRQs.</CardDescription>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 pt-4">
            <div className="space-y-1">
              <Label htmlFor="crq-number-filter">CRQ Number</Label>
              <Input id="crq-number-filter" placeholder="Search..." value={crqNumberFilter} onChange={e => setCrqNumberFilter(e.target.value)} />
            </div>
             <div className="space-y-1">
              <Label htmlFor="summary-filter">Summary</Label>
              <Input id="summary-filter" placeholder="Search..." value={summaryFilter} onChange={e => setSummaryFilter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter"><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Implemented">Implemented</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-filter">Risk</Label>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger id="risk-filter"><SelectValue placeholder="Select Risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Risks</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Implementation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reviewer-filter">Reviewer</Label>
              <Input id="reviewer-filter" placeholder="Search..." value={reviewerFilter} onChange={e => setReviewerFilter(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CRQ Number</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Implementation Date</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCrqs.length > 0 ? filteredCrqs.map((crq) => (
                <TableRow key={crq.id}>
                  <TableCell className="font-medium">
                    {crq.crqNumber ? (
                      <a
                        href={`https://walmartglobal.service-now.com/wm_sp?id=ticket&table=change_request&sys_id=${crq.sysId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {crq.crqNumber}
                      </a>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>{crq.summary}</TableCell>
                  <TableCell>
                    <Badge variant={getRiskBadgeVariant(crq.riskAssessment?.risk)}>{crq.riskAssessment?.risk || 'N/A'}</Badge>
                  </TableCell>
                   <TableCell>
                    <Badge variant={getStatusBadgeVariant(crq.status)}>{crq.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {crq.implementationPlan.implementationStartDate
                        ? format(new Date(crq.implementationPlan.implementationStartDate), "PPP")
                        : 'N/A'}
                  </TableCell>
                  <TableCell>{crq.reviewer || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleOpenEdit(crq)} disabled={crq.status === 'Closed'}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Approved')} disabled={crq.status === 'Closed' || crq.status === 'Approved'}>Approve</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Rejected')} disabled={crq.status === 'Closed' || crq.status === 'Rejected'}>Reject</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Implemented')} disabled={crq.status === 'Closed' || crq.status === 'Implemented'}>Mark as Implemented</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Closed')} disabled={crq.status === 'Closed'}>Mark as Closed</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No CRQs found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">{editingCrq ? 'Edit CRQ' : 'Create New CRQ'}</DialogTitle>
            <DialogDescription>
              {editingCrq ? 'Update the details of your CRQ.' : 'Fill out the form below to create a new CRQ.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-6 -mr-6">
            <CrqFormComponent 
              key={editingCrq?.id || 'new'} 
              initialData={editingCrq} 
              onSave={handleSave} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline">CRQ Saved Successfully</DialogTitle>
            <DialogDescription>
              Your CRQ has been saved. You can copy the generated template sections below.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
            {Object.entries(generateCopySections(crqToCopy)).map(([title, content]) => (
              content ? <CopySection key={title} title={title} content={content} /> : null
            ))}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCopyOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isReviewerModalOpen} onOpenChange={setIsReviewerModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Enter Reviewer Name</AlertDialogTitle>
                <AlertDialogDescription>
                    Please enter your name to confirm the status change.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="reviewer-name" className="text-right">
                        Name
                    </Label>
                    <Input
                        id="reviewer-name"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="col-span-3"
                    />
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setReviewerName(''); setIsReviewerModalOpen(false); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmReview}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
