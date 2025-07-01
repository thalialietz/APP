
"use client"

import { useEffect, useState, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { FilePlus, Edit, ClipboardCopy, MoreHorizontal, Calendar as CalendarIcon, PlusCircle, Trash2, HelpCircle, Settings, Download, X } from "lucide-react"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx';

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
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

// CONFIGURATION & TYPES
type CustomField = {
  id: string;
  label: string;
  group: string;
};

const CUSTOM_FIELD_GROUPS = [
    'Description',
    'Impact Analysis & Communication',
    'Risk Assessment',
    'Implementation Plan',
    'Validation Plan',
    'Backout Plan'
];

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
  deploymentDiffLink: z.string().optional(),
  purpose: z.string().min(1, "Purpose is required."),
  comments: z.string().optional(),
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
  }).optional(),
  riskAssessment: z.object({
    risk: z.enum(["Low", "Medium", "High"]).optional(),
    mitigationPlan: z.string().optional(),
  }).optional(),
  implementationPlan: z.object({
    implementationStartDate: z.date().optional(),
    duration: z.string().optional(),
    applications: z.array(applicationSchema).min(1, "At least one application is required."),
  }),
  validationPlan: z.object({
    duration: z.string().optional(),
    monitoredChanges: z.array(monitoredChangeSchema).min(1, "At least one monitored change is required."),
    whenToRollback: z.string().optional(),
  }).optional(),
  backoutPlan: z.object({
    isTested: z.boolean().default(false),
    changes: applicationChangesSchema,
    monitoredChanges: z.array(monitoredChangeSchema).min(1, "At least one monitored change is required."),
  }),
  customData: z.record(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const ALL_POSSIBLE_FIELDS = [
    { id: 'impactAnalysis.burstAreaOverall', label: 'Overall Impact %', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.burstAreaTender', label: 'Specific Tender Impact %', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.possibleImpactAreas', label: 'Possible impact areas', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.businessUserImpact', label: 'Business/User Impact', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.impactedTeams', label: 'Teams impacted by this change', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.instructionsSent', label: 'Instructions to upstream/downstream sent out', section: 'Impact Analysis & Communication' },
    { id: 'impactAnalysis.teamsToNotify', label: 'Teams to be notified', section: 'Impact Analysis & Communication' },
    { id: 'riskAssessment.mitigationPlan', label: 'Risk Mitigation Plan', section: 'Risk Assessment' },
    { id: 'implementationPlan.duration', label: 'Implementation Duration (hours)', section: 'Implementation Plan' },
    { id: 'validationPlan.duration', label: 'Validation Time duration', section: 'Validation Plan' },
    { id: 'validationPlan.whenToRollback', label: 'When to Rollback', section: 'Validation Plan' },
    { id: 'backoutPlan.isTested', label: 'Is Backout plan tested?', section: 'Backout Plan' },
];

const DASHBOARD_COLUMNS = [
    { id: 'crqNumber', label: 'CRQ Number' },
    { id: 'summary', label: 'Summary' },
    { id: 'risk', label: 'Risk' },
    { id: 'status', label: 'Status' },
    { id: 'implementationDate', label: 'Implementation Date' },
    { id: 'reviewer', label: 'Reviewer' },
];

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
    } finally {
        setIsInitialized(true);
    }
  }, [key]);

  useEffect(() => {
    if (isInitialized) {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }
  }, [key, storedValue, isInitialized]);


  return [storedValue, setStoredValue] as const;
}

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

