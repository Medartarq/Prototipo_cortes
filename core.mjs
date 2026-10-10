/** Datos de fabricación. Sin acceso a red ni almacenamiento persistente. */
export const EDGES = ['L1','L2','A1','A2'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const normalize = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const mm = s => {
  if(typeof s==='number') return Number.isFinite(s)?s:NaN;
  const match=String(s??'').trim().match(/^([+-]?\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")?$/i);
  if(!match)return NaN;
  return Number(match[1].replace(',','.'))*({mm:1,cm:10,m:1000,in:25.4,'"':25.4}[match[2]?.toLowerCase()]||1);
};
export function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');
  const line=text.split(/\r?\n/)[0];
  const sep=[';',',','\t'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else field+=c;}
    else if(c===sep&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('El CSV contiene una celda con comillas sin cerrar.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2)throw Error('El archivo no contiene piezas.');
  const count=rows[0].length;
  rows.slice(1).forEach((r,i)=>{if(r.length!==count)throw Error(`La fila ${i+2} tiene ${r.length} columnas; se esperaban ${count}.`);});
  return rows;
}
function band(s){
  if(!s.trim())return null;
  if(/^[DG]$/i.test(s.trim())){const type=s.trim().toUpperCase();return {name:type==='D'?'Canto delgado':'Canto grueso',type,thickness:type==='D'?1:3,width:null};}
  const dim=s.match(/\(([\d.,]+)\s*mm\s*[x×]\s*([\d.,]+)\s*mm\)/i);
  const thickness=dim?mm(dim[1]):(/canto_d/i.test(s)?1:/canto_g/i.test(s)?3:null);
  return {name:s.split(' (')[0],type:/canto_d/i.test(s)?'D':/canto_g/i.test(s)?'G':thickness!==null?(thickness<=1?'D':'G'):'D',thickness,width:dim?mm(dim[2]):null};
}
export function importCSV(text){
  const rows=parseCSV(text), headers=rows.shift().map(normalize);
  const find=(...names)=>headers.findIndex(x=>names.map(normalize).includes(x));
  const columns={code:find('No.','Código'),name:find('Designación','Pieza'),quantity:find('Cantidad','Cant.'),length:find('Longitud - cruda','Largo de corte'),width:find('Ancho - crudo','Ancho de corte'),thickness:find('Espesor - crudo','Grosor','Espesor'),finalLength:find('Longitud','Largo final'),finalWidth:find('Anchura','Ancho final'),type:find('Tipo de material'),material:find('Nombre del material','Material'),tags:find('Operaciones','Etiquetas'),description:find('Descripción')};
  for(const key of ['name','quantity','length','width','thickness','material'])if(columns[key]<0)throw Error(`Falta la columna de ${ {name:'nombre de pieza',quantity:'cantidad',length:'largo de corte (Longitud - cruda)',width:'ancho de corte (Ancho - crudo)',thickness:'espesor',material:'material'}[key] }.`);
  const edgeCols=[find('Longitud del borde 1','L1'),find('Longitud del borde 2','L2'),find('Ancho del borde 1','A1'),find('Ancho de borde 2','Ancho del borde 2','A2')];
  if(edgeCols.some(i=>i<0))throw Error('Faltan columnas de cantos L1, L2, A1 o A2.');
  const pieces=[],skipped=[];
  rows.forEach((r,i)=>{
    const get=k=>columns[k]<0?'':r[columns[k]].trim();
    if(columns.type>=0&&!['tablero','sheet good','sheet goods'].includes(normalize(get('type')))){skipped.push(r);return;}
    const p={id:uid(),code:get('code')||String(pieces.length+1),name:get('name'),quantity:Number(get('quantity')),length:mm(get('length')),width:mm(get('width')),thickness:mm(get('thickness')),finalLength:mm(get('finalLength')),finalWidth:mm(get('finalWidth')),material:get('material'),tags:get('tags'),notes:get('description'),edges:Object.fromEntries(EDGES.map((e,j)=>[e,band(r[edgeCols[j]])])),bandOverrides:{},grain:'long',rotate:false};
    if(!p.name||!p.material||!Number.isInteger(p.quantity)||p.quantity<=0||[p.length,p.width,p.thickness].some(n=>!Number.isFinite(n)||n<=0))throw Error(`Fila ${i+2}: revisa nombre, material, cantidad y medidas positivas.`);
    if(!Number.isFinite(p.finalLength))p.finalLength=p.length;
    if(!Number.isFinite(p.finalWidth))p.finalWidth=p.width;
    pieces.push(p);
  });
  if(!pieces.length)throw Error('No se encontraron filas de tipo Tablero.');
  return {pieces,skipped:skipped.length,warnings:headers.filter(x=>x==='etiquetas').length>1?['Se tomó la primera columna Etiquetas como operaciones; la última corresponde a SketchUp.']:[]};
}
export const materialKey = p => `${p.material}\u241f${p.thickness}`;
export function groups(project){
  const map=new Map();
  for(const p of project.pieces){const key=materialKey(p);if(!map.has(key))map.set(key,{key,source:p.material,thickness:p.thickness,pieces:[],config:project.materials[key]||{name:p.material,width:2150,length:2440,kerf:3,trim:10,grain:'long'}});map.get(key).pieces.push(p);}
  return [...map.values()];
}
export function parseOperations(tags){
  const ops=[],errors=[];
  for(const original of String(tags||'').split(/[;\n]+/).map(x=>x.trim()).filter(Boolean)){
    const t=original.toUpperCase();const params={};for(const m of t.matchAll(/([A-Z_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g))params[m[1]]=m[2]??m[3]??m[4];
    if(/^RANURA\b/.test(t)){
      const legacy=t.match(/RANURA\s+(\d+(?:[.,]\d+)?)\s*[X×]\s*(\d+(?:[.,]\d+)?)\s*MM\s+D\s*=\s*(\d+(?:[.,]\d+)?)\s*MM\s+LADO\s+(LARGO|CORTO)/);
      const op=legacy?{type:'groove',depth:mm(legacy[1]),width:mm(legacy[2]),distance:mm(legacy[3]),edge:legacy[4]==='LARGO'?'L_AUTO':'A_AUTO',original}:{type:'groove',depth:mm(params.P),width:mm(params.A),distance:mm(params.D),edge:params.BORDE,original};
      if(!(op.depth>0&&op.width>0&&op.distance>=0)||!['L1','L2','A1','A2','L_AUTO','A_AUTO'].includes(op.edge))errors.push(`Ranura incompleta: ${original}`);else ops.push(op);
    }else if(/^BISEL\b/.test(t)){
      const op={type:'bevel',angle:mm(params.ANG),edge:params.BORDE,original};if(!(op.angle>0&&op.angle<90)||!EDGES.includes(op.edge))errors.push(`Bisel incompleto: ${original}`);else ops.push(op);
    }else if(/^CORTE_ESPECIAL\b/.test(t)){
      if(!params.DETALLE||!/^([A-Z0-9_-]+)$/.test(params.DETALLE))errors.push(`Indica CORTE_ESPECIAL DETALLE=AUTO o un identificador como CE01.`);else ops.push({type:'special',detail:params.DETALLE,original});
    }else if(normalize(original)==='corte_especial')ops.push({type:'special',detail:'AUTO',original});
    else if(/^CORTE 45 LADO CORTO SUPERIOR$/i.test(original))errors.push('Reemplaza “lado corto superior” por BISEL ANG=45 BORDE=A1 o A2.');
    else ops.push({type:'note',text:original,original});
  }
  return {ops,errors};
}
export function effectiveEdges(p){
  const edges=Object.fromEntries(EDGES.map(e=>[e,p.edges[e]?{...p.edges[e]}:null]));
  const bevels=parseOperations(p.tags).ops.filter(o=>o.type==='bevel');
  for(const o of bevels){const type=p.bandOverrides[o.edge]||'D';edges[o.edge]={...edges[o.edge],type,thickness:type==='D'?1:3,name:type==='D'?'Canto delgado':'Canto grueso',bevel:true,width:p.bevelWidths?.[o.edge]??null};}
  return edges;
}
export function resolveEdge(edge,p){
  if(!edge?.endsWith('_AUTO'))return edge;
  const prefix=edge[0],es=effectiveEdges(p);return es[prefix+'1']&&!es[prefix+'2']?prefix+'2':prefix+'1';
}
export function syncDetails(project){
  const used=new Set(project.pieces.flatMap(p=>parseOperations(p.tags).ops.filter(o=>o.type==='special'&&o.detail!=='AUTO').map(o=>o.detail)));
  for(const d of Object.values(project.details))used.add(d.code);
  const next=()=>{let n=1;while(used.has(`CE${String(n).padStart(2,'0')}`))n++;const c=`CE${String(n).padStart(2,'0')}`;used.add(c);return c;};
  for(const p of project.pieces){const ops=parseOperations(p.tags).ops.filter(o=>o.type==='special');p.detailRefs=p.detailRefs||{};ops.forEach((o,i)=>{const key=String(i);let code=o.detail==='AUTO'?p.detailRefs[key]:o.detail;if(!code)code=next();p.detailRefs[key]=code;if(!project.details[code])project.details[code]={code,image:null,caption:'',width:0,height:0};});}
}
export function detailCodes(p){return [...new Set(parseOperations(p.tags).ops.filter(o=>o.type==='special').map((o,i)=>o.detail==='AUTO'?p.detailRefs?.[String(i)]:o.detail).filter(Boolean))];}
export function operationText(p){return parseOperations(p.tags).ops.map(o=>o.type==='groove'?`Ranura ${o.depth}×${o.width} mm / ${resolveEdge(o.edge,p)} / D=${o.distance} mm`:o.type==='bevel'?`Bisel ${o.angle}° ${o.edge} + canto ${effectiveEdges(p)[o.edge]?.type==='G'?'grueso':'delgado'}`:o.type==='special'?`Corte especial: ${detailCodes(p).join(', ')}`:o.text).join(' · ');}
export function validate(project){
  const issues=[];
  if(!project.pieces.length)issues.push({level:'error',text:'Agrega o importa al menos una pieza.'});
  for(const p of project.pieces){
    if(!p.name||!p.material||!Number.isInteger(p.quantity)||p.quantity<1||[p.length,p.width,p.thickness].some(v=>!Number.isFinite(v)||v<=0))issues.push({level:'error',id:p.id,text:`${p.code}: revisa cantidad, material y medidas.`});
    const {ops,errors}=parseOperations(p.tags);errors.forEach(text=>issues.push({level:'error',id:p.id,text:`${p.name}: ${text}`}));
    for(const o of ops){if(o.type==='groove'){const e=resolveEdge(o.edge,p),span=e?.[0]==='L'?p.width:p.length;if(o.depth>=p.thickness||o.distance+o.width>span)issues.push({level:'error',id:p.id,text:`${p.name}: la ranura excede el espesor o la medida de la pieza.`});}
      if(o.type==='bevel'){const width=p.thickness/Math.cos(o.angle*Math.PI/180);const actual=effectiveEdges(p)[o.edge]?.width;if(!(actual>=width))issues.push({level:'pending',id:p.id,text:`${p.name}, ${o.edge}: indica una cinta de al menos ${Math.ceil(width*10)/10} mm de ancho para el bisel.`});}}
    for(const code of detailCodes(p))if(!project.details[code]?.image)issues.push({level:'pending',id:p.id,text:`${p.name}: adjunta la imagen del detalle ${code}.`});
  }
  return issues;
}
export function newProject(){return {version:1,meta:{name:'',client:'',phone:'',email:'',date:new Date().toLocaleDateString('en-CA'),notes:''},pieces:[],materials:{},details:{},reference:null};}
export function restoreProject(raw){
  if(raw?.version!==1||!raw.meta||!Array.isArray(raw.pieces)||raw.pieces.length>10000||!raw.materials||!raw.details)throw Error('El archivo no es un proyecto Indesaco compatible.');
  const ids=new Set();for(const p of raw.pieces){if(typeof p.id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(p.id)||ids.has(p.id)||!p.edges||!p.bandOverrides)throw Error('El proyecto contiene piezas sin identificador o duplicadas.');ids.add(p.id);}
  for(const d of Object.values(raw.details)){if(d.image&&!/^data:image\/(png|jpeg);base64,/.test(d.image))throw Error('El proyecto contiene un formato de imagen no permitido.');}
  if(raw.reference?.image&&!/^data:image\/(png|jpeg);base64,/.test(raw.reference.image))throw Error('La referencia no es una imagen compatible.');
  syncDetails(raw);return raw;
}
export function resolvedTags(p){let i=0;return parseOperations(p.tags).ops.map(o=>o.type==='groove'?`RANURA P=${o.depth} A=${o.width} D=${o.distance} BORDE=${resolveEdge(o.edge,p)}`:o.type==='bevel'?`BISEL ANG=${o.angle} BORDE=${o.edge}`:o.type==='special'?`CORTE_ESPECIAL DETALLE=${o.detail==='AUTO'?p.detailRefs?.[String(i++)]: (i++,o.detail)}`:o.text).join('; ');}
