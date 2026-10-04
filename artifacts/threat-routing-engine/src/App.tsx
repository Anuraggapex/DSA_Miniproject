import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Activity, ArrowDown, Check, CircleHelp, Code2, Cpu, Database, GitBranch, Hash, Layers3, Play, RotateCcw, Shield, ShieldAlert, ShieldCheck, Terminal, Trash2 } from 'lucide-react';
import { analyzeMessage, blacklist, HASH_BUCKETS as BUCKETS, hashWord, vocabulary, vocabularyTreePreview, type AnalysisToken } from '@/lib/moderation';

type Run = { id:number; text:string; tokens:AnalysisToken[]; toxicityScore:number; blacklisted:boolean; verdict:string; priority:number; createdAt:Date };
type Alert = { id:number; text:string; priority:number; toxicityScore:number; reason:string; status:string };

const queryClient = new QueryClient();
const presets = [
  {label:'Benign · greeting',text:'Hello world, have an excellent day!'},
  {label:'Toxic · sentiment',text:'This interface is bad and stupid.'},
  {label:'Severe · payload',text:'Download this ransomware payload exploit now!'},
  {label:'Toxic · direct insult',text:'I hate you, you complete idiot.'},
  {label:'Severe · abusive',text:'You are a useless, pathetic asshole. This is fucking disgusting.'},
];
const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

function PanelTitle({icon:Icon,title,kicker,action}:{icon:typeof Hash;title:string;kicker:string;action?:ReactNode}) {
  return <div className="flex items-center justify-between border-b border-[#2a3039] px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg border border-[#343b45] bg-[#20252d] text-[#71d8a5]"><Icon size={15}/></div><div><h2 className="text-[13px] font-bold tracking-[.01em] text-[#e1e6eb]">{title}</h2><p className="mono mt-0.5 text-[9px] uppercase tracking-[.12em] text-[#77818c]">{kicker}</p></div></div>{action}</div>;
}
function Tag({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'red'|'amber'|'neutral'}) {
  const colors={green:'border-[#315d48] bg-[#193328] text-[#84dbae]',red:'border-[#693a3c] bg-[#391f22] text-[#ee9290]',amber:'border-[#665337] bg-[#332b1d] text-[#dfbd79]',neutral:'border-[#3a414b] bg-[#242a32] text-[#a8b1ba]'};
  return <span className={`mono inline-flex items-center rounded-md border px-2 py-1 text-[9px] uppercase tracking-[.09em] ${colors[tone]}`}>{children}</span>;
}

