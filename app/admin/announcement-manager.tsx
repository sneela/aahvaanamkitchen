'use client';

import { useEffect, useState, type FormEvent } from 'react';

export type Announcement = {
  id: string; title: string; message: string; kind: 'notice' | 'special';
  action_label: string; action_href: string; is_published: boolean;
  starts_at: string | null; ends_at: string | null; sort_order: number;
};
type Save = (method:'POST'|'PATCH'|'DELETE', data:Record<string,unknown>)=>Promise<boolean>;
const draft = ():Announcement=>({id:'',title:'',message:'',kind:'notice',action_label:'',action_href:'',
  is_published:true,starts_at:null,ends_at:null,sort_order:100});
type BannerVisibility = { label:string; details:string; state:'live'|'scheduled'|'draft'|'expired' };
function visibility(a:Announcement):BannerVisibility {
  if(!a.is_published) return {label:'Draft — hidden',details:'Check Publish banner and save to make this visible.',state:'draft'};
  const now=Date.now();
  if(a.starts_at && Date.parse(a.starts_at)>now)
    return {label:'Scheduled',details:'The banner will appear after its scheduled start time.',state:'scheduled'};
  if(a.ends_at && Date.parse(a.ends_at)<now)
    return {label:'Expired — hidden',details:'Change or remove the end time and save to display it again.',state:'expired'};
  return {label:'Live on website',details:'This banner is currently published and should appear at the top of the storefront. Refresh the website tab if it is already open.',state:'live'};
}
const inputDate = (date: string | null) => { if (!date) return ''; const d = new Date(date); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const timeValue = (local: string) => local ? new Date(local).toISOString() : null;

function AnnouncementFields({ value, change, busy }: { value: Announcement; change:(next:Announcement)=>void;busy:boolean }) {
  const field = <K extends keyof Announcement>(key:K, next:Announcement[K])=>change({...value,[key]:next});
  return <div className="announcement-fields">
    <label>Title<input required maxLength={100} value={value.title} disabled={busy} onChange={e=>field('title',e.target.value)} placeholder="e.g. Weekend specials" /></label>
    <label>Type<select value={value.kind} disabled={busy} onChange={e=>field('kind',e.target.value as Announcement['kind'])}><option value="notice">Notice</option><option value="special">Special offer</option></select></label>
    <label className="wide">Banner message<input required maxLength={280} value={value.message} disabled={busy} onChange={e=>field('message',e.target.value)} placeholder="e.g. Fresh Bobbatlu available for Sunday pre-orders" /></label>
    <label>Link text (optional)<input maxLength={50} disabled={busy} value={value.action_label} onChange={e=>field('action_label',e.target.value)} placeholder="e.g. See menu" /></label>
    <label>Link destination (optional)<input maxLength={150} disabled={busy} value={value.action_href} onChange={e=>field('action_href',e.target.value)} placeholder="#menu or /catalog" /></label>
    <label>Starts (optional)<input type="datetime-local" disabled={busy} value={inputDate(value.starts_at)} onChange={e=>field('starts_at',timeValue(e.target.value))} /></label>
    <label>Ends (optional)<input type="datetime-local" disabled={busy} value={inputDate(value.ends_at)} onChange={e=>field('ends_at',timeValue(e.target.value))} /></label>
    <label>Display order<input type="number" min="-100000" max="100000" disabled={busy} value={value.sort_order} onChange={e=>field('sort_order',Number(e.target.value))} /></label>
    <label className="admin-check"><input type="checkbox" checked={value.is_published} disabled={busy} onChange={e=>field('is_published',e.target.checked)} /> Publish banner (checked by default for new notices)</label>
    <p className="wide admin-hint">Published banners appear above the website header during their scheduled period. Lower display-order numbers appear first. Links must stay within this website.</p>
  </div>;
}
function payload(a:Announcement) {
  return {resource:'announcement',title:a.title.trim(),message:a.message.trim(),kind:a.kind,
    action_label:a.action_label.trim(),action_href:a.action_href.trim(),
    is_published:a.is_published,starts_at:a.starts_at,ends_at:a.ends_at,sort_order:a.sort_order};
}
function AnnouncementRow({ item, busy, save }: {item:Announcement;busy:boolean;save:Save}) {
  const [editing,setEditing]=useState(false),[value,setValue]=useState<Announcement>({...item});
  useEffect(()=>{if(!editing)setValue({...item});},[item,editing]);
  async function submit(e:FormEvent) {
    e.preventDefault();
    if(await save('PATCH',{...payload(value),id:item.id}))setEditing(false);
  }
  const bannerState=visibility(item);
  return <article className="admin-card announce-card">
    <div className="announce-card-head"><div><h3>{item.title}</h3><small>{item.kind === 'special' ? 'Special' : 'Notice'} · order {item.sort_order}</small><span className={'announce-state announce-state-'+bannerState.state}>{bannerState.label}</span></div><div className="admin-table-actions">
      {!editing?<button type="button" className="admin-action" disabled={busy} onClick={()=>{setValue({...item});setEditing(true);}}>Edit</button>:null}
      <button type="button" className="danger" disabled={busy} onClick={()=>{if(window.confirm('Delete this website announcement?'))void save('DELETE',{resource:'announcement',id:item.id});}}>Delete</button>
    </div></div>
    {editing?<form onSubmit={e=>void submit(e)}><AnnouncementFields value={value} change={setValue} busy={busy}/><div className="announce-buttons"><button type="submit" className="primary" disabled={busy}>Save changes</button><button type="button" className="admin-action" disabled={busy} onClick={()=>{setEditing(false);setValue({...item});}}>Cancel</button></div></form>:
    <><p>{item.message}</p>{item.action_label&&item.action_href&&<small>Link: {item.action_label} → {item.action_href}</small>}
    <p className="quiet">Schedule: {item.starts_at ? new Date(item.starts_at).toLocaleString() : 'Immediately'} – {item.ends_at ? new Date(item.ends_at).toLocaleString() : 'Until unpublished'}</p><p className="announce-guidance">{bannerState.details}</p></>}
  </article>;
}

export default function AnnouncementManager({ announcements, busy, save }: {announcements:Announcement[];busy:boolean;save:Save}) {
  const [adding,setAdding]=useState(false),[value,setValue]=useState(draft);
  async function create(e:FormEvent){
    e.preventDefault();
    if(await save('POST',payload(value))) {setValue(draft());setAdding(false);}
  }
  return <section className="admin-announcements">
    <div className="admin-section-heading"><div><h2>Website banners & specials</h2><p>Publish a notice above the website header. Banners show only when Published and within their scheduled dates.</p><p className="quiet"><strong>{announcements.filter(a=>visibility(a).state==='live').length} live</strong> · {announcements.filter(a=>visibility(a).state==='scheduled').length} scheduled · {announcements.filter(a=>visibility(a).state==='draft').length} drafts. If no announcement is live, currently published Specials appear as fallback banners.</p><a href="/" target="_blank" rel="noopener noreferrer">Open storefront ↗</a></div>
    <button className="primary" type="button" onClick={()=>setAdding(a=>!a)}>{adding?'Close form':'+ Add announcement'}</button></div>
    {adding&&<article className="admin-card"><h3>New announcement</h3><form onSubmit={e=>void create(e)}>
      <AnnouncementFields value={value} change={setValue} busy={busy}/>
      <div className="announce-buttons"><button className="primary" disabled={busy} type="submit">Save announcement</button><button type="button" className="admin-action" disabled={busy} onClick={()=>setAdding(false)}>Cancel</button></div>
    </form></article>}
    {!announcements.length&&<p>No announcements yet. Add one above and check Publish banner to display it.</p>}
    <div className="announcement-list">{announcements.map(a=><AnnouncementRow key={a.id} item={a} busy={busy} save={save}/>)}</div>
    <p className="quiet">Up to three currently active announcements are displayed. Other specials in the existing Specials tab still appear in the site's Specials section.</p>
  </section>;
}