const DynamicFormFields = ({ form, fields, group }: { form: any; fields: CustomField[]; group: string }) => {
  const groupFields = fields.filter(f => f.group === group);
  if (groupFields.length === 0) return null;

  return (
    <>
      {groupFields.map(field => (
        <FormField
          key={field.id}
          control={form.control}
          name={`customData.${field.id}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>{field.label}</FormLabel>
              <FormControl>
                <Input placeholder={`Enter ${field.label}`} {...formField} value={formField.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </>
  );
};

function CrqFormComponent({ 
  initialData, 
  onSave, 
  onCancel,
  enabledFields,
  customFields,
}: {
  initialData: (FormValues & { implementationPlan: { implementationStartDate?: string | Date }}) | null;
  onSave: (data: FormValues) => void;
  onCancel: () => void;
  enabledFields: string[];
  customFields: CustomField[];
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
      deploymentDiffLink: "",
      purpose: "",
      comments: "",
      testResults: { functional: false, regression: false, performance: false },
      impactAnalysis: {},
      riskAssessment: { risk: "Low" },
      implementationPlan: { applications: [{ name: 'Application 1', changes: {} }] },
      validationPlan: { monitoredChanges: [{ name: 'Change 1'}] },
      backoutPlan: { isTested: false, changes: {}, monitoredChanges: [{ name: 'Change 1' }] },
      customData: {},
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

  const isFieldEnabled = (id: string) => enabledFields.includes(id);

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-12">
      <div className="space-y-6">
          <FormField control={form.control} name="crqNumber" render={({ field }) => (<FormItem><FormLabel>CRQ Number (Optional)</FormLabel><FormControl><Input placeholder="e.g. CHG123456" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Add this when the CRQ is officially created in ServiceNow.</FormDescription><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="summary" render={({ field }) => (<FormItem><FormLabel>Summary</FormLabel><FormControl><Textarea placeholder="A brief, one-sentence summary of the change." {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>

      <SectionWrapper title="Description">
          <FormItem>
            <FormLabel>Release notes confluence page</FormLabel>
            <FormDescription>Please attach PDF on Service Now.</FormDescription>
          </FormItem>
          <FormField
            control={form.control}
            name="deploymentDiffLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link to Deployment Differences</FormLabel>
                <FormControl><Input placeholder="Link to PR, diff, or comparison document" {...field} value={field.value ?? ''} /></FormControl>
                <FormDescription>Provide a link showing the differences between the current production build and the new build.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={form.control} name="purpose" render={({ field }) => (<FormItem><FormLabel>Purpose of the Change</FormLabel><FormControl><Textarea placeholder="Explain why this change is necessary (e.g., new feature, bug fix, compliance)." {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Comments (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional comments." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            <div className="space-y-4">
              <FormLabel>Test Results</FormLabel>
              {renderTestResultFields("functional", "Functional")}
              {renderTestResultFields("regression", "Regression")}
              {renderTestResultFields("performance", "Performance")}
          </div>
          <DynamicFormFields form={form} fields={customFields} group="Description" />
      </SectionWrapper>
      
      <SectionWrapper title="Impact Analysis & Communication">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {isFieldEnabled("impactAnalysis.burstAreaOverall") && <FormField control={form.control} name="impactAnalysis.burstAreaOverall" render={({ field }) => (<FormItem><FormLabel>Overall Impact %</FormLabel><FormControl><Input placeholder="e.g., 5%" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
              {isFieldEnabled("impactAnalysis.burstAreaTender") && <FormField control={form.control} name="impactAnalysis.burstAreaTender" render={({ field }) => (<FormItem><FormLabel>Specific Tender Impact %</FormLabel><FormControl><Input placeholder="e.g., 20% of Card payments" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
          </div>
            <FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>Burst area helps stakeholders quickly understand the change's blast radius.</span></FormDescription>
          {isFieldEnabled("impactAnalysis.possibleImpactAreas") && <FormField control={form.control} name="impactAnalysis.possibleImpactAreas" render={({ field }) => (<FormItem><FormLabel>Possible impact areas</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
          {isFieldEnabled("impactAnalysis.businessUserImpact") && <FormField control={form.control} name="impactAnalysis.businessUserImpact" render={({ field }) => (<FormItem><FormLabel>Business/User Impact</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />}
          {isFieldEnabled("impactAnalysis.impactedTeams") && <FormField control={form.control} name="impactAnalysis.impactedTeams" render={({ field }) => (<FormItem><FormLabel>Teams impacted by this change</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />}
          {isFieldEnabled("impactAnalysis.instructionsSent") && <FormField control={form.control} name="impactAnalysis.instructionsSent" render={({ field }) => (<FormItem><FormLabel>Instructions to upstream/downstream sent out</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />}
          {isFieldEnabled("impactAnalysis.teamsToNotify") && <FormField control={form.control} name="impactAnalysis.teamsToNotify" render={({ field }) => (<FormItem><FormLabel>Teams to be notified</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />}
          <DynamicFormFields form={form} fields={customFields} group="Impact Analysis & Communication" />
      </SectionWrapper>
      
      <SectionWrapper title="Risk Assessment">
          <FormField control={form.control} name="riskAssessment.risk" render={({ field }) => (<FormItem><FormLabel>Risk</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select risk level" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
          {isFieldEnabled("riskAssessment.mitigationPlan") && <FormField control={form.control} name="riskAssessment.mitigationPlan" render={({ field }) => (<FormItem><FormLabel>Risk Mitigation Plan</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>What are the risks associated with this change and what should be done to mitigate them?</span></FormDescription><FormMessage /></FormItem>)} />}
          <DynamicFormFields form={form} fields={customFields} group="Risk Assessment" />
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
          {isFieldEnabled("implementationPlan.duration") && <FormField control={form.control} name="implementationPlan.duration" render={({ field }) => (<FormItem><FormLabel>Implementation Duration (hours)</FormLabel><FormControl><Input type="number" placeholder="e.g. 2" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
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
          <DynamicFormFields form={form} fields={customFields} group="Implementation Plan" />
      </SectionWrapper>
      
      <SectionWrapper title="Validation Plan">
          {isFieldEnabled("validationPlan.duration") && <FormField control={form.control} name="validationPlan.duration" render={({ field }) => (<FormItem><FormLabel>Validation Time duration</FormLabel><FormControl><Input placeholder="e.g., 1 hour" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
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
          {isFieldEnabled("validationPlan.whenToRollback") && <FormField control={form.control} name="validationPlan.whenToRollback" render={({ field }) => (<FormItem><FormLabel>When to Rollback</FormLabel><FormControl><Textarea placeholder="Define rollback criteria" {...field} value={field.value ?? ''} /></FormControl><FormDescription className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /><span>Example: If 5xx error rate exceeds 1% for 5 minutes, or if critical transaction failures are reported.</span></FormDescription><FormMessage /></FormItem>)} />}
          <FormDescription>Post deployment attach the validation screenshots and close the CRQ.</FormDescription>
          <DynamicFormFields form={form} fields={customFields} group="Validation Plan" />
      </SectionWrapper>
      
      <SectionWrapper title="Backout Plan">
        {isFieldEnabled("backoutPlan.isTested") && (
            <FormField
                control={form.control}
                name="backoutPlan.isTested"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-normal">Is Backout plan tested?</FormLabel>
                    </FormItem>
                )}
            />
        )}
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
          <DynamicFormFields form={form} fields={customFields} group="Backout Plan" />
      </SectionWrapper>

      <div className="flex justify-end gap-4 pt-8">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save CRQ</Button>
      </div>
    </form>
  </Form>
  );
}

type Status = "Pending" | "Approved" | "Declined" | "Implemented" | "Closed";
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
        case 'Declined':
            return 'destructive';
        case 'Closed':
            return 'outline';
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

const generateCopySections = (crq: CRQ | null, customFields: CustomField[]): Record<string, string> => {
    if (!crq) return {};
  
    const { summary, purpose, comments, testResults, impactAnalysis, implementationPlan, validationPlan, backoutPlan, riskAssessment, customData, deploymentDiffLink } = crq;

    const getCustomFieldsText = (group: string, indent = '  ') => {
        return customFields
            .filter(f => f.group === group && customData?.[f.id])
            .map(f => `${indent}${f.label}: ${customData?.[f.id] || 'N/A'}`)
            .join('\n');
    };

    const descriptionText = [
      `Release notes confluence page: \n  Attached on ServiceNow`,
      `Link to Deployment Differences: \n  ${deploymentDiffLink || 'N/A'}`,
      `Purpose of the change: \n  ${purpose}`,
      `Comments: \n  ${comments || 'N/A'}`,
      `Test results: \n  ` + [
        `Functional: ${testResults.functional ? 'Yes - Attached on ServiceNow' : 'No'}`,
        `Regression: ${testResults.regression ? 'Yes - Attached on ServiceNow' : 'No'}`,
        `Performance: ${testResults.performance ? 'Yes - Attached on ServiceNow' : 'No'}`,
      ].join('\n  '),
      getCustomFieldsText('Description')
    ].filter(Boolean).join('\n\n');

    const impactCommunicationText = [
        `Burst Area - Overall: ${impactAnalysis?.burstAreaOverall || 'N/A'}`,
        `Burst Area - Tender: ${impactAnalysis?.burstAreaTender || 'N/A'}`,
        `Possible impact areas: ${impactAnalysis?.possibleImpactAreas || 'N/A'}`,
        `Business/User Impact: ${impactAnalysis?.businessUserImpact || 'N/A'}`,
        `Teams impacted by this change: ${impactAnalysis?.impactedTeams || 'N/A'}`,
        `Instructions to upstream/downstream sent out: ${impactAnalysis?.instructionsSent || 'N/A'}`,
        `Teams to be notified: ${impactAnalysis?.teamsToNotify || 'N/A'}`,
        getCustomFieldsText('Impact Analysis & Communication', '')
    ].filter(Boolean).join('\n    ');

    const riskAssessmentText = [
        `Risk: ${riskAssessment?.risk || 'N/A'}`,
        `Mitigation Plan: ${riskAssessment?.mitigationPlan || 'N/A'}`,
        getCustomFieldsText('Risk Assessment', '')
    ].filter(Boolean).join('\n    ');


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
      ...(impactCommunicationText.trim() ? { "Impact Analysis & Communication": impactCommunicationText } : {}),
      ...(riskAssessmentText.trim() ? { "Risk Assessment": riskAssessmentText } : {}),
      "Implementation plan": `
${implementationAppsText}
  Playbook: Attached on ServiceNow
${getCustomFieldsText('Implementation Plan')}
      `.trim(),

      "Validation plan": `
  Validation Time duration: ${validationPlan?.duration || "N/A"}

  What to monitor during and post deployment:
${validationChangesText}

  When to Rollback: ${validationPlan?.whenToRollback || "N/A"}
  Post deployment attach the validation screenshots and close the CRQ.
${getCustomFieldsText('Validation Plan')}
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
${getCustomFieldsText('Backout Plan')}
      `.trim(),
    }
  };


export default function DashboardPage() {
  const [crqs, setCrqs] = useLocalStorage<CRQ[]>("crq_list_v3", []);
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

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [configTarget, setConfigTarget] = useState<'fields' | 'groups' | null>(null);
  const ADMIN_PASSWORD = 'admin';

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCrqForDetails, setSelectedCrqForDetails] = useState<CRQ | null>(null);
  
  const [configurableFields, setConfigurableFields] = useLocalStorage<string[]>(
    'crq_configurable_fields_v1',
    ALL_POSSIBLE_FIELDS.map(f => f.id)
  );
  
  const [customFields, setCustomFields] = useLocalStorage<CustomField[]>(
    'crq_custom_fields_v1',
    []
  );

  const handleSave = (data: FormValues) => {
    let updatedCrqs: CRQ[];
    let savedCrq: CRQ;

    if (editingCrq) {
      savedCrq = { ...editingCrq, ...data, status: "Pending", reviewer: undefined };
      updatedCrqs = crqs.map(crq => crq.id === editingCrq.id ? savedCrq : crq);
       toast({
        title: "CRQ Updated",
        description: "Your changes have been saved. Status has been reset to Pending.",
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
    setIsFormOpen(false);
    setEditingCrq(null);

    setCrqToCopy(savedCrq);
    setIsCopyOpen(true);
  };
  
  const handleStatusChange = (crq: CRQ, status: Status) => {
    if ((status === 'Approved' || status === 'Declined') && !crq.reviewer) {
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
  
  const handleRowClick = (crq: CRQ) => {
    setSelectedCrqForDetails(crq);
    setIsDetailsModalOpen(true);
  };

  const handleExport = (columnsToExport: string[]) => {
    const data = filteredCrqs.map(crq => {
        const row: { [key: string]: any } = {};
        if (columnsToExport.includes('crqNumber')) row['CRQ Number'] = crq.crqNumber || 'N/A';
        if (columnsToExport.includes('summary')) row['Summary'] = crq.summary;
        if (columnsToExport.includes('risk')) row['Risk'] = crq.riskAssessment?.risk || 'N/A';
        if (columnsToExport.includes('status')) row['Status'] = crq.status;
        if (columnsToExport.includes('implementationDate')) {
            row['Implementation Date'] = crq.implementationPlan.implementationStartDate
                ? format(new Date(crq.implementationPlan.implementationStartDate), "yyyy-MM-dd")
                : 'N/A';
        }
        if (columnsToExport.includes('reviewer')) row['Reviewer'] = crq.reviewer || 'N/A';

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CRQs');
    XLSX.writeFile(workbook, 'CRQ_Export.xlsx');

    toast({ title: 'Export Successful', description: 'CRQ_Export.xlsx has been downloaded.' });
    setIsExportModalOpen(false);
  };

  const handleOpenConfigurableFields = () => {
    setConfigTarget('fields');
    setIsPasswordModalOpen(true);
  };

  const handleOpenGroups = () => {
    setConfigTarget('groups');
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
        setIsPasswordModalOpen(false);
        setPasswordInput('');
        if (configTarget === 'fields') {
            setIsConfigModalOpen(true);
        } else if (configTarget === 'groups') {
            setIsGroupsModalOpen(true);
        }
    } else {
        toast({
            variant: "destructive",
            title: "Incorrect password",
        });
        setPasswordInput('');
    }
  };

  const handleClearFilters = () => {
    setCrqNumberFilter('');
    setSummaryFilter('');
    setStatusFilter('All');
    setRiskFilter('All');
    setDateFilter(undefined);
    setReviewerFilter('');
  };

  const filteredCrqs = useMemo(() => 
    crqs
    .filter(crq => !crqNumberFilter || crq.crqNumber?.toLowerCase().includes(crqNumberFilter.toLowerCase()))
    .filter(crq => !summaryFilter || crq.summary.toLowerCase().includes(summaryFilter.toLowerCase()))
    .filter(crq => statusFilter === 'All' || crq.status === statusFilter)
    .filter(crq => riskFilter === 'All' || crq.riskAssessment?.risk === riskFilter)
    .filter(crq => !reviewerFilter || crq.reviewer?.toLowerCase().includes(reviewerFilter.toLowerCase()))
    .filter(crq => {
      if (!dateFilter) return true;
      if (!crq.implementationPlan.implementationStartDate) return false;
      const crqDate = new Date(crq.implementationPlan.implementationStartDate);
      return format(crqDate, 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');
    }), [crqs, crqNumberFilter, summaryFilter, statusFilter, riskFilter, reviewerFilter, dateFilter]);

  const memoizedCopySections = useMemo(() => generateCopySections(crqToCopy, customFields), [crqToCopy, customFields]);
  const memoizedDetailsSections = useMemo(() => generateCopySections(selectedCrqForDetails, customFields), [selectedCrqForDetails, customFields]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">CRQ Tracker</h1>
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleOpenNew}><FilePlus className="mr-2 h-4 w-4" /> New CRQ</Button>
            <Button variant="outline" onClick={handleOpenConfigurableFields}><Settings className="mr-2 h-4 w-4" /> Configurable Fields</Button>
            <Button variant="outline" onClick={handleOpenGroups}>Groups</Button>
            <Button variant="outline" onClick={() => setIsExportModalOpen(true)}><Download className="mr-2 h-4 w-4" /> Export to Excel</Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="crq-filter">CRQ Number</Label>
                <Input id="crq-filter" placeholder="Search..." value={crqNumberFilter} onChange={e => setCrqNumberFilter(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="summary-filter">Summary</Label>
                <Input id="summary-filter" placeholder="Search..." value={summaryFilter} onChange={e => setSummaryFilter(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Declined">Declined</SelectItem>
                        <SelectItem value="Implemented">Implemented</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="risk-filter">Risk</Label>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger id="risk-filter"><SelectValue placeholder="All Risks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Risks</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date-filter">Implementation Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-filter"
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
              <div className="grid gap-1.5">
                <Label htmlFor="reviewer-filter">Reviewer</Label>
                <Input id="reviewer-filter" placeholder="Search..." value={reviewerFilter} onChange={e => setReviewerFilter(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
        </CardContent>
        <div className="border-t">
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
                <TableRow key={crq.id} onClick={() => handleRowClick(crq)} className="cursor-pointer">
                  <TableCell className="font-medium">
                    {crq.crqNumber ? (
                      <a
                        href={`https://walmartglobal.service-now.com/nav_to.do?uri=task.do?sysparm_query=number=${crq.crqNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {crq.crqNumber}
                      </a>
                    ) : (
                      'N/A'
                    )}
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleOpenEdit(crq)} disabled={crq.status === 'Implemented' || crq.status === 'Closed'}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Approved')} disabled={['Approved', 'Implemented', 'Closed'].includes(crq.status)}>Approve</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Declined')} disabled={['Declined', 'Implemented', 'Closed'].includes(crq.status)}>Decline</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(crq, 'Implemented')} disabled={crq.status === 'Implemented' || crq.status === 'Closed'}>Mark as Implemented</DropdownMenuItem>
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
        </div>
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
              enabledFields={configurableFields}
              customFields={customFields}
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
            {Object.entries(memoizedCopySections).map(([title, content]) => (
              content.trim() ? <CopySection key={title} title={title} content={content} /> : null
            ))}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCopyOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline">CRQ Details</DialogTitle>
             <DialogDescription>
               Read-only view of the CRQ. Use the copy buttons for individual sections.
             </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
            {Object.entries(memoizedDetailsSections).map(([title, content]) => (
              content.trim() ? <CopySection key={title} title={title} content={content} /> : null
            ))}
          </div>
           <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
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

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Admin Access Required</DialogTitle>
                  <DialogDescription>
                      Please enter the admin password to modify configuration.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="admin-password" className="text-right">
                          Password
                      </Label>
                      <Input
                          id="admin-password"
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="col-span-3"
                          onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="secondary" onClick={() => { setIsPasswordModalOpen(false); setPasswordInput(''); }}>Cancel</Button>
                  <Button onClick={handlePasswordSubmit}>Unlock</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <ConfigurableFieldsDialog
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        enabledFields={configurableFields}
        onSave={(fields) => {
          setConfigurableFields(fields);
          setIsConfigModalOpen(false);
        }}
        onOpenGroups={() => {
          setIsConfigModalOpen(false);
          setIsGroupsModalOpen(true);
        }}
      />
      
      <GroupsDialog
        isOpen={isGroupsModalOpen}
        onClose={() => setIsGroupsModalOpen(false)}
        customFields={customFields}
        onSave={setCustomFields}
      />

      <ExportDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
      />

    </div>
  )
}

