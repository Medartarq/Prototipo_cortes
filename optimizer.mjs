import {analyzeBoard,aggregateQuality,qualityRank,rankLess,qualitySettings} from './optimizer-quality.mjs';
import {beamSearch} from './optimizer-search.mjs';
/** Motor de guillotina: búsqueda determinista y verificación independiente. */
const S=100, int=n=>Math.round(n*S), real=n=>n/S;
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function orientations(p,cfg){
 const native={w:p.length,h:p.width,rotated:false}, turned={w:p.width,h:p.length,rotated:true};
 if(cfg.grain==='none'||p.grain==='none')return p.rotate&&p.length!==p.width?[native,turned]:[native];
 const same=p.grain===cfg.grain;
 return same?[native]:(p.rotate?[turned]:[]);
}
function pack(items,cfg,variant){
 const W=int(cfg.length)-2*int(cfg.trim),H=int(cfg.width)-2*int(cfg.trim),k=int(cfg.kerf),T=int(cfg.trim);
 const boards=[],unplaced=[];const rand=rng(variant+1701);
 const modes=[p=>p.length*p.width,p=>Math.max(p.length,p.width),p=>p.length,p=>p.width,p=>Math.min(p.length,p.width),p=>p.length+p.width];
 let list=items.map(p=>({...p,rank:rand()}));
 const mode=variant%8;
 if(mode<6)list.sort((a,b)=>modes[mode](b)-modes[mode](a)||a.instance.localeCompare(b.instance));
 else list.sort((a,b)=>(b.length*b.width)*(0.5+b.rank)-(a.length*a.width)*(0.5+a.rank));
 for(const p of list){let best=null;
  const os=orientations(p,cfg).map(o=>({...o,w:int(o.w),h:int(o.h)}));
  function find(){boards.forEach((b,bi)=>b.free.forEach((r,ri)=>os.forEach(o=>{if(o.w>r.w||o.h>r.h)return;const dw=r.w-o.w,dh=r.h-o.h;const score=variant%3===0?Math.min(dw,dh)*1e6+Math.max(dw,dh):variant%3===1?r.w*r.h-o.w*o.h:Math.max(dw,dh)*1e6+Math.min(dw,dh);if(!best||score<best.score)best={bi,ri,r,o,score};})));}
  find();if(!best){if(!os.some(o=>o.w<=W&&o.h<=H)||(cfg.count&&boards.length>=cfg.count)){unplaced.push(p);continue;}boards.push({free:[{x:T,y:T,w:W,h:H}],placements:[]});find();}
  const b=boards[best.bi],{r,o,ri}=best;b.free.splice(ri,1);b.placements.push({id:p.id,instance:p.instance,code:p.code,name:p.name,x:real(r.x),y:real(r.y),w:real(o.w),h:real(o.h),rotated:o.rotated});
  const rw=r.w-o.w-k,rh=r.h-o.h-k;
  const vertical=variant%2===0?(rw>=rh):(rw<rh);
  const scraps=vertical?[{x:r.x+o.w+k,y:r.y,w:rw,h:r.h},{x:r.x,y:r.y+o.h+k,w:o.w,h:rh}]:[{x:r.x+o.w+k,y:r.y,w:rw,h:o.h},{x:r.x,y:r.y+o.h+k,w:r.w,h:rh}];
  b.free.push(...scraps.filter(x=>x.w>0&&x.h>0));
 }
 return {boards:boards.map(b=>({placements:b.placements,offcuts:b.free.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,real(v)])))})),unplaced};
}
/** Reconstruct an actual slicing tree from geometry, independent of the placement algorithm. */
export function slicingTree(rect,placements,kerf,firstAxis='x'){
 const k=int(kerf),R=Object.fromEntries(Object.entries(rect).map(([k,v])=>[k,int(v)]));
 const ps=placements.map(p=>({...p,x:int(p.x),y:int(p.y),w:int(p.w),h:int(p.h)}));
 const memo=new Set();
 function solve(r,list){
  if(!list.length)return {type:'offcut',rect:r};
  if(list.length===1){const p=list[0];return {type:'piece',rect:r,piece:p};}
  const key=list.map(p=>p.instance).sort().join(',');if(memo.has(key))return null;
  for(const axis of (firstAxis==='y'?['y','x']:['x','y'])){const size=axis==='x'?'w':'h';const ordered=[...list].sort((a,b)=>a[axis]-b[axis]);let end=-Infinity;
   for(let i=0;i<ordered.length-1;i++){end=Math.max(end,ordered[i][axis]+ordered[i][size]);const next=ordered[i+1][axis];if(next-end<k)continue;
    const left=ordered.slice(0,i+1),right=ordered.slice(i+1);if(left.some(p=>p[axis]+p[size]>end)||right.some(p=>p[axis]<end+k))continue;
    const a={...r,[size]:end-r[axis]},b={...r,[axis]:end+k,[size]:r[axis]+r[size]-end-k};const ta=solve(a,left),tb=solve(b,right);if(ta&&tb)return {type:'cut',axis,at:end,rect:r,a:ta,b:tb};
   }
  }
  memo.add(key);return null;
 }
 return solve(R,ps);
}
export function validateLayout(result,items,cfg){
 const problems=[],seen=new Set(),expected=new Map(items.map(p=>[p.instance,p]));
 const rect={x:cfg.trim,y:cfg.trim,w:cfg.length-2*cfg.trim,h:cfg.width-2*cfg.trim};
 result.boards.forEach((b,bi)=>{
  for(const p of b.placements){const source=expected.get(p.instance);if(!source||seen.has(p.instance)){problems.push('Pieza inexistente o repetida.');continue;}seen.add(p.instance);
   if(![p.x,p.y,p.w,p.h].every(Number.isFinite)||p.w<=0||p.h<=0){problems.push('Geometría inválida.');continue;}
   if(int(p.x)<int(rect.x)||int(p.y)<int(rect.y)||int(p.x+p.w)>int(rect.x+rect.w)||int(p.y+p.h)>int(rect.y+rect.h))problems.push(`Tablero ${bi+1}: pieza fuera del área útil.`);
   if(!orientations(source,cfg).some(o=>int(o.w)===int(p.w)&&int(o.h)===int(p.h)&&o.rotated===p.rotated))problems.push('Medidas o veta incompatibles.');
  }
  for(let i=0;i<b.placements.length;i++)for(let j=i+1;j<b.placements.length;j++){const a=b.placements[i],c=b.placements[j],k=int(cfg.kerf);if(!(int(a.x+a.w)+k<=int(c.x)||int(c.x+c.w)+k<=int(a.x)||int(a.y+a.h)+k<=int(c.y)||int(c.y+c.h)+k<=int(a.y)))problems.push('Piezas superpuestas o sin separación de sierra.');}
  if(!slicingTree(rect,b.placements,cfg.kerf))problems.push(`Tablero ${bi+1}: no existe secuencia de guillotina.`);
 });
 const pending=new Set();for(const p of result.unplaced||[]){if(!expected.has(p.instance)||seen.has(p.instance)||pending.has(p.instance))problems.push('Cantidades inconsistentes.');pending.add(p.instance);}
 if(seen.size+pending.size!==items.length)problems.push('Faltan piezas en el resultado.');
 if(cfg.count&&result.boards.length>cfg.count)problems.push('Se excedió el stock disponible.');
 return [...new Set(problems)];
}
export function expandPieces(pieces){const items=[];for(const p of pieces)for(let i=0;i<p.quantity;i++)items.push({...p,instance:p.id+':'+i});return items;}
function boardAnalysis(board,cfg){return analyzeBoard(board,cfg,first=>slicingTree({x:cfg.trim,y:cfg.trim,w:cfg.length-2*cfg.trim,h:cfg.width-2*cfg.trim},board.placements,cfg.kerf,first));}
const qualityKey=cfg=>JSON.stringify([qualitySettings(cfg).priority,qualitySettings(cfg).offcutMinLength,qualitySettings(cfg).offcutMinWidth,cfg.length,cfg.width,cfg.trim,cfg.kerf]);
export function refreshPlan(result,cfg=result.config){const analyses=result.boards.map(b=>boardAnalysis(b,cfg));result.quality=aggregateQuality(analyses);result.qualityConfig=qualityKey(cfg);result.boards.forEach((b,i)=>{b.offcuts=analyses[i].offcuts;b.quality=analyses[i].metrics;});return result;}
export function comparePlans(a,b,cfg=a.config||b.config){for(const key of ['unplaced','boards'])if(a[key].length!==b[key].length)return a[key].length<b[key].length?-1:1;if(!a.quality||a.qualityConfig!==qualityKey(cfg))refreshPlan(a,cfg);if(!b.quality||b.qualityConfig!==qualityKey(cfg))refreshPlan(b,cfg);const x=qualityRank(a.quality,cfg,a.boards.length),y=qualityRank(b.quality,cfg,b.boards.length);return rankLess(x,y)?-1:rankLess(y,x)?1:0;}
const better=(a,b,cfg)=>comparePlans(a,b,cfg)<0;
export async function optimize(pieces,cfg,iterations=120,onProgress=()=>{}){
 if(![cfg.length,cfg.width,cfg.kerf,cfg.trim].every(Number.isFinite)||cfg.length<=0||cfg.width<=0||cfg.kerf<0||cfg.trim<0||cfg.length<=2*cfg.trim||cfg.width<=2*cfg.trim)throw Error('Revisa tamaño, ancho de sierra y margen del tablero.');
 if(!Number.isInteger(iterations)||iterations<1||iterations>10000)throw Error('La cantidad de alternativas debe ser un entero entre 1 y 10000.');
 if(cfg.count!==null&&cfg.count!==undefined&&(!Number.isInteger(cfg.count)||cfg.count<1))throw Error('La cantidad disponible debe ser un entero positivo o estar vacía.');
 if(pieces.some(p=>!Number.isInteger(p.quantity)||p.quantity<1||![p.length,p.width].every(n=>Number.isFinite(n)&&n>0)))throw Error('Las cantidades y medidas deben ser positivas.');
 if(pieces.reduce((s,p)=>s+p.quantity,0)>1500)throw Error('Esta versión admite hasta 1500 piezas por grupo. Divide el proyecto para optimizarlo.');
 if([...pieces.flatMap(p=>[p.length,p.width]),cfg.length,cfg.width,cfg.trim,cfg.kerf].some(n=>Math.abs(n*100-Math.round(n*100))>1e-6))throw Error('Para optimizar, usa como máximo dos decimales en milímetros.');
 const settings=qualitySettings(cfg);if(!['balanced','offcuts','cuts'].includes(settings.priority)||![settings.offcutMinLength,settings.offcutMinWidth].every(n=>Number.isFinite(n)&&n>0))throw Error('Revisa la prioridad y las medidas mínimas del retazo útil.');
 const items=expandPieces(pieces);if(!items.length)throw Error('No hay piezas en este material.');if(items.length>1500)throw Error('Esta versión admite hasta 1500 piezas por grupo. Divide el proyecto para optimizarlo.');
 let best=null;for(let n=0;n<iterations;n++){const r=pack(items,cfg,n);if(!best||better(r,best,cfg))best=r;if(n%20===0){onProgress(Math.round((n+1)/iterations*35),best);await new Promise(r=>setTimeout(r,0));}}
 const usableW=cfg.length-2*cfg.trim,usableH=cfg.width-2*cfg.trim;
 const eligible=items.filter(p=>orientations(p,cfg).some(o=>o.w<=usableW&&o.h<=usableH)),impossible=items.filter(p=>!eligible.includes(p));
 const eligibleArea=eligible.reduce((a,p)=>a+int(p.length)*int(p.width),0),eligibleLower=Math.ceil(eligibleArea/(int(usableW)*int(usableH)));
 const search={initialBoards:best.boards.length,initialUnplaced:best.unplaced.length,method:'alternativas de guillotina',nodes:0,attempts:0,improved:false,limited:false,skipped:false};
 if(eligible.length&&eligible.length<=160&&best.boards.length<=4){
  const incomplete=best.unplaced.length>impossible.length;
  const goals=[eligibleLower,incomplete?best.boards.length:best.boards.length-1].filter((n,i,a)=>n>0&&n<=4&&(!cfg.count||n<=cfg.count)&&(incomplete?n<=best.boards.length:n<best.boards.length)&&a.indexOf(n)===i);
  const deep=iterations>=600,budget=deep?800000:160000,deadline=performance.now()+(deep?20000:6000);let lastProgress=35;
  for(const goal of goals){
   if(search.nodes>=budget||performance.now()>deadline){search.limited=true;break;}
   const attempt=await beamSearch(eligible,cfg,goal,orientations,{width:deep?512:256,maxNodes:budget-search.nodes,deadline},p=>{lastProgress=Math.max(lastProgress,Math.min(95,35+Math.round((p.attempt-1+p.depth/p.total)/4*60)));onProgress(lastProgress,best);});
   search.nodes+=attempt.nodes;search.attempts+=attempt.attempts;search.limited||=attempt.limited;
   if(attempt.result){attempt.result.unplaced=impossible;const errors=validateLayout(attempt.result,items,cfg);if(errors.length)throw Error('La búsqueda produjo un plan inválido: '+errors.join(' '));if(better(attempt.result,best,cfg)){best=attempt.result;search.improved=true;}if(best.boards.length===eligibleLower&&best.unplaced.length===impossible.length)break;}
  }
 }else if(eligible.length>160||best.boards.length>4)search.skipped=true;
 // Conservar el mínimo de tableros y explorar calidad dentro de ese mismo límite.
 refreshPlan(best,cfg);
 const qualitySearch={before:{...best.quality},solutions:0,nodes:0,improved:false,limited:false};
 if(eligible.length&&eligible.length<=160&&best.boards.length>0&&best.boards.length<=4&&best.unplaced.length===impossible.length){
  const deep=iterations>=600,budget=deep?240000:70000,deadline=performance.now()+(deep?10000:3000);let last=95;
  // Compartir candidatos equilibrados antes de sesgar la búsqueda hacia retazos.
  const policies=settings.priority==='offcuts'?['balanced','offcuts']:['balanced'];
  for(const priority of policies){if(qualitySearch.nodes>=budget||performance.now()>deadline){qualitySearch.limited=true;break;}
   const refined=await beamSearch(eligible,cfg,best.boards.length,orientations,{width:deep?384:192,maxNodes:budget-qualitySearch.nodes,deadline,quality:true,maxSolutions:deep?64:32,settings:{...settings,priority},onSolution:r=>{r.unplaced=impossible;qualitySearch.solutions++;if(better(r,best,cfg)&&!validateLayout(r,items,cfg).length){best=r;qualitySearch.improved=true;}}},p=>{last=Math.max(last,Math.min(99,95+Math.round((p.attempt-1+p.depth/p.total)/4*4)));onProgress(last,best);});
   qualitySearch.nodes+=refined.nodes;qualitySearch.limited||=refined.limited;
  }
 }
 best.search=search;best.qualitySearch=qualitySearch;refreshPlan(best,cfg);
 const errors=validateLayout(best,items,cfg);if(errors.length)throw Error(errors.join(' '));
 const area=items.reduce((s,p)=>s+int(p.length)*int(p.width),0),available=(int(cfg.length)-2*int(cfg.trim))*(int(cfg.width)-2*int(cfg.trim));
 best.lowerBound=Math.ceil(area/available);best.proven=!best.unplaced.length&&best.boards.length===best.lowerBound;
 best.iterations=iterations;best.config={...cfg};onProgress(100,best);return best;
}
export function cutSequence(board,cfg){return boardAnalysis(board,cfg).cuts;}
