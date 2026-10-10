/** Búsqueda acotada de alternativas de guillotina. Solo usa medidas y restricciones. */
const S=100,toInt=n=>Math.round(n*S),toReal=n=>n/S;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function beamSearch(items,cfg,target,orientations,options={},onProgress=()=>{}){
 const k=toInt(cfg.kerf),T=toInt(cfg.trim),W=toInt(cfg.length)-2*T,H=toInt(cfg.width)-2*T;
 const width=options.width||256,maxNodes=options.maxNodes||160000,deadline=options.deadline||Infinity;
 let nodes=0,attempts=0,solutions=0;const distinctOrders=new Set(),clock=()=>performance.now();
 const dimensions=items.map(p=>({...p,os:orientations(p,cfg).map(o=>({...o,w:toInt(o.w),h:toInt(o.h)})),area:toInt(p.length)*toInt(p.width)}));
 const modes=[p=>p.area,p=>toInt(p.length),p=>toInt(p.width),p=>Math.max(toInt(p.length),toInt(p.width))];
 for(let mode=0;mode<modes.length;mode++){
  if(nodes>=maxNodes||clock()>deadline)break;
  const list=[...dimensions].sort((a,b)=>modes[mode](b)-modes[mode](a)||b.length-a.length||b.width-a.width);
  const order=list.map(p=>JSON.stringify(p.os)).join(';');if(distinctOrders.has(order))continue;distinctOrders.add(order);attempts++;
  let states=[{free:Array.from({length:target},(_,board)=>({x:T,y:T,w:W,h:H,board})),placements:[]}];
  for(let depth=0;depth<list.length;depth++){
   if(nodes>=maxNodes||clock()>deadline)return {result:null,nodes,attempts,limited:true};
   const p=list[depth],remaining=list.slice(depth+1),types=new Map();let remainingArea=0;
   for(const q of remaining){remainingArea+=q.area;const key=JSON.stringify(q.os);if(!types.has(key))types.set(key,{os:q.os,n:0,area:q.area});types.get(key).n++;}
   const restTypes=[...types.values()],next=[],seen=new Set();
   for(const state of states){
    for(let ri=0;ri<state.free.length;ri++){
     const r=state.free[ri];for(const o of p.os){if(o.w>r.w||o.h>r.h)continue;
      for(const vertical of [true,false]){
       if(++nodes>maxNodes)return {result:null,nodes,attempts,limited:true};
       const rw=r.w-o.w-k,rh=r.h-o.h-k,board=r.board;
       const scraps=vertical?[{x:r.x+o.w+k,y:r.y,w:rw,h:r.h,board},{x:r.x,y:r.y+o.h+k,w:o.w,h:rh,board}]:[{x:r.x+o.w+k,y:r.y,w:rw,h:o.h,board},{x:r.x,y:r.y+o.h+k,w:r.w,h:rh,board}];
       const free=state.free.filter((_,i)=>i!==ri).concat(scraps.filter(f=>f.w>0&&f.h>0));
       let usable=0,waste=0,totalFree=0;for(const f of free){const area=f.w*f.h;totalFree+=area;if(restTypes.some(t=>t.os.some(o=>o.w<=f.w&&o.h<=f.h)))usable+=area;else waste+=area;}
       if(usable<remainingArea)continue;
       // Cota superior por área. No usa una cuadrícula que pueda excluir mezclas de giros.
       if(restTypes.some(t=>free.reduce((sum,f)=>sum+(t.os.some(o=>o.w<=f.w&&o.h<=f.h)?Math.floor(f.w*f.h/t.area):0),0)<t.n))continue;
       // Equivalencias geométricas y simetría entre tableros: no dependen de nombres ni códigos.
       const boardKeys=Array.from({length:target},(_,bi)=>free.filter(f=>f.board===bi).map(f=>[f.x,f.y,f.w,f.h].join(',')).sort().join(';')).sort();
       const key=boardKeys.join('|');if(seen.has(key))continue;seen.add(key);
       const placement={id:p.id,instance:p.instance,code:p.code,name:p.name,x:toReal(r.x),y:toReal(r.y),w:toReal(o.w),h:toReal(o.h),rotated:o.rotated,board};
       const placements=state.placements.concat(placement);
       if(depth===list.length-1){const boards=Array.from({length:target},(_,bi)=>({placements:placements.filter(p=>p.board===bi).map(({board,...p})=>p),offcuts:free.filter(f=>f.board===bi).map(({board,...f})=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,toReal(v)])))})).filter(b=>b.placements.length);const result={boards,unplaced:[]};if(options.quality){options.onSolution?.(result);if(++solutions>=(options.maxSolutions||32))return {result:null,nodes,attempts,limited:true};continue;}return {result,nodes,attempts,limited:false};}
       let priority=waste+(target*W*H-totalFree)*2+free.length*(W*H*0.00002);
       if(options.quality){const c=options.settings,good=free.filter(f=>Math.max(f.w,f.h)>=toInt(c.offcutMinLength)&&Math.min(f.w,f.h)>=toInt(c.offcutMinWidth)),largest=Math.max(0,...good.map(f=>f.w*f.h));priority-=largest*(c.priority==='offcuts'?0.35:0.08);}

       next.push({free,placements,priority});
      }
     }
    }
    if(nodes%2048<128&&clock()>deadline)return {result:null,nodes,attempts,limited:true};
   }
   next.sort((a,b)=>a.priority-b.priority);states=next.slice(0,width);
   onProgress({attempt:mode+1,depth:depth+1,total:list.length,nodes});await yieldUI();
   if(!states.length)break;
  }
 }
 return {result:null,nodes,attempts,limited:nodes>=maxNodes||clock()>deadline};
}
