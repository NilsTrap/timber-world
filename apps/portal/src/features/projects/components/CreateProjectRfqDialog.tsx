"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectPartyWorkspace } from "../types";
import { createProjectRfqFromSpecification } from "../actions/projectRfqActions";

type Composer = NonNullable<ProjectPartyWorkspace["specificationRfq"]>;

export function CreateProjectRfqDialog({ sourceProjectId, composer }: { sourceProjectId: string; composer: Composer }) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [pending,startTransition]=useTransition();
  const [minimumDeadline]=useState(earliestDeadlineValue);
  const [lineIds,setLineIds]=useState(()=>composer.availableLines.map((line)=>line.id));
  const [candidateIds,setCandidateIds]=useState<string[]>([]);
  const [deadline,setDeadline]=useState(minimumDeadline);
  useEffect(()=>{
    const availableLineIds=new Set(composer.availableLines.map((line)=>line.id));
    const availableCandidateIds=new Set(composer.candidates.map((candidate)=>candidate.id));
    setLineIds((current)=>current.length?current.filter((id)=>availableLineIds.has(id)):composer.availableLines.map((line)=>line.id));
    setCandidateIds((current)=>current.filter((id)=>availableCandidateIds.has(id)));
  },[composer.availableLines,composer.candidates]);
  if(composer.existingProjectId)return <Button size="sm" asChild><Link href={`/projects/${composer.existingProjectId}`}>Manage RFQ</Link></Button>;
  const deadlineTime=new Date(deadline).getTime();
  const canSubmit=lineIds.length>=1&&lineIds.length<=500&&candidateIds.length>=2&&candidateIds.length<=20&&Number.isFinite(deadlineTime)&&deadlineTime>Date.now();
  function create(){
    startTransition(async()=>{
      const result=await createProjectRfqFromSpecification({projectId:sourceProjectId,lineItemIds:lineIds,candidateIds,deadline:new Date(deadlineTime).toISOString()});
      if(!result.success){toast.error(result.error);if(result.code==="CONFLICT")router.refresh();return;}
      toast.success("RFQ created");
      router.push(`/projects/${result.data.projectId}`);
    });
  }
  return <>
    <Button size="sm" disabled={composer.availableLines.length===0} onClick={()=>setOpen(true)}>Create RFQ</Button>
    <Dialog open={open} onOpenChange={(next)=>!pending&&setOpen(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Create RFQ</DialogTitle><DialogDescription>Select the specification scope, at least two suppliers, and a future quotation deadline.</DialogDescription></DialogHeader>
        <div className="space-y-5 py-2">
          <fieldset className="space-y-2"><legend className="font-medium">Specification lines</legend>
            {composer.availableLines.length===0?<p className="text-sm text-muted-foreground">At least one available specification line is required.</p>:composer.availableLines.map((line)=><label key={line.id} className="flex items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={lineIds.includes(line.id)} onChange={(event)=>setLineIds((current)=>event.target.checked?[...current,line.id]:current.filter((id)=>id!==line.id))}/><span><strong>{line.lineNo}. {line.productName}</strong><br/><span className="text-muted-foreground">Available: {line.quantity} {line.unit}</span></span></label>)}
          </fieldset>
          <fieldset className="space-y-2"><legend className="font-medium">Suppliers</legend>
            {composer.candidates.length===0?<p className="text-sm text-muted-foreground">No eligible suppliers are available.</p>:<div className="grid gap-2 sm:grid-cols-2">{composer.candidates.map((candidate)=><label key={candidate.id} className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={candidateIds.includes(candidate.id)} onChange={(event)=>setCandidateIds((current)=>event.target.checked?[...current,candidate.id]:current.filter((id)=>id!==candidate.id))}/>{candidate.name}</label>)}</div>}
          </fieldset>
          <div className="grid gap-1.5"><Label htmlFor="specification-rfq-deadline">Quotation deadline</Label><Input id="specification-rfq-deadline" type="datetime-local" min={minimumDeadline} value={deadline} onChange={(event)=>setDeadline(event.target.value)}/></div>
        </div>
        <DialogFooter><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={pending||!canSubmit} onClick={create}>{pending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Create RFQ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function earliestDeadlineValue():string{
  const tomorrow=new Date(Date.now()+24*60*60*1000);
  return new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60_000).toISOString().slice(0,16);
}