function App() {
  const [text,setText]=useState(presets[0].text);
  const [processed,setProcessed]=useState<AnalysisToken[]>([]);
  const [activeIndex,setActiveIndex]=useState(-1);
  const [stage,setStage]=useState('Ready to inspect');
  const [running,setRunning]=useState(false);
  const [runs,setRuns]=useState<Run[]>([]);
  const [heap,setHeap]=useState<Alert[]>([]);
  const [lastVerdict,setLastVerdict]=useState<Run|null>(null);
  const [underHood,setUnderHood]=useState(false);
  const [heapAnimating,setHeapAnimating]=useState(false);
  const [reviewed,setReviewed]=useState<Alert[]>([]);
  const [expandedHash,setExpandedHash]=useState<number|null>(null);
  const [bstFocus,setBstFocus]=useState('');

  const buckets=Array.from({length:BUCKETS},(_,index)=>blacklist.filter(word=>hashWord(word)===index));
  const clearRun=()=>{if(running)return;setProcessed([]);setActiveIndex(-1);setLastVerdict(null);setStage('Ready to inspect');};
  const handleRun=async()=>{
    const analysis=analyzeMessage(text);
    const clean=analysis.tokens;
    if(!clean.length||running)return;
    setRunning(true);setProcessed([]);setLastVerdict(null);setActiveIndex(-1);
    let blacklisted=false;const results:AnalysisToken[]=[];
    for(let index=0;index<clean.length;index++){
      const result=clean[index];
      results.push(result);blacklisted ||= result.blacklistMatch;setActiveIndex(index);setProcessed([...results]);setBstFocus(result.matchedTerm??'');
      const lookupLabel=result.matchedTerm&&result.matchedTerm!==result.normalized?` → ${result.matchedTerm}`:'';
      setStage(`Token ${index+1}/${clean.length} · ${result.normalized}${lookupLabel} → ${result.blacklistMatch?'blacklist hit':result.matchedTerm?`BST weight ${result.sentimentWeight>0?'+':''}${result.sentimentWeight.toFixed(2)}`:'not in lexicon'}`);
      await wait(390);
    }
    const score=analysis.toxicityScore;
    const severeMatch=analysis.severeMatch;
    const flagged=analysis.flagged;const verdict=blacklisted?'BLOCK · BLACKLIST MATCH':severeMatch?'ESCALATE · SEVERE LANGUAGE':score>=.4?'ESCALATE · HIGH RISK':'ALLOW · BELOW THRESHOLD';
    const id=Date.now();const priority=Number((score+(blacklisted?.35:0)).toFixed(2));
    const run:Run={id,text,tokens:results,toxicityScore:score,blacklisted,verdict,priority,createdAt:new Date()};
    setRuns(previous=>[run,...previous].slice(0,8));setLastVerdict(run);
    if(flagged){
      const alert:Alert={id,text,priority,toxicityScore:score,reason:blacklisted?'Blacklist term detected':severeMatch?'High-severity language detected':'Toxicity score crossed 0.40 threshold',status:'queued'};
      const next=[...heap,alert];let child=next.length-1;
      setHeapAnimating(true);setStage('Alert created · inserting into max-heap');setHeap([...next]);await wait(280);
      while(child>0){const parent=Math.floor((child-1)/2);if(next[parent].priority>=next[child].priority)break;[next[parent],next[child]]=[next[child],next[parent]];setHeap([...next]);setStage(`Up-heapify · swap index ${parent} ↔ ${child}`);child=parent;await wait(360);}
      setHeapAnimating(false);
    }
    setStage(flagged?'Run complete · routed to moderator queue':'Run complete · no moderator action required');setRunning(false);
  };
  const executeNext=async()=>{
    if(!heap.length||heapAnimating)return;
    setHeapAnimating(true);setStage('Removing highest priority · root pop');await wait(260);
    const next=[...heap];const removed=next[0];const tail=next.pop();
    if(next.length&&tail)next[0]=tail;
    setHeap([...next]);await wait(280);
    let parent=0;
    while(parent<next.length){const left=parent*2+1,right=left+1;let largest=parent;if(left<next.length&&next[left].priority>next[largest].priority)largest=left;if(right<next.length&&next[right].priority>next[largest].priority)largest=right;if(largest===parent)break;[next[parent],next[largest]]=[next[largest],next[parent]];setHeap([...next]);setStage(`Down-heapify · swap index ${parent} ↔ ${largest}`);parent=largest;await wait(360);}
    if(removed)setReviewed(items=>[{...removed,status:'reviewed'},...items].slice(0,5));
    setHeapAnimating(false);setStage(removed?`Action executed · ${removed.priority.toFixed(2)} priority reviewed`:'Queue empty');
  };
  const clearQueue=()=>{if(heapAnimating)return;setHeap([]);setStage('Moderator queue cleared');};
  const resetAll=()=>{if(running||heapAnimating)return;setHeap([]);setRuns([]);setReviewed([]);setProcessed([]);setActiveIndex(-1);setLastVerdict(null);setStage('Ready to inspect');};

  return <div className="grid-bg min-h-[100dvh] text-[#dce2e8]">
    <header className="sticky top-0 z-20 border-b border-[#2a3039] bg-[#101319]/95 backdrop-blur">
      <div className="mx-auto flex h-[62px] max-w-[1480px] items-center justify-between px-4 sm:px-7">
        <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg border border-[#32644b] bg-[#183427] text-[#79d8a5]"><Shield size={17}/></div><div><div className="text-[13px] font-extrabold tracking-[.035em] text-[#eff2f5]">THREAT<span className="text-[#79d8a5]">/</span>ROUTER</div><div className="mono text-[9px] tracking-[.13em] text-[#7c8792]">CLASSICAL NLP LAB · v1.4.2</div></div></div>
        <div className="hidden items-center gap-2 rounded-full border border-[#284d3a] bg-[#172a21] px-3 py-1.5 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#70d69e]"/><span className="mono text-[9px] uppercase tracking-[.12em] text-[#8fc9a7]">Local simulation</span></div>
        <button data-testid="button-under-the-hood" onClick={()=>setUnderHood(!underHood)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${underHood?'border-[#397451] bg-[#193328] text-[#8fe0b2]':'border-[#343b45] bg-[#1a1e25] text-[#aeb7c0] hover:text-white'}`}><Code2 size={14}/><span className="hidden sm:inline">{underHood?'Hide':'Under the hood'}</span><span className="sm:hidden">C</span></button>
      </div>
    </header>
    <main className="mx-auto max-w-[1480px] px-4 pb-12 pt-7 sm:px-7">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-[#7d8995]"><span className="text-[#71d8a5]">01</span><span className="h-px w-7 bg-[#39424c]"/>Moderation workbench</div><h1 className="text-[25px] font-extrabold tracking-[-.04em] text-[#eff2f5] sm:text-[31px]">Trace the route. Audit the decision.</h1><p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#8e99a4]">An expanded offline English lexicon scores negative language. Common inflections and punctuation variants are normalized; unknown words count as neutral.</p></div>
        <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-[#2c333d] bg-[#171b22] px-3 py-2"><Cpu size={14} className="text-[#72d6a1]"/><span className="mono text-[10px] text-[#b5bec7]">DETERMINISTIC</span></div><button data-testid="button-reset-lab" onClick={resetAll} disabled={running||heapAnimating} className="flex items-center gap-2 rounded-lg border border-[#343b45] px-3 py-2 text-[11px] font-semibold text-[#aeb7c0] hover:bg-[#20252c] disabled:opacity-40"><RotateCcw size={13}/>Reset lab</button></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.57fr)_minmax(350px,.93fr)]">
        <section className="panel overflow-hidden">
          <PanelTitle icon={Terminal} title="Input stream" kicker="Sentence → token stream" action={<Tag tone="green">01 / INGEST</Tag>}/>
          <div className="p-5">
            <label htmlFor="sentence-input" className="mono mb-2 block text-[10px] uppercase tracking-[.1em] text-[#929da8]">Message under review</label>
            <textarea id="sentence-input" data-testid="input-sentence" value={text} onChange={e=>setText(e.target.value)} maxLength={280} rows={3} className="w-full resize-y rounded-lg border border-[#333b45] bg-[#11151b] px-4 py-3 text-[13px] leading-6 text-[#e2e8ed] outline-none transition placeholder:text-[#636d77] focus:border-[#4d9c70] focus:ring-1 focus:ring-[#3a744f]" placeholder="Enter a sentence to inspect…" />
            <div className="mt-1 flex justify-between"><span className="mono text-[9px] text-[#67727e]">UTF-8 · max 280 chars</span><span className="mono text-[9px] text-[#67727e]">{text.length}/280</span></div>
            <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mono mr-1 text-[9px] uppercase tracking-[.1em] text-[#798591]">Load sample</span>{presets.map((preset,index)=><button key={preset.label} data-testid={`button-preset-${index+1}`} onClick={()=>{setText(preset.text);clearRun();}} className="rounded-md border border-[#343b45] bg-[#1b2027] px-2.5 py-1.5 text-[10px] font-semibold text-[#aeb7c0] transition hover:border-[#527963] hover:text-[#a0e0ba]">{preset.label}</button>)}</div>
            <div className="mt-5 flex flex-col justify-between gap-3 border-t border-[#2b313a] pt-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-2"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${running?'animate-pulse bg-[#e2b861]':lastVerdict?.blacklisted||((lastVerdict?.toxicityScore??0)>=.4)?'bg-[#e17977]':'bg-[#70d69e]'}`}/><span data-testid="status-pipeline" className="mono truncate text-[10px] text-[#9ba5af]">{stage}</span></div><button data-testid="button-run-analysis" onClick={handleRun} disabled={running||!text.trim()} className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#54a576] bg-[#257248] px-4 py-2.5 text-[11px] font-extrabold tracking-[.02em] text-[#f0fff5] shadow-[0_4px_16px_rgba(30,120,70,.18)] transition hover:bg-[#2a8352] disabled:cursor-not-allowed disabled:opacity-45"><Play size={13} fill="currentColor"/>{running?'Processing stream…':'Run threat analysis'}</button></div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <PanelTitle icon={Activity} title="Decision trace" kicker="Live processing · cumulative signal" action={<Tag tone={running?'amber':lastVerdict?(lastVerdict.blacklisted||lastVerdict.toxicityScore>=.4?'red':'green'):'neutral'}>{running?'RUNNING':lastVerdict?'COMPLETE':'IDLE'}</Tag>}/>
          <div className="p-5">
            {processed.length===0?<div className="flex min-h-[152px] flex-col items-center justify-center rounded-lg border border-dashed border-[#303741] bg-[#15191f] text-center"><div className="mb-2 grid h-9 w-9 place-items-center rounded-full border border-[#343c45] bg-[#20252c] text-[#78848f]"><Activity size={16}/></div><p className="text-[11px] font-semibold text-[#aab3bc]">Awaiting input stream</p><p className="mt-1 text-[10px] text-[#707b86]">Run analysis to expose every token operation.</p></div>:<div className="space-y-3">
              <div className="flex flex-wrap gap-1.5" data-testid="list-processed-tokens">{processed.map((token,index)=><span key={`${index}-${token.normalized}`} data-testid={`token-result-${index}`} title={token.matchedTerm?`${token.matchedTerm} · weight ${token.sentimentWeight.toFixed(2)}`:'No lexicon match'} className={`token-enter mono rounded-md border px-2 py-1 text-[10px] ${activeIndex===index&&running?'border-[#8b7447] bg-[#302a1c] text-[#e8cb83]':token.blacklistMatch||token.sentimentWeight>0?'border-[#704041] bg-[#321f22] text-[#ef9c98]':token.sentimentWeight<0?'border-[#315d48] bg-[#193328] text-[#84dbae]':'border-[#38414a] bg-[#20262d] text-[#c1c9d0]'}`}>{token.raw}</span>)}</div>
              <div className="grid grid-cols-3 gap-2"><Metric label="HASH INDEX" value={processed[activeIndex]?.hashIndex?.toString().padStart(2,'0')??'—'} icon={<Hash size={12}/>} /><Metric label="BST WEIGHT" value={processed[activeIndex]?`${processed[activeIndex].sentimentWeight>0?'+':''}${processed[activeIndex].sentimentWeight.toFixed(2)}`:'—'} icon={<GitBranch size={12}/>} /><Metric label="RUNNING SCORE" value={processed[activeIndex]?processed[activeIndex].cumulativeScore.toFixed(2):'—'} icon={<Activity size={12}/>} /></div>
              {processed[activeIndex]&&<div data-testid="hash-stage-result" className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${processed[activeIndex].blacklistMatch?'border-[#704041] bg-[#321f22]':'border-[#2f3640] bg-[#14181e]'}`}><div className="min-w-0"><span className="mono text-[9px] uppercase tracking-[.08em] text-[#85919b]">Stage 1 · hash lookup</span><p className="mono mt-1 truncate text-[10px] text-[#d4dbe1]">h(&quot;{processed[activeIndex].normalized}&quot;) = {processed[activeIndex].hashIndex} · expected O(1)</p></div><Tag tone={processed[activeIndex].blacklistMatch?'red':'green'}>{processed[activeIndex].blacklistMatch?'BLACKLIST HIT':'CLEAR'}</Tag></div>}
              <div className="rounded-lg border border-[#2f3640] bg-[#14181e] px-3 py-2.5"><div className="mb-1.5 flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.1em] text-[#7f8a95]">BST comparison path</span><span className="mono text-[9px] text-[#77838d]">{processed[activeIndex]?.bstTraversal.length??0} comparisons</span></div><div className="flex flex-wrap items-center gap-1">{processed[activeIndex]?.bstTraversal.length?processed[activeIndex].bstTraversal.map((word,index)=><span key={`${word}-${index}`} className="flex items-center gap-1"><span className={`mono rounded px-1.5 py-1 text-[9px] ${index===processed[activeIndex].bstTraversal.length-1?'bg-[#1d3b2b] text-[#8fddb1]':'bg-[#242a32] text-[#a3adb6]'}`}>{word}</span>{index<processed[activeIndex].bstTraversal.length-1&&<span className="mono text-[8px] text-[#73808b]">{(processed[activeIndex].matchedTerm??processed[activeIndex].normalized)<word?'L':'R'} →</span>}</span>):<span className="text-[10px] text-[#75808a]">No vocabulary comparisons yet.</span>}</div></div>
            </div>}
            {lastVerdict&&<div data-testid="status-verdict" className={`mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${lastVerdict.blacklisted||lastVerdict.toxicityScore>=.4?'border-[#643b3c] bg-[#2a1d20]':'border-[#315542] bg-[#192820]'}`}><div className="flex items-center gap-2">{lastVerdict.blacklisted||lastVerdict.toxicityScore>=.4 ? <ShieldAlert size={14} className="text-[#e28b88]"/> : <ShieldCheck size={14} className="text-[#80d5a5]"/>}<span className={`mono text-[9px] font-medium ${lastVerdict.blacklisted||lastVerdict.toxicityScore>=.4?'text-[#e9a09b]':'text-[#93d8ad]'}`}>{lastVerdict.verdict}</span></div><span className="mono text-[10px] text-[#d2d9df]">score {lastVerdict.toxicityScore.toFixed(2)}</span></div>}
          </div>
        </section>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.57fr)_minmax(350px,.93fr)]">
        <section className="panel overflow-hidden">
          <PanelTitle icon={Database} title="Local detection lexicons" kicker="Expanded offline terms · deterministic lookup" action={<span className="mono hidden text-[9px] text-[#76818c] sm:block">ASCII hash → chain / balanced BST search</span>}/>
          <div className="grid md:grid-cols-[.94fr_1.06fr]">
            <div className="border-b border-[#2a3039] p-5 md:border-b-0 md:border-r">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[11px] font-bold text-[#d2d9df]">Blacklist hash table</h3><p className="mono mt-1 text-[9px] text-[#7b8792]">h(w) = Σ (i + 1) × ASCII(wᵢ) mod 3 · chained collisions</p></div><Tag tone="red">{blacklist.length} terms</Tag></div>
              <div className="space-y-1.5">{buckets.map((items,index)=><button key={index} data-testid={`button-hash-bucket-${index}`} onClick={()=>setExpandedHash(expandedHash===index?null:index)} className={`grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${items.length?'border-[#533638] bg-[#261d20] hover:border-[#845052]':'border-[#292f38] bg-[#171b21] hover:border-[#414b56]'}`}><span className="mono text-[9px] text-[#74818c]">[{String(index).padStart(2,'0')}]</span><span className="flex flex-wrap items-center gap-1">{items.length?items.map(word=><span key={word} className="mono rounded bg-[#3a2527] px-1.5 py-0.5 text-[9px] text-[#e2a09e]">{word}</span>):<span className="text-[9px] text-[#58636d]">∅ empty chain</span>}</span><span className="mono text-[8px] text-[#6b7782]">{items.length?`${items.length} node${items.length>1?'s':''}`:'NULL'}</span></button>)}</div>
              <div className="mt-2 min-h-[25px] text-[9px] text-[#78848e]">{expandedHash!==null&&<span className="mono" data-testid="text-hash-calculation">bucket {expandedHash}: {buckets[expandedHash].length?buckets[expandedHash].map(word=>`${word} → ${hashWord(word)}`).join('  ·  '):'head = NULL'}</span>}</div>
            </div>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[11px] font-bold text-[#d2d9df]">Sentiment weight BST</h3><p className="mono mt-1 text-[9px] text-[#7b8792]">lexicographic compare · smaller ← / larger →</p></div><Tag tone="green">{vocabulary.length} terms</Tag></div>
              <div className="mb-4 rounded-lg border border-[#2d343d] bg-[#14181e] px-2 py-3">
                <div className="mb-2 flex items-center justify-between px-1"><span className="mono text-[8px] uppercase tracking-[.1em] text-[#687580]">Balanced BST · representative levels</span><span className="mono text-[8px] text-[#718079]">L &lt; node &lt; R</span></div>
                <div className="relative mx-auto h-[174px] max-w-[480px]" data-testid="diagram-bst">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 174" preserveAspectRatio="none" aria-hidden="true">
                    <g fill="none" stroke="#52645a" strokeWidth="1.2" strokeDasharray="3 4">{vocabularyTreePreview.flatMap(node=>{if(node.parentIndex===null)return [];const parent=vocabularyTreePreview.find(candidate=>candidate.index===node.parentIndex);return parent?[<line key={`${parent.index}-${node.index}`} x1={parent.x} y1={parent.y+28} x2={node.x} y2={node.y+5}/>]:[];})}</g>
                  </svg>
                  {vocabularyTreePreview.map(node=><div key={node.word} className="absolute -translate-x-1/2" style={{left:`${node.x/480*100}%`,top:node.y}}><TreeNode word={node.word} weight={node.weight} active={bstFocus===node.word} compact tiny onInspect={setBstFocus}/></div>)}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#82909a]"><span><b className="text-[#e2938f]">+</b> raises toxicity</span><span><b className="text-[#83d5a5]">−</b> reduces signal</span><span className="mono text-[#68747f]">unknown token = 0.00</span></div>
            </div>
          </div>
        </section>
        <section className="panel overflow-hidden">
          <PanelTitle icon={Layers3} title="Moderator queue" kicker="Binary max-heap · root = next action" action={<Tag tone={heap.length?'amber':'neutral'}>{heap.length} QUEUED</Tag>}/>
          <div className="p-5">
            <div className="mb-4 flex gap-2"><button data-testid="button-execute-next" onClick={executeNext} disabled={!heap.length||heapAnimating} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#8a7040] bg-[#3a301c] px-3 py-2.5 text-[10px] font-extrabold text-[#e6c979] hover:bg-[#453920] disabled:cursor-not-allowed disabled:opacity-40"><ArrowDown size={14}/>Execute next action</button><button data-testid="button-clear-queue" onClick={clearQueue} disabled={!heap.length||heapAnimating} aria-label="Clear moderator queue" className="grid w-10 place-items-center rounded-lg border border-[#343b45] bg-[#1b2027] text-[#9aa5ae] hover:text-[#e18b88] disabled:opacity-40"><Trash2 size={14}/></button></div>
            {!heap.length?<div className="flex min-h-[104px] flex-col items-center justify-center rounded-lg border border-dashed border-[#303741] bg-[#15191f] text-center"><div className="mb-2 grid h-8 w-8 place-items-center rounded-full border border-[#343b45] text-[#7c8993]"><ShieldCheck size={14}/></div><p className="text-[10px] font-semibold text-[#aeb8c1]">Queue is clear</p><p className="mt-1 max-w-[230px] text-[9px] leading-4 text-[#727e89]">Flagged messages enter here by priority. No alerts are preloaded.</p></div>:<div className="space-y-2" data-testid="list-moderator-queue">{heap.map((alert,index)=><div key={alert.id} data-testid={`card-queue-alert-${alert.id}`} className={`rounded-lg border p-3 ${index===0?'border-[#665634] bg-[#27231c]':'border-[#303741] bg-[#171b21]'}`}><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className={`mono flex h-5 w-5 items-center justify-center rounded text-[9px] ${index===0?'bg-[#514323] text-[#e2c676]':'bg-[#282e36] text-[#86929d]'}`}>{index}</span><span className="mono text-[9px] uppercase tracking-[.08em] text-[#aab3bc]">{index===0?'ROOT · NEXT':'HEAP NODE'}</span></div><span className="mono text-[10px] font-medium text-[#e2c675]">P {alert.priority.toFixed(2)}</span></div><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#d4d9df]">“{alert.text}”</p><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[9px] text-[#9b8174]">{alert.reason}</span><span className="mono shrink-0 text-[9px] text-[#87929d]">score {alert.toxicityScore.toFixed(2)}</span></div></div>)}</div>}
             {!!heap.length&&<div className="mt-4 rounded-lg border border-[#2d343d] bg-[#14181e] p-3"><div className="mb-2 flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.1em] text-[#7e8994]">Heap array layout</span><span className="mono text-[9px] text-[#67737e]">parent(i) = ⌊(i−1)/2⌋</span></div><div className="flex flex-wrap gap-1.5">{heap.map((alert,index)=><div key={alert.id} className={`mono flex h-8 min-w-10 items-center justify-center rounded border px-2 text-[9px] ${index===0?'border-[#806b37] bg-[#39301d] text-[#e5cc7c]':'border-[#38414b] bg-[#20252c] text-[#bdc6cd]'}`} data-testid={`text-heap-index-${index}`}>[{index}] {alert.priority.toFixed(2)}</div>)}</div><div className="mt-3 border-t border-[#2b313a] pt-3"><div className="mb-1 flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.1em] text-[#7e8994]">Animated max-heap tree</span><span className="mono text-[8px] text-[#67737e]">root = highest priority · first 7 nodes</span></div><svg data-testid="diagram-max-heap" className="mx-auto block w-full max-w-[340px]" viewBox="0 0 320 162" role="img" aria-label="Max-heap tree showing queued threat priorities"><g fill="none" stroke="#52605a" strokeWidth="1.2">{heap.slice(1,7).map((_,index)=>{const child=index+1;const parent=Math.floor((child-1)/2);const points=[[160,25],[80,82],[240,82],[40,140],[120,140],[200,140],[280,140]];return <line key={child} x1={points[parent][0]} y1={points[parent][1]} x2={points[child][0]} y2={points[child][1]}/>;})}</g>{heap.slice(0,7).map((alert,index)=>{const points=[[160,25],[80,82],[240,82],[40,140],[120,140],[200,140],[280,140]];const [x,y]=points[index];return <g key={alert.id} data-testid={`node-heap-${index}`}><circle cx={x} cy={y} r="19" fill={index===0?'#39301d':'#20252c'} stroke={index===0?'#806b37':'#38414b'} strokeWidth="1.5"/><text x={x} y={y+3} textAnchor="middle" fill={index===0?'#e5cc7c':'#bdc6cd'} fontFamily="monospace" fontSize="8">{alert.priority.toFixed(2)}</text><text x={x+14} y={y-14} fill="#73808b" fontFamily="monospace" fontSize="7">[{index}]</text></g>;})}</svg></div></div>}
            {!!reviewed.length&&<div className="mt-4 border-t border-[#2c333c] pt-3"><div className="mono mb-2 text-[9px] uppercase tracking-[.1em] text-[#737f89]">Recently executed</div>{reviewed.slice(0,2).map(item=><div key={item.id} data-testid={`text-reviewed-${item.id}`} className="mb-1 flex items-center gap-2 text-[9px] text-[#85918c]"><Check size={11} className="text-[#72c696]"/><span className="truncate">{item.text}</span></div>)}</div>}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <section className="panel overflow-hidden"><PanelTitle icon={GitBranch} title="Routing rules" kicker="Explicit policy · no hidden model" action={<Tag>POLICY</Tag>}/><div className="grid gap-px bg-[#2a3039] sm:grid-cols-3"><Rule number="01" title="Hash lookup" detail="Blacklist match short-circuits to BLOCK with a 1.00 severity score." accent="red"/><Rule number="02" title="Score threshold" detail="Signed lexicon weights apply; nearby negation softens a hit, and unknown words score zero." accent="amber"/><Rule number="03" title="Heap dispatch" detail="Score ≥ 0.40 or a severe term creates a moderator alert." accent="green"/></div></section>
        <section className="panel overflow-hidden"><PanelTitle icon={Activity} title="Run ledger" kicker="Recent local decisions" action={<span className="mono text-[9px] text-[#727e89]">{runs.length} runs</span>}/>{runs.length?<div className="divide-y divide-[#2b313a]" data-testid="list-run-ledger">{runs.slice(0,4).map(run=><div key={run.id} data-testid={`row-run-${run.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5"><div className="min-w-0"><p className="truncate text-[10px] text-[#cbd2d8]">{run.text}</p><p className="mono mt-1 text-[8px] text-[#74808b]">{run.tokens.length} tokens · {run.createdAt.toLocaleTimeString()}</p></div><div className="flex shrink-0 items-center gap-2"><span className="mono text-[9px] text-[#aab4bd]">{run.toxicityScore.toFixed(2)}</span><span className={`h-1.5 w-1.5 rounded-full ${run.blacklisted||run.toxicityScore>=.4?'bg-[#df7e79]':'bg-[#6ccc95]'}`}/></div></div>)}</div>:<div className="px-4 py-7 text-center text-[10px] text-[#75808a]" data-testid="empty-run-ledger">No runs yet. Each completed analysis appears here.</div>}</section>
      </div>

      {underHood&&<section className="panel mt-4 overflow-hidden" data-testid="panel-under-the-hood"><PanelTitle icon={Code2} title="Under the hood" kicker="Standard C · the structures behind this run" action={<Tag tone="green">READABLE C</Tag>}/><div className="grid gap-3 p-4 md:grid-cols-2">
        <CodeBlock title="01 · Chained hash table" lines={['typedef struct HashNode {','    char *word;','    struct HashNode *next;','} HashNode;','','unsigned hash(const char *s) {','    unsigned sum = 0;','    for (unsigned i = 0; s[i]; i++)','        sum += (i + 1) * (unsigned char)s[i];','    return sum % TABLE_SIZE;','}','','/* bucket[index] is a linked-list head */','HashNode *node = bucket[hash(word)];','while (node && strcmp(node->word, word))','    node = node->next;']} />
        <CodeBlock title="02 · BST node & traversal" lines={['typedef struct BSTNode {','    char *word;','    float weight;','    struct BSTNode *left, *right;','} BSTNode;','','float lookup(BSTNode *root, const char *key) {','    while (root) {','        int cmp = strcmp(key, root->word);','        if (cmp == 0) return root->weight;','        root = cmp < 0 ? root->left : root->right;','    }','    return 0.0f;  /* unknown term */','}']} />
        <CodeBlock title="03 · Heap allocation" lines={['typedef struct MaxHeap {','    Alert *items;','    size_t size, capacity;','} MaxHeap;','','MaxHeap *heap = malloc(sizeof(MaxHeap));','heap->items = malloc(capacity * sizeof(Alert));','heap->size = 0;','heap->capacity = capacity;','','/* push then sift toward the root */','size_t child = heap->size++;','heap->items[child] = alert;']} />
        <CodeBlock title="04 · Array swaps & down-heapify" lines={['static void swap(Alert *a, Alert *b) {','    Alert tmp = *a;','    *a = *b;','    *b = tmp;','}','','/* Pop root, move last item, sift down */','items[0] = items[--size];','size_t parent = 0;','for (;;) {','    size_t left = 2 * parent + 1;','    size_t right = left + 1;','    size_t largest = parent;','    if (left < size && items[left].priority >','        items[largest].priority) largest = left;','    if (right < size && items[right].priority >','        items[largest].priority) largest = right;','    if (largest == parent) break;','    swap(&items[parent], &items[largest]);','    parent = largest;','}']} />
      </div><div className="border-t border-[#2a3039] bg-[#171b21] px-5 py-3"><p className="flex items-start gap-2 text-[10px] leading-5 text-[#87929b]"><CircleHelp size={13} className="mt-0.5 shrink-0 text-[#71d8a5]"/>The interface executes deterministic TypeScript equivalents of these operations in your browser. C snippets are a teaching reference; no native C code, backend service, or network request is involved.</p></div></section>}
      <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-[#2a3039] pt-4 sm:flex-row sm:items-center"><p className="mono text-[9px] tracking-[.08em] text-[#65717c]">EDUCATIONAL SIMULATION · NOT A PRODUCTION MODERATION MODEL</p><p className="mono text-[9px] text-[#65717c]">HASH → BST → MAX-HEAP <span className="px-1 text-[#47755a]">/</span> ALL STATE STAYS LOCAL</p></footer>
    </main>
  </div>;
}

function Metric({label,value,icon}:{label:string;value:string;icon:ReactNode}) {
  return <div className="rounded-md border border-[#2e353e] bg-[#191e24] px-2.5 py-2"><div className="flex items-center gap-1.5 text-[#75818c]">{icon}<span className="mono text-[8px] tracking-[.08em]">{label}</span></div><div className="mono mt-1.5 text-[14px] text-[#dce3e8]">{value}</div></div>;
}
function TreeNode({word,weight,active,compact=false,tiny=false,onInspect}:{word:string;weight:number;active:boolean;compact?:boolean;tiny?:boolean;onInspect?:(word:string)=>void}) {
  const sizeClass=tiny?'min-w-[62px] justify-center':'min-w-[88px] justify-center';
  const activeClass=active?'border-[#5eaa79] bg-[#1c3a2a]':'border-[#343c45] bg-[#20252c]';
  const wordColor=active?'text-[#a0e2b8]':'text-[#c0c8cf]';
  const weightColor=weight>0?'text-[#e4958f]':'text-[#7fd0a0]';
  return <button type="button" data-testid={`node-bst-${word}`} aria-label={`${word}, sentiment weight ${weight.toFixed(2)}. Inspect BST node.`} onClick={()=>onInspect?.(word)} className={`relative z-10 flex items-center gap-1 rounded-md border px-1.5 py-1 transition ${sizeClass} ${activeClass} hover:border-[#5eaa79] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#78d69f]`}>
    <span className={`mono ${tiny?'text-[8px]':'text-[9px]'} ${wordColor}`}>{word}</span>
    <span className={`mono ${tiny?'text-[7px]':'text-[8px]'} ${weightColor}`}>{weight>0?'+':''}{weight.toFixed(2)}</span>
    {compact&&<span className="sr-only">tree node</span>}
  </button>;
}
function Rule({number,title,detail,accent}:{number:string;title:string;detail:string;accent:string}) {
  const colors:Record<string,string>={red:'text-[#e48e89]',amber:'text-[#e2c174]',green:'text-[#84d6a5]'};
  return <div className="bg-[#171b21] p-4"><div className={`mono text-[9px] ${colors[accent]}`}>RULE {number}</div><h3 className="mt-1 text-[11px] font-bold text-[#d7dde2]">{title}</h3><p className="mt-1 text-[9px] leading-4 text-[#818d97]">{detail}</p></div>;
}
function CodeBlock({title,lines}:{title:string;lines:string[]}) {
  const colorLine=(line:string) => {
    if(line.trim().startsWith('/*')||line.trim().startsWith('*')) return 'text-[#769b83]';
    if(line.includes('typedef')||line.includes('while')||line.includes('return')||line.includes('if (')) return 'text-[#8ec4aa]';
    if(line.includes('malloc')||line.includes('strcmp')||line.includes('swap')) return 'text-[#d6b878]';
    return '';
  };
  return <div className="overflow-hidden rounded-lg border border-[#303741] bg-[#11151a]">
    <div className="border-b border-[#2c333c] bg-[#191e24] px-3 py-2"><span className="mono text-[9px] uppercase tracking-[.08em] text-[#9aa5ae]">{title}</span></div>
    <pre className="overflow-x-auto p-3 text-[10px] leading-[1.65] text-[#bcc6cd]"><code>{lines.map((line,index)=><span key={`${index}-${line}`} className="block"><span className="mr-3 inline-block w-4 select-none text-right text-[#53606a]">{index+1}</span><span className={colorLine(line)}>{line||' '}</span></span>)}</code></pre>
  </div>;
}

export default function RoutedApp(){return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><App/><Toaster/></ErrorBoundary></TooltipProvider></QueryClientProvider>}