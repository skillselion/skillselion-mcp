// replicate load_skill pool logic standalone
const API='https://skillselion.com/api/upstream';
const H={accept:'application/json','user-agent':'dbg'};
async function fetchListings(p){const r=await fetch(`${API}/listings?`+new URLSearchParams(p),{headers:H});if(!r.ok)throw new Error('s'+r.status);const d=await r.json();const rows=Array.isArray(d)?d:(d.data||d.items||[]);return rows.filter(x=>x&&typeof x.name==='string');}
const STOP=new Set(['build','create','make','a','an','the','for','to','with','in','on','of','and','or','my','your','best','practices']);
const sigTerms=(s)=>String(s||'').toLowerCase().split(/[^a-z0-9+#.]+/i).filter(t=>t.length>1&&!STOP.has(t));
const q='react list performance optimization';
const broad=sigTerms(q)[0];
console.log('broad=',broad,'broad!==query?',broad!==q);
const pools=await Promise.all([
  fetchListings({type:'skill',q,limit:'10'}).then(r=>r,e=>{console.log('smartfetch-ish full err',e.message);return [];}).catch(()=>[]),
  broad&&broad!==q?fetchListings({type:'skill',q:broad,limit:'10'}).catch(()=>[]):Promise.resolve([]),
]);
console.log('pool sizes:',pools.map(p=>p.length));
