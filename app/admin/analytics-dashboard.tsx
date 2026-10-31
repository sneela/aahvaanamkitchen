'use client';

import { useCallback, useEffect, useState } from 'react';

type Totals={visits:number;productViews:number;addToCart:number;checkoutStarted:number;ordersPlaced:number};
type Day=Totals & {day:string};
type Item={slug:string;name:string;views:number;cartAdds:number};
type Report={days:number;totals:Totals;daily:Day[];topProducts:Item[];note:string};
const format=(n:number)=>new Intl.NumberFormat('en-US').format(n);

export default function AnalyticsDashboard({ enabled }: {enabled:boolean}) {
  const [days,setDays]=useState<7|30|90>(30);
  const [report,setReport]=useState<Report|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=useCallback(async(windowDays:number)=>{
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/analytics?days='+windowDays,{cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Unable to load analytics');
      setReport(body as Report);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load analytics');}
    finally{setBusy(false);}
  },[]);
  useEffect(()=>{void load(days);},[days,load]);
  const totals=report?.totals;
  const cards: {key:keyof Totals;title:string;hint:string}[]=[
    {key:'visits',title:'Website visits',hint:'Approximate browsing sessions, not people'},
    {key:'productViews',title:'Item details opened',hint:'Customers who opened an item detail'},
    {key:'addToCart',title:'Add-to-cart clicks',hint:'Clicks, not unique customers'},
    {key:'checkoutStarted',title:'Checkout starts',hint:'Customers who opened the order form'},
    {key:'ordersPlaced',title:'Orders submitted',hint:'Real orders saved to MongoDB'},
  ];
  const chart=report?.daily.slice(-14)||[];
  const max=Math.max(1,...chart.map(r=>r.visits));
  return <section className="analytics-dashboard">
    <div className="admin-section-heading"><div><h2>Website analytics</h2><p>Understand how often people visit, explore menu items, and submit orders.</p></div>
      <div className="analytics-controls"><label>Time period<select value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
      <button className="secondary" type="button" disabled={busy} onClick={()=>void load(days)}>Refresh</button></div>
    </div>
    {!enabled&&<p className="notice">Analytics collection is disabled in Settings. Historical counts remain visible, but new browser events are not recorded.</p>}
    {error&&<p role="alert" className="admin-error">{error}</p>}
    {busy&&!report&&<p>Loading website analytics…</p>}
    {totals&&<><div className="analytics-stats">{cards.map(c=><div className="analytics-stat" key={c.key}><strong>{format(totals[c.key])}</strong><span>{c.title}</span><small>{c.hint}</small></div>)}</div>
    <div className="analytics-report-grid">
      <article className="admin-card">
        <h3>Website visits — last {Math.min(14,days)} days</h3>
        <div className="analytics-bars">{chart.map(day=><div className="analytics-bar-col" key={day.day} title={day.day+': '+format(day.visits)+' visits'}>
          <span className="analytics-bar-number">{day.visits||''}</span>
          <div className="analytics-bar-track"><div style={{height:(day.visits?Math.max(5,Math.round(day.visits/max*100)):0)+'%'}} /></div>
          <small>{day.day.slice(5)}</small>
        </div>)}</div>
        <p className="quiet">Counts use UTC days. Browser sessions are approximate, and automated traffic may affect totals.</p>
      </article>
      <article className="admin-card">
        <h3>Visitor journey</h3>
        <div className="analytics-funnel"><div><span>Visits</span><strong>{format(totals.visits)}</strong></div><div><span>Item detail opens</span><strong>{format(totals.productViews)}</strong></div><div><span>Cart additions</span><strong>{format(totals.addToCart)}</strong></div><div><span>Checkouts started</span><strong>{format(totals.checkoutStarted)}</strong></div><div><span>Orders placed</span><strong>{format(totals.ordersPlaced)}</strong></div></div>
        <p className="quiet">This is an activity summary, not a person-level funnel: one visitor can open multiple products or click Add multiple times.</p>
      </article>
    </div>
    <article className="admin-card"><h3>Most viewed products</h3>
      {report?.topProducts.length?<div className="admin-table-scroll"><table className="admin-data-table analytics-product-table"><thead><tr><th>Item</th><th>Detail opens</th><th>Cart additions</th></tr></thead><tbody>{report.topProducts.map(item=><tr key={item.slug}><td><strong>{item.name}</strong><small style={{display:'block'}}>{item.slug}</small></td><td>{format(item.views)}</td><td>{format(item.cartAdds)}</td></tr>)}</tbody></table></div>:<p>No item interactions recorded yet. Customers can open product details from the storefront.</p>}
    </article>
    <p className="quiet">Privacy: only daily, aggregated event totals are stored. No analytics identity, customer contact details or raw browsing sessions are saved in these reports. Orders are counted directly from order records. Analytics starts collecting only once this code is deployed and the feature is enabled.</p>
    </>}
  </section>;
}
