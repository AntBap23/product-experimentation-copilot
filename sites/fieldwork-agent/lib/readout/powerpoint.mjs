import {pct,dollars,plain,textPages,readoutManifest} from './readout.mjs';
export async function buildPowerPoint(draft,images={}){
 const {default:PptxGenJS}=await import('pptxgenjs');
 const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author=draft.fields.reviewer||'Fieldwork';pptx.subject='Experiment readout — draft for human review';pptx.title=draft.fields.title;pptx.company='Fieldwork';pptx.lang='en-US';
 pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'en-US'};
 const {snapshot,fields}=draft,d=snapshot.data,[a,b]=d.variants,meta=readoutManifest(draft),slides=[];
 const C={navy:'152033',blue:'5267DF',ink:'202B3C',muted:'66748A',line:'DDE3ED',light:'F5F7FB',teal:'247D68',white:'FFFFFF'};
 const sourceNotes='Source snapshot (no credentials):\n'+JSON.stringify({manifest:meta,evidence:snapshot.evidence,comparison:snapshot.comparison,other_evidence:snapshot.other_evidence},null,2);
 const footer=`${d.experiment.dataset}  |  ${d.experiment.start} to ${d.experiment.end} UTC (end exclusive)  |  DRAFT`;
 function slide(title,subtitle='',dark=false){
  const s=pptx.addSlide();s.background={color:dark?C.navy:C.white};s.addText(title,{x:.65,y:.48,w:12,h:.65,fontFace:'Arial',fontSize:32,bold:true,color:dark?C.white:C.ink,margin:0,breakLine:false});
  if(subtitle)s.addText(subtitle,{x:.67,y:1.22,w:12,h:.5,fontSize:17,color:dark?'AABBE0':C.muted,margin:0});
  s.addText(footer,{x:.67,y:7.08,w:11.9,h:.2,fontSize:10,color:C.muted,margin:0});s.addText(String(slides.length+1),{x:12.25,y:7.08,w:.35,h:.2,fontSize:10,color:C.muted,align:'right',margin:0});s.addNotes(sourceNotes);slides.push(s);return s;
 }
 function body(s,text,{x=.7,y=1.95,w=11.95,h=4.65,fontSize=21,color=C.ink,paraSpaceAfter=12}={}){s.addText(plain(text),{x,y,w,h,fontFace:'Arial',fontSize,color,margin:0,breakLine:false,valign:'top',paraSpaceAfter});}
 function table(s,headers,rows,{y=2.05,widths=null,fontSize=18}={}){
  const top=headers.map(text=>({text,options:{bold:true,color:C.white,fill:C.navy}}));
  s.addTable([top,...rows],{x:.7,y,w:11.9,h:Math.min(4.1,(rows.length+1)*.6),colW:widths||Array(headers.length).fill(11.9/headers.length),fontFace:'Arial',fontSize,margin:10,color:C.ink,border:{type:'solid',color:C.line,pt:.5},fill:C.white,rowH:.62,autoPage:false,valign:'mid',bold:false});
 }
 function narrative(title,text,subtitle='Analyst-editable narrative'){
  const chunks=textPages(text,500);for(let i=0;i<chunks.length;i++){const s=slide(title+(chunks.length>1?' · '+(i+1)+'/'+chunks.length:''),subtitle);body(s,chunks[i],{fontSize:20,paraSpaceAfter:0});}
 }
 const cover=slide(fields.title,'Experiment readout',true);
 // Use independent editable text objects rather than a rasterized cover.
 cover.addText(d.scripted_fixture?'SYNTHETIC FIXTURE':'LIVE DEMO INTERACTIONS',{x:.7,y:2.25,w:11.7,h:.4,fontSize:19,bold:true,color:'AEBEFF',margin:0});
 cover.addText('Draft for human review',{x:.7,y:3,w:11.8,h:.8,fontSize:38,bold:true,color:C.white,margin:0});
 cover.addText(`${d.experiment.start} to ${d.experiment.end} UTC · end exclusive\n${snapshot.evidence.source}\nQueried ${snapshot.checked_at}\nReviewer: ${fields.reviewer||'Unassigned'}`,{x:.7,y:4.15,w:11.7,h:1.65,fontSize:19,color:'CBD5E8',margin:0,breakLine:false});
 narrative('Executive summary',fields.executiveSummary+'\n\n'+fields.conclusion,'Source-backed metrics; conclusions remain editable');
 let s=slide('Hypothesis and experiment design','Custom-coded visitor-level experiment');
 table(s,['Design element','Definition'],[
 ['Hypothesis','Direct Add to bag on product cards may reduce purchase friction.'],['Control / treatment','A: open details first. B: add directly from the product card.'],['Unit / allocation','Stable browser visitor; target 50/50 allocation.'],['Primary metric','Exposed visitors with a later purchase / exposed visitors.'],['Cohort / outcome window',`${d.experiment.start} to ${d.experiment.end} UTC; outcomes after first exposure and before the exclusive end.`]
 ],{widths:[3.1,8.8],fontSize:18});
 s=slide('Control A and variant B','Actual product-card screenshots; captions remain editable');
 s.addText('A · Original cards',{x:.7,y:1.95,w:5.7,h:.45,fontSize:25,bold:true,color:C.ink,margin:0});s.addText('B · Direct Add to bag',{x:6.95,y:1.95,w:5.7,h:.45,fontSize:25,bold:true,color:C.blue,margin:0});
 function screenshot(data,x){if(!data)return;const raw=atob(data.split(',')[1]);const dim=i=>[0,1,2,3].reduce((n,j)=>n*256+raw.charCodeAt(i+j),0);const ratio=dim(16)/dim(20),w=Math.min(5.65,1.95*ratio),h=w/ratio;s.addImage({data,x:x+(5.65-w)/2,y:2.6,w,h});}
 screenshot(images.control,.7);screenshot(images.variant,6.95);
 body(s,'Open product details, then choose Add to bag.',{x:.7,y:4.6,w:5.5,h:1.3,fontSize:22});body(s,'Add from the collection card. Demo sign-in remains required.',{x:6.95,y:4.6,w:5.55,h:1.3,fontSize:22});
 s.addNotes('Screenshots: Fieldwork Supply experiment-control.png and experiment-treatment.png. Product screenshots are source images; surrounding text and all analytical objects remain editable.');
 s=slide('Results by variant','Unique exposed visitors; simulated gross revenue in USD');
 table(s,['Variant','Visitors','Purchases','Conversion','Revenue','Revenue / visitor'],d.variants.map(v=>[v.variant==='A'?'A · Control':'B · Variant',v.visitors.toLocaleString(),v.purchases.toLocaleString(),pct(v.purchases,v.visitors,2),dollars(v.revenue),v.visitors?dollars(v.revenue/v.visitors):'—']),{widths:[2.1,1.5,1.6,1.8,2.3,2.6]});
 body(s,d.effect.absolute_pp==null?'A conversion difference is unavailable for this sample.':`Observed difference: ${d.effect.absolute_pp>=0?'+':''}${d.effect.absolute_pp.toFixed(2)} percentage points. Relative difference: ${d.effect.relative_pct==null?'unavailable':d.effect.relative_pct.toFixed(2)+'%'}.`,{y:5.2,h:1.1,fontSize:23});
 s=slide('Purchase conversion','Editable native PowerPoint chart');
 const pa=a.visitors?a.purchases/a.visitors:0,pb=b.visitors?b.purchases/b.visitors:0;
 s.addChart(pptx.ChartType.bar,[{name:'A · Control',labels:['Purchase conversion'],values:[pa]},{name:'B · Variant',labels:['Purchase conversion'],values:[pb]}],{x:.9,y:1.95,w:11.4,h:3.65,barDir:'col',barGrouping:'clustered',chartColors:['9DAAC2',C.blue],showLegend:true,legendPos:'b',legendFontSize:18,showValue:true,dataLabelFontSize:18,dataLabelFormatCode:'0.0%',dataLabelPosition:'outEnd',dataLabelBkgrdColor:C.white,valAxisMinVal:0,valAxisMaxVal:Math.max(.1,Math.ceil(Math.max(pa,pb)*20+1)/20),valAxisLabelFormatCode:'0%',valAxisLabelFontSize:18,catAxisLabelFontSize:18,showTitle:false,showCatName:false,showBorder:false});
 body(s,d.effect.ci95_pp?`Illustrative 95% difference interval: ${d.effect.ci95_pp.map(v=>v.toFixed(2)).join(' to ')} percentage points. ${d.scripted_fixture?'The effect is planted; this is not real business lift.':'No sequential or multiple-comparison adjustment.'}`:'Interval withheld for a sparse sample. Do not infer a shipping decision from these demo visits.',{y:5.98,h:.8,fontSize:19});
 s=slide('Product funnel','Each series uses its own exposed visitors as the denominator');
 const steps=[['Exposed','visitors'],['Product engagement','engaged'],['Added to bag','carts'],['Started checkout','checkouts'],['Purchased','purchases']];
 s.addChart(pptx.ChartType.bar,d.variants.map(v=>({name:v.variant==='A'?'A · Control':'B · Variant',labels:steps.map(step=>step[0]),values:steps.map(step=>v.visitors?v[step[1]]/v.visitors:0)})),{x:.8,y:1.9,w:11.7,h:4.45,barDir:'bar',barGrouping:'clustered',chartColors:['9DAAC2',C.blue],showLegend:true,legendPos:'b',legendFontSize:18,catAxisLabelFontSize:18,valAxisLabelFontSize:18,valAxisLabelFormatCode:'0%',valAxisMinVal:0,valAxisMaxVal:1,showValue:true,dataLabelFontSize:18,dataLabelFormatCode:'0.0%',showTitle:false,showBorder:false});
 s=slide('Web engagement and guardrails','Custom engagement definition; all payments simulated');
 table(s,['Metric','A · Control','B · Variant'],[
 ['No product engagement',pct(a.bounce,a.visitors),pct(b.bounce,b.visitors)],['Shopping CTA engagement',pct(a.cta_clicks,a.visitors),pct(b.cta_clicks,b.visitors)],['Payment errors / checkout',pct(a.payment_errors,a.checkouts),pct(b.payment_errors,b.checkouts)],['Revenue / visitor',a.visitors?dollars(a.revenue/a.visitors):'—',b.visitors?dollars(b.revenue/b.visitors):'—']
 ],{widths:[6,2.95,2.95]});body(s,'No-product-engagement is not native PostHog session bounce rate. Performance, retention, refunds, and real payment reliability were not measured.',{y:5.7,h:.8,fontSize:18});
 for(const dimension of ['device','channel']){
  s=slide(dimension==='device'?'Device segments':'Acquisition-channel segments','Exploratory comparisons; not independently powered tests');
  table(s,['Segment','A visitors','A conversion','B visitors','B conversion'],d.segments[dimension].map(row=>{const [x,y]=row.variants;return [row.value,String(x.visitors),pct(x.purchases,x.visitors),String(y.visitors),pct(y.purchases,y.visitors)];}),{widths:[3.5,1.8,2.4,1.8,2.4],fontSize:18});
 }
 const products=draft.contextEvidence?.find(e=>e.tool==='products');
 if(products){s=slide('Product revenue context','Separate commerce dataset; do not mix its denominators with experiment cohorts');table(s,['Product','Units','Persisted-order revenue'],products.data.map(p=>[p.name,String(p.units),dollars(p.revenue_cents/100)]),{widths:[6.9,1.8,3.2]});body(s,`Dataset: ${products.window.dataset}\nWindow: ${products.window.start} to ${products.window.end} UTC\nSource: ${products.source} · queried ${products.checked_at}`,{y:4.8,h:1.5,fontSize:18});s.addNotes(JSON.stringify(products,null,2));}
 for(const investigation of draft.agentAnswers||[]){
  narrative('Product analytics investigation','Question: '+investigation.question+'\n\n'+investigation.answer,'Actual tool-backed answer; editable after download');
  slides[slides.length-1].addNotes('Original product analytics investigation:\n'+JSON.stringify(investigation,null,2));
 }
 s=slide('Data quality and source comparison','Aggregate parity does not replace a record-level audit');
 body(s,`Comparison: ${snapshot.comparison.status.toUpperCase()}${snapshot.comparison.reason?' — '+snapshot.comparison.reason:''}\n\nPersisted events in this window: ${d.events.toLocaleString()}\nObserved allocation: A ${a.visitors} / B ${b.visitors}; target 50/50\nSample-ratio chi-square: ${d.srm.chi_square==null?'unavailable':d.srm.chi_square.toFixed(3)}; alert threshold 0.001\nDelivery pending in the queried source: ${d.pending_events==null?'not reported by this source':d.pending_events}\nComparison differences: ${snapshot.comparison.differences?.length||0}`,{fontSize:21});
 const interpretations=fields.analystNotes||'No AI interpretation is attached. Add analyst notes in the draft editor or edit this slide in PowerPoint.';
 narrative('Analyst interpretation',(draft.ai?.question?'Question: '+draft.ai.question+'\n\n':'')+interpretations,`${draft.ai?.answer_source==='model'?'Model-generated source text, editable by the reviewer':'Human-editable interpretation'} · not an approval`);
 if(draft.ai)s=slides[slides.length-1],s.addNotes('Original AI response and evidence:\n'+JSON.stringify(draft.ai,null,2));
 narrative('Risks and limitations',fields.risks,'Retain these qualifications when interpreting the result');
 narrative('Recommendation and next steps',fields.recommendation+'\n\n'+fields.nextSteps,'Draft recommendation for human review');
 s=slide('Human review and decision','Edit the narrative and native charts/tables before sharing');
 table(s,['Review field','Draft value'],[['Decision',fields.decision],['Reviewer',fields.reviewer||'Unassigned'],['Follow-up owner',fields.owner||'Unassigned'],['Source snapshot',snapshot.checked_at],['Review status','Draft — human review required']],{widths:[3.6,8.3],fontSize:19});
 s=slide('Methods and evidence','Full source queries and returned aggregates are retained in speaker notes');
 body(s,`Cohort: first exposure inside the selected UTC window.\nOutcomes: after exposure and before the exclusive end.\nConversion: unique exposed visitors with one or more purchases.\nRevenue: all attributed purchases; USD, simulated payments.\nAssignment: browser visitor, not cross-device identity.\nInterval: independent-visitor normal approximation, suppressed for sparse samples.\nSource: ${snapshot.evidence.source}\nQueried: ${snapshot.checked_at}`,{fontSize:20});
 s.addNotes('Download the evidence JSON from the readout editor for machine-readable reproduction. All narrative text, tables, and chart data in this deck remain editable. Editing the deck does not change the source data.');
 return {pptx,manifest:{...meta,slides:slides.length}};
}
