"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectFileMeta } from "../types";
import { uploadProjectBrowserFile } from "./projectUploadClient";
import { checkProjectOfficialImageSlot, completeProjectOfficialImage, removeProjectOfficialImage, setProjectOfficialImagePrimary } from "../actions/projectOfficialImageActions";
import { deleteProjectFileAction } from "../actions/projectFileActions";

export function ProjectOfficialImages({projectId,initialFiles}:{projectId:string;initialFiles:ProjectFileMeta[]}) {
  const router=useRouter(); const [files,setFiles]=useState(initialFiles); const [busy,setBusy]=useState(false); const [open,setOpen]=useState(()=>initialFiles.some((file)=>file.officialImagePosition)); const input=useRef<HTMLInputElement>(null);
  const images=files.filter((file)=>file.officialImagePosition).sort((a,b)=>(a.officialImagePosition??0)-(b.officialImagePosition??0));
  useEffect(()=>setFiles(initialFiles),[initialFiles]);
  async function upload(selected:FileList|null){
    if(!selected?.length)return;
    const remaining=3-images.length;
    if(selected.length>remaining)return toast.error(`You can add ${remaining} more official image${remaining===1?"":"s"}`);
    setBusy(true);
    let uploadedId:string|null=null;
    try{
      for(const file of Array.from(selected)){
        if(!file.type.startsWith("image/"))throw new Error("Official project files must be images");
        const slot=await checkProjectOfficialImageSlot(projectId);if(!slot.success)throw new Error(slot.error);
        const uploaded=await uploadProjectBrowserFile(projectId,file,`Official images/${crypto.randomUUID()}-${file.name}`,()=>{});
        uploadedId=uploaded.id;
        const marked=await completeProjectOfficialImage(projectId,uploaded.id);if(!marked.success)throw new Error(marked.error);
        uploadedId=null;
        setFiles((current)=>[...current,{...uploaded,officialImagePosition:marked.data.position,previewUrl:URL.createObjectURL(file)}]);
        router.refresh();
      }
      toast.success("Official image uploaded");
    }catch(error){
      if(uploadedId){
        const cleanup=await deleteProjectFileAction(uploadedId);
        if(!cleanup.success)toast.error("The image could not be assigned or removed. Delete the uploaded image before retrying.");
        else toast.error(error instanceof Error?error.message:"Could not upload image");
      }else toast.error(error instanceof Error?error.message:"Could not upload image");
    }finally{setBusy(false);if(input.current)input.current.value="";}
  }
  async function remove(file:ProjectFileMeta){setBusy(true);try{const result=await removeProjectOfficialImage(projectId,file.id);if(!result.success)return toast.error(result.error);setFiles((current)=>{const remaining=current.filter((entry)=>entry.officialImagePosition&&entry.id!==file.id).sort((a,b)=>(a.officialImagePosition??0)-(b.officialImagePosition??0));const positions=new Map(remaining.map((entry,index)=>[entry.id,index+1]));return current.map((entry)=>entry.id===file.id?{...entry,officialImagePosition:null}:positions.has(entry.id)?{...entry,officialImagePosition:positions.get(entry.id)}:entry)});router.refresh();}finally{setBusy(false)}}
  async function makePrimary(file:ProjectFileMeta){
    if(file.officialImagePosition===1)return;
    setBusy(true);
    try{const result=await setProjectOfficialImagePrimary(projectId,file.id);
      if(!result.success)return toast.error(result.error);
      setFiles((current)=>{const reordered=[...current.filter((entry)=>entry.id===file.id),...current.filter((entry)=>entry.officialImagePosition&&entry.id!==file.id).sort((a,b)=>(a.officialImagePosition??0)-(b.officialImagePosition??0))];const positions=new Map(reordered.map((entry,index)=>[entry.id,index+1]));return current.map((entry)=>positions.has(entry.id)?{...entry,officialImagePosition:positions.get(entry.id)}:entry)});
      toast.success("Default project image updated");router.refresh();
    }finally{setBusy(false)}
  }
  return <section className="overflow-hidden rounded-lg border bg-card"><button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open} aria-controls="project-images-content" onClick={()=>setOpen((current)=>!current)}><span><span className="block text-xl font-semibold">Images</span><span className="block text-sm text-muted-foreground">{images.length > 0 ? `${images.length} of 3 project images` : "No images uploaded"}</span></span>{open?<ChevronUp className="h-4 w-4 text-muted-foreground"/>:<ChevronDown className="h-4 w-4 text-muted-foreground"/>}</button>{open?<div id="project-images-content" className="space-y-3 border-t p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Up to three project images. The default image appears first and is used in the projects list.</p><><input ref={input} className="hidden" type="file" accept="image/*" multiple onChange={(event)=>void upload(event.target.files)}/><Button type="button" size="sm" disabled={busy||images.length>=3} onClick={()=>input.current?.click()}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>} Upload images</Button></></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[0,1,2].map((slot)=>{const file=images[slot];const isDefault=file?.officialImagePosition===1;return <div key={slot} className="group relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg border bg-background">{file?<>{file.previewUrl?<Image src={file.previewUrl} alt={`Project image ${slot+1}`} fill unoptimized className="object-cover"/>:<ImageIcon className="h-6 w-6 text-muted-foreground/40"/>}<div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-background/90 p-2"><Button type="button" size="sm" variant={isDefault?"secondary":"ghost"} disabled={busy||isDefault} aria-label={isDefault?"Default project image":`Make project image ${slot+1} default`} className="text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 disabled:opacity-100" onClick={()=>void makePrimary(file)}>{isDefault?<><Check className="mr-1 h-3.5 w-3.5"/>Default</>:"Make default"}</Button><Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Remove project image ${slot+1}`} onClick={()=>void remove(file)}><Trash2 className="h-4 w-4"/></Button></div></>:<ImageIcon className="h-6 w-6 text-muted-foreground/40"/>}</div>})}</div></div>:null}</section>;
}