function ConfigurableFieldsDialog({ isOpen, onClose, enabledFields, onSave, onOpenGroups }: { isOpen: boolean, onClose: () => void, enabledFields: string[], onSave: (fields: string[]) => void, onOpenGroups: () => void }) {
    const [localEnabledFields, setLocalEnabledFields] = useState(enabledFields);
    const { toast } = useToast();

    useEffect(() => {
        setLocalEnabledFields(enabledFields);
    }, [isOpen, enabledFields]);

    const handleToggle = (fieldId: string, checked: boolean) => {
        setLocalEnabledFields(prev =>
            checked ? [...prev, fieldId] : prev.filter(id => id !== fieldId)
        );
    };

    const handleSave = () => {
        onSave(localEnabledFields);
        toast({ title: "Configuration Saved", description: "Your form field settings have been updated."});
    };

    const groupedFields = useMemo(() => {
        return ALL_POSSIBLE_FIELDS.reduce((acc, field) => {
            (acc[field.section] = acc[field.section] || []).push(field);
            return acc;
        }, {} as Record<string, typeof ALL_POSSIBLE_FIELDS>);
    }, []);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Configure Form Fields</DialogTitle>
                    <DialogDescription>Select which optional fields to display on the CRQ form.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2 border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">Need more fields?</p>
                  <Button variant="link" className="p-0 h-auto" onClick={onOpenGroups}>Manage Custom Fields (Groups)</Button>
                </div>
                <ScrollArea className="max-h-[60vh] my-4 pr-4 -mr-4">
                    <div className="space-y-6">
                        {Object.entries(groupedFields).map(([section, fields]) => (
                            <div key={section}>
                                <h4 className="font-semibold text-lg mb-2">{section}</h4>
                                <div className="space-y-2 pl-4">
                                    {fields.map(field => (
                                        <FormItem key={field.id} className="flex flex-row items-center space-x-3 space-y-0">
                                            <Checkbox
                                                id={field.id}
                                                checked={localEnabledFields.includes(field.id)}
                                                onCheckedChange={(checked) => handleToggle(field.id, !!checked)}
                                            />
                                            <Label htmlFor={field.id} className="font-normal">{field.label}</Label>
                                        </FormItem>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Configuration</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GroupsDialog({ isOpen, onClose, customFields, onSave }: { isOpen: boolean, onClose: () => void, customFields: CustomField[], onSave: (fields: CustomField[]) => void }) {
    const [localFields, setLocalFields] = useState<CustomField[]>([]);
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldGroup, setNewFieldGroup] = useState(CUSTOM_FIELD_GROUPS[0]);
    const { toast } = useToast();

    useEffect(() => {
      setLocalFields(JSON.parse(JSON.stringify(customFields))); // Deep copy
    }, [isOpen, customFields]);
    
    const handleAddField = () => {
        if (!newFieldLabel.trim()) {
            toast({ variant: "destructive", title: "Field label cannot be empty."});
            return;
        }
        const newField: CustomField = {
            id: `custom_${new Date().getTime()}`,
            label: newFieldLabel.trim(),
            group: newFieldGroup,
        };
        setLocalFields(prev => [...prev, newField]);
        setNewFieldLabel('');
    };

    const handleDeleteField = (id: string) => {
        setLocalFields(prev => prev.filter(field => field.id !== id));
    };

    const handleSave = () => {
        onSave(localFields);
        toast({ title: "Groups Configuration Saved", description: "Your custom fields have been updated."});
        onClose();
    };

    const groupedFields = useMemo(() => {
        return localFields.reduce((acc, field) => {
            (acc[field.group] = acc[field.group] || []).push(field);
            return acc;
        }, {} as Record<string, CustomField[]>);
    }, [localFields]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Custom Fields (Groups)</DialogTitle>
                    <DialogDescription>Add or remove custom text fields from form sections.</DialogDescription>
                </DialogHeader>
                
                <div className="border-t border-b py-4 my-4">
                    <h4 className="font-semibold text-lg mb-2">Add New Field</h4>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow space-y-1">
                            <Label htmlFor="new-field-label">Field Label</Label>
                            <Input id="new-field-label" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="e.g., Monitoring Dashboard" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-field-group">Group</Label>
                             <Select value={newFieldGroup} onValueChange={setNewFieldGroup}>
                                <SelectTrigger id="new-field-group" className="w-[240px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CUSTOM_FIELD_GROUPS.map(group => <SelectItem key={group} value={group}>{group}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAddField}>Add</Button>
                    </div>
                </div>

                <ScrollArea className="max-h-[40vh] pr-4 -mr-4">
                    <h4 className="font-semibold text-lg mb-2">Existing Custom Fields</h4>
                    {localFields.length > 0 ? (
                        <div className="space-y-4">
                            {CUSTOM_FIELD_GROUPS.map(group => (
                                groupedFields[group] && groupedFields[group].length > 0 && (
                                <div key={group}>
                                    <h5 className="font-medium text-muted-foreground mb-1">{group}</h5>
                                    <ul className="space-y-1 pl-4">
                                        {groupedFields[group].map(field => (
                                            <li key={field.id} className="flex items-center justify-between">
                                                <span>{field.label}</span>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteField(field.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                )
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No custom fields have been added yet.</p>
                    )}
                </ScrollArea>
                
                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Configuration</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExportDialog({ isOpen, onClose, onExport }: { isOpen: boolean, onClose: () => void, onExport: (columns: string[]) => void }) {
    const [selectedColumns, setSelectedColumns] = useState<string[]>(DASHBOARD_COLUMNS.map(c => c.id));

    const handleToggle = (columnId: string, checked: boolean) => {
        setSelectedColumns(prev =>
            checked ? [...prev, columnId] : prev.filter(id => id !== columnId)
        );
    };

    const handleExportClick = () => {
        onExport(selectedColumns);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Export to Excel</DialogTitle>
                    <DialogDescription>Select which columns you want to export.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 my-4">
                    {DASHBOARD_COLUMNS.map(column => (
                        <FormItem key={column.id} className="flex flex-row items-center space-x-3 space-y-0">
                            <Checkbox
                                id={`export-${column.id}`}
                                checked={selectedColumns.includes(column.id)}
                                onCheckedChange={(checked) => handleToggle(column.id, !!checked)}
                            />
                            <Label htmlFor={`export-${column.id}`} className="font-normal">{column.label}</Label>
                        </FormItem>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleExportClick}>Export</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
