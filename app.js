'use strict';
const KEY='kinder-takenbord-v2';
const DAYS=['Ma','Di','Wo','Do','Vr','Za','Zo'];
const AVATARS=['🦊','🐼','🦁','🐙','🦄','🐸','🐯','🐵','🐰','🐧','🐶','🐱'];
const ICONS=['🛏️','🧥','👟','📚','🧸','🪥','🍽️','🧺','🎒','🧼','🚿','👕','🧦','🪣','🐶','🌱','🥣','🥛','📖','🎹','🧹','🗑️','🧽','🧃','🧩','🚲','⭐','🌙','☀️','📝'];
const DEFAULT_TASKS=[
  {id:'bed',icon:'🛏️',label:'Bed opmaken'},{id:'jas',icon:'🧥',label:'Jas ophangen'},
  {id:'schoenen',icon:'👟',label:'Schoenen opruimen'},{id:'bureau',icon:'📚',label:'Bureau opruimen'},
  {id:'speelgoed',icon:'🧸',label:'Speelgoed opruimen'}];
const EMOJI_LEAD=/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;
const CHECK_KEY=/^[^|]+\|[^|]+\|\d{4}-\d{2}-\d{2}$/;

const defaults=()=>({v:2,lastBackup:null,sound:true,checks:{},
  children:[0,1,2].map(i=>({id:'kind'+i,name:'Kind '+(i+1),avatar:AVATARS[i],tasks:DEFAULT_TASKS.map(t=>({...t}))}))});

// Accepteert v1- en v2-gegevens (opslag én back-upbestanden); geeft null bij ongeldige invoer.
function normalize(p){
  if(!p||typeof p!=='object'||!Array.isArray(p.children)||p.children.length!==3)return null;
  if(!p.checks||typeof p.checks!=='object'||Array.isArray(p.checks))return null;
  const children=[];
  for(const [i,c] of p.children.entries()){
    if(!c||typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!Array.isArray(c.tasks))return null;
    const tasks=[];
    for(const t of c.tasks){
      if(!t||typeof t.id!=='string'||!t.id||typeof t.label!=='string')return null;
      let icon=typeof t.icon==='string'?t.icon:'',label=t.label;
      if(!icon){const m=label.match(EMOJI_LEAD);if(m){icon=m[1];label=label.slice(m[0].length)}}
      tasks.push({id:t.id,icon:icon||'⭐',label:label.slice(0,70)||'Taak'});
    }
    children.push({id:c.id,name:c.name.slice(0,30)||'Kind '+(i+1),avatar:typeof c.avatar==='string'&&c.avatar?c.avatar:AVATARS[i],tasks});
  }
  if(new Set(children.map(c=>c.id)).size!==3)return null;
  const checks={};
  for(const k of Object.keys(p.checks))if(p.checks[k]===true&&CHECK_KEY.test(k))checks[k]=true;
  const lb=typeof p.lastBackup==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.lastBackup)?p.lastBackup:null;
  return {v:2,lastBackup:lb,sound:p.sound!==false,checks,children};
}

/* ---------- opslag ---------- */
const store={writable:true,persisted:null,offline:false,corrupt:false};
let data;
function load(){
  let raw=null;
  try{
    localStorage.setItem(KEY+'-probe','1');localStorage.removeItem(KEY+'-probe');
    raw=localStorage.getItem(KEY);
  }catch(e){store.writable=false;return defaults()}
  if(raw==null)return defaults();
  try{const d=normalize(JSON.parse(raw));if(d)return d}catch(e){}
  // Beschadigd: bewaar het origineel apart zodat het nooit stilletjes wordt overschreven.
  store.corrupt=true;
  try{localStorage.setItem(KEY+'-corrupt-'+Date.now(),raw)}catch(e){}
  return defaults();
}
function persist(){
  try{
    const s=JSON.stringify(data);
    localStorage.setItem(KEY,s);
    if(localStorage.getItem(KEY)!==s)throw Error('verificatie mislukt');
    store.writable=true;
  }catch(e){store.writable=false}
  updateAlerts();
  return store.writable;
}
async function initStorageInfo(){
  try{
    if(navigator.storage&&navigator.storage.persist){
      store.persisted=(await navigator.storage.persisted())||(await navigator.storage.persist());
    }
  }catch(e){}
  try{
    if('serviceWorker' in navigator){
      await navigator.serviceWorker.ready;
      store.offline=(await caches.keys()).some(k=>k.startsWith('takenbord-'));
    }
  }catch(e){}
}
const standalone=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;

/* ---------- datum ---------- */
let selected=0,offset=0,settingsChild=0;
function monday(d){const a=new Date(d.getFullYear(),d.getMonth(),d.getDate());a.setDate(a.getDate()-((a.getDay()+6)%7));return a}
function dateAt(i){const d=monday(new Date());d.setDate(d.getDate()+offset*7+i);return d}
function keyDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function pretty(d){return d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}
function backupDue(){
  if(!Object.keys(data.checks).length)return false;
  if(!data.lastBackup)return true;
  return (Date.now()-new Date(data.lastBackup+'T00:00:00').getTime())>30*864e5;
}

/* ---------- DOM ---------- */
const $=id=>document.getElementById(id);
function el(tag,cls,txt,attrs){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;if(attrs)for(const k in attrs)e.setAttribute(k,attrs[k]);return e}
function btn(txt,cls,fn){const b=el('button','btn'+(cls?' '+cls:''),txt,{type:'button'});b.onclick=fn;return b}

function updateAlerts(){
  const b=$('banner');
  let msg='';
  if(!store.writable)msg='⚠️ Bewaren lukt niet op dit apparaat. Vinkjes gaan verloren bij sluiten. Vraag een ouder om een back-up te maken.';
  else if(store.corrupt)msg='⚠️ Opgeslagen gegevens waren beschadigd en zijn apart bewaard. Herstel een back-up via Ouders.';
  b.hidden=!msg;b.textContent=msg;
  $('badge').hidden=store.writable&&!backupDue()&&!store.corrupt;
}

let cells=new Map(),heads=[],lastCells=[];
const dayComplete=(child,dk)=>child.tasks.length>0&&child.tasks.every(t=>data.checks[child.id+'|'+t.id+'|'+dk]);
const weekComplete=child=>[0,1,2,3,4,5,6].every(d=>dayComplete(child,keyDate(dateAt(d))));
// Alleen vandaag en eerdere dagen van de huidige week mogen worden aangepast.
const editable=dk=>offset===0&&dk<=keyDate(new Date());

function render(){
  const child=data.children[selected],today=keyDate(new Date());
  const tabs=$('tabs');tabs.replaceChildren();
  data.children.forEach((c,i)=>{
    const b=el('button','tab'+(i===selected?' active':''),null,{type:'button',role:'tab','aria-selected':String(i===selected)});
    b.append(el('span','av',c.avatar,{'aria-hidden':'true'}),document.createTextNode(c.name));
    b.onclick=()=>{selected=i;render()};tabs.append(b);
  });
  const start=dateAt(0),end=dateAt(6);
  $('week').textContent=pretty(start)+' – '+pretty(end)+' '+end.getFullYear();
  const head=$('head'),body=$('body');head.replaceChildren();body.replaceChildren();
  cells=new Map();heads=[];lastCells=[];
  const dayDone=[0,1,2,3,4,5,6].map(d=>dayComplete(child,keyDate(dateAt(d))));
  const hr=el('tr');hr.append(el('th',null,'Taak',{scope:'col'}));
  for(let d=0;d<7;d++){
    const dt=dateAt(d),th=el('th',[keyDate(dt)===today?'today':'',dayDone[d]?'daydone':''].join(' ').trim()||null,DAYS[d]+' '+dt.getDate(),{scope:'col'});
    heads[d]=th;hr.append(th);
  }
  head.append(hr);
  let done=0;
  child.tasks.forEach(task=>{
    const row=el('tr'),th=el('th',null,null,{scope:'row'});
    th.append(el('span','ticon',task.icon,{'aria-hidden':'true'}),document.createTextNode(task.label));
    row.append(th);
    for(let d=0;d<7;d++){
      const dt=dateAt(d),dk=keyDate(dt),id=child.id+'|'+task.id+'|'+dk,checked=!!data.checks[id],locked=!editable(dk);
      if(checked)done++;
      const cls='check'+(checked?' done':'')+(dk===today?' today':'')+(locked?' locked':'')+(dayDone[d]?' daydone':'');
      const b=el('button',cls,checked?'✓':(locked?'':'○'),{type:'button',
        'aria-label':task.label+', '+DAYS[d]+' '+pretty(dt)+', '+(checked?'gedaan':'nog niet gedaan')+(locked?' (kan niet meer of nog niet worden aangepast)':''),
        'aria-pressed':String(checked)});
      if(locked)b.disabled=true;else b.onclick=()=>toggle(child,id,d,dk);
      cells.set(id,b);lastCells[d]=b;
      const td=el('td');td.append(b);row.append(td);
    }
    body.append(row);
  });
  const total=child.tasks.length*7;
  const allToday=dayComplete(child,today);
  $('progress').textContent=(allToday?'🎉 Alles klaar vandaag! ':'')+'⭐ '+done+' van '+total+' taken';
  $('fill').style.width=(total?done/total*100:0)+'%';
  updateAlerts();
}

function toggle(child,id,d,dk){
  const wasDay=dayComplete(child,dk),wasWeek=weekComplete(child),adding=!data.checks[id];
  if(adding)data.checks[id]=true;else delete data.checks[id];
  persist();render();
  if(!adding)return;
  thumbUp(cells.get(id));
  if(weekComplete(child)&&!wasWeek){sparkleColumn(d);party(child)}
  else if(dayComplete(child,dk)&&!wasDay){sparkleColumn(d);play(JINGLE,{type:'triangle'})}
  else play([[PENTA[Math.min(child.tasks.filter(t=>data.checks[child.id+'|'+t.id+'|'+dk]).length,PENTA.length)-1],0,.28]]);
}

/* ---------- geluid ---------- */
const PENTA=[0,2,4,7,9,12,14,16,19,21,24];
const JINGLE=[[0,0,.15],[4,.12,.15],[7,.24,.15],[12,.36,.5]];
const MUSIC=[[0,0,.2],[4,.2,.2],[7,.4,.2],[12,.6,.45],[7,1.1,.2],[12,1.3,.6],
  [14,2,.2],[12,2.2,.2],[9,2.4,.2],[7,2.6,.2],[9,2.8,.2],[12,3,.2],[16,3.2,.2],[19,3.4,.2],[24,3.7,.9],
  [-12,0,.3],[-5,.6,.3],[-12,1.1,.3],[-7,1.7,.3],[-5,2.4,.3],[0,3.0,.3],[-12,3.7,.9]];
let actx=null;
function audio(){
  if(!actx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;try{actx=new C()}catch(e){return null}}
  if(actx.state!=='running')actx.resume().catch(()=>{});
  return actx;
}
// seq: [halve tonen vanaf C5, start (s), duur (s)]; geeft de volume-node terug zodat muziek kan worden gestopt.
function play(seq,{type='sine',vol=.18,force=false}={}){
  if(data.sound===false&&!force)return null;
  const ctx=audio();if(!ctx)return null;
  const out=ctx.createGain();out.connect(ctx.destination);
  const t0=ctx.currentTime+.02;
  const note=(f,t,d,ty,v)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=ty;o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+d+.05);
  };
  seq.forEach(([s,t,d])=>{const f=523.25*Math.pow(2,s/12);note(f,t0+t,d,type,vol);note(f*2,t0+t,d*.7,'triangle',vol*.3)});
  return out;
}

/* ---------- effecten ---------- */
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function thumbUp(cell){
  if(!cell)return;
  const r=cell.getBoundingClientRect(),t=el('span','thumb','👍',{'aria-hidden':'true'});
  t.style.left=(r.left+r.width/2)+'px';t.style.top=(r.top+r.height/2)+'px';
  document.body.append(t);setTimeout(()=>t.remove(),1100);
}
function sparkleColumn(d){
  if(reduceMotion()||!heads[d])return;
  const wrap=document.querySelector('.table-wrap'),w=wrap.getBoundingClientRect(),a=heads[d].getBoundingClientRect(),b=(lastCells[d]||heads[d]).getBoundingClientRect();
  const W=a.width,H=b.bottom-a.top,box=el('div','sparkles',null,{'aria-hidden':'true'});
  Object.assign(box.style,{left:(a.left-w.left+wrap.scrollLeft)+'px',top:(a.top-w.top)+'px',width:W+'px',height:H+'px'});
  const N=Math.max(12,Math.round((W+H)/22)),per=2*(W+H);
  for(let i=0;i<N;i++){
    const t=i/N*per;let x,y;
    if(t<W){x=t;y=-8}else if(t<W+H){x=W+8;y=t-W}else if(t<2*W+H){x=W-(t-W-H);y=H+8}else{x=-8;y=H-(t-2*W-H)}
    const s=el('span',null,i%3?'✨':'⭐');
    s.style.left=x+'px';s.style.top=y+'px';s.style.animationDelay=(Math.random()*.9)+'s';
    box.append(s);
  }
  wrap.append(box);setTimeout(()=>box.remove(),3400);
}
function party(child){
  const music=play(MUSIC,{type:'triangle',vol:.2});
  const ov=el('div','party',null,{role:'alertdialog','aria-modal':'true','aria-label':'Gefeliciteerd'});
  const cv=el('canvas',null,null,{'aria-hidden':'true'}),card=el('div','card');
  const close=()=>{
    if(music&&actx){music.gain.setTargetAtTime(0,actx.currentTime,.1)}
    ov.remove();
  };
  card.append(el('div','trophy','🏆',{'aria-hidden':'true'}),el('h2',null,'Gefeliciteerd, '+child.name+'!'),el('p',null,'Alle taken gedaan deze week.'));
  const ok=btn('Hoera!','main',close);card.append(ok);
  ov.append(cv,card);document.body.append(ov);ok.focus();
  if(reduceMotion())return;
  const dpr=Math.min(devicePixelRatio||1,2),W=innerWidth,H=innerHeight,g=cv.getContext('2d');
  cv.width=W*dpr;cv.height=H*dpr;
  const cols=['#ef4444','#f59e0b','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899'];
  const ps=Array.from({length:180},(_,i)=>({x:Math.random()*W,y:-20-Math.random()*H*.6,vx:(Math.random()-.5)*3,vy:2+Math.random()*3,
    w:6+Math.random()*8,h:4+Math.random()*6,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,c:cols[i%cols.length]}));
  (function tick(){
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);let alive=0;
    for(const p of ps){
      p.x+=p.vx;p.y+=p.vy;p.vy=Math.min(p.vy+.04,6);p.r+=p.vr;if(p.y<H+20)alive++;
      g.save();g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore();
    }
    if(alive&&ov.isConnected)requestAnimationFrame(tick);
  })();
}

/* ---------- ouderdialoog ---------- */
const dlg=$('parent');
function openParent(){
  const a=2+Math.floor(Math.random()*8),b=3+Math.floor(Math.random()*7),f=el('form','dlg');
  const input=el('input',null,null,{type:'text',inputmode:'numeric',autocomplete:'off','aria-label':'Antwoord'});
  const msg=el('p','small','Alleen voor ouders: los de som op om verder te gaan.');
  f.append(el('h2',null,'Voor ouders'),msg,el('p',null,'Hoeveel is '+a+' × '+b+'?'),input,
    el('div','actions'));
  const ok=el('button','btn main','Verder',{type:'submit'});
  f.lastChild.append(ok,btn('Sluiten','',()=>dlg.close()));
  f.onsubmit=e=>{e.preventDefault();if(Number(input.value)===a*b)renderSettings();else{msg.textContent='Dat klopt niet, probeer het nog eens.';input.value='';input.focus()}};
  dlg.replaceChildren(f);
  if(!dlg.open)dlg.showModal();
  input.focus();
}

function status(items){const ul=el('ul','status');items.forEach(([ok,text])=>ul.append(el('li',null,(ok===true?'✅ ':ok===false?'⚠️ ':'ℹ️ ')+text)));return ul}

function renderSettings(){
  const c=data.children[settingsChild],root=el('div','dlg');
  const top=el('div','top');top.append(el('h2',null,'⚙️ Instellingen voor ouders'),btn('Sluiten','',()=>dlg.close()));
  root.append(top);

  root.append(el('h3',null,'Opslag en installatie'));
  root.append(status([
    [store.writable,store.writable?'Lokale opslag werkt en is gecontroleerd.':'Lokale opslag werkt NIET. Maak direct een back-up en gebruik de app niet in privé-modus.'],
    store.persisted===null?[null,'Beveiliging tegen automatisch opschonen: onbekend op dit apparaat.']
      :[store.persisted,store.persisted?'Opslag is beveiligd tegen automatisch opschonen.':'Opslag is niet vastgezet; maak regelmatig een back-up.'],
    [store.offline,store.offline?'Offline beschikbaar: alle bestanden zijn opgeslagen.':'Offline gebruik nog niet klaar (open de app één keer met internet).'],
    [standalone(),standalone()?'Geïnstalleerd als app.':'Niet geïnstalleerd: tik op Deel ▸ Zet op beginscherm. Let op: gegevens in Safari en in de app zijn gescheiden; verhuis ze met een back-up.'],
    [!backupDue(),data.lastBackup?'Laatste back-up: '+data.lastBackup+(backupDue()?' (meer dan 30 dagen geleden).':'.'):(backupDue()?'Nog geen back-up gemaakt.':'Nog geen gegevens om te bewaren.')]
  ]));

  root.append(el('h3',null,'Geluid'));
  const srow=el('label','row'),cb=el('input',null,null,{type:'checkbox'});cb.checked=data.sound!==false;
  cb.onchange=()=>{data.sound=cb.checked;persist()};
  srow.append(cb,el('span',null,'Geluid en muziek bij vinkjes'));
  root.append(srow,btn('🔊 Test geluid','',()=>play([[0,0,.25],[4,.15,.25],[7,.3,.4]],{force:true})),
    el('p','small','Hoor je niets? Zet het volume hoger en controleer de stil-schakelaar van de iPad.'));

  root.append(el('h3',null,'Namen en plaatjes'));
  data.children.forEach((k,i)=>{
    const row=el('div','row'),sel=el('select',null,null,{'aria-label':'Plaatje kind '+(i+1)});
    AVATARS.concat(AVATARS.includes(k.avatar)?[]:[k.avatar]).forEach(a=>{const o=el('option',null,a);o.value=a;if(a===k.avatar)o.selected=true;sel.append(o)});
    sel.onchange=()=>{k.avatar=sel.value;persist();render()};
    const inp=el('input',null,null,{type:'text',maxlength:'30','aria-label':'Naam kind '+(i+1)});inp.value=k.name;
    inp.onchange=()=>{k.name=inp.value.trim()||'Kind '+(i+1);inp.value=k.name;persist();render()};
    row.append(sel,inp);root.append(row);
  });

  root.append(el('h3',null,'Taken'));
  const who=el('select',null,null,{'aria-label':'Taken van welk kind'});
  data.children.forEach((k,i)=>{const o=el('option',null,k.avatar+' '+k.name);o.value=i;if(i===settingsChild)o.selected=true;who.append(o)});
  who.onchange=()=>{settingsChild=Number(who.value);renderSettings()};
  root.append(who);
  c.tasks.forEach(t=>{
    const row=el('div','row'),sel=el('select',null,null,{'aria-label':'Pictogram'});
    ICONS.concat(ICONS.includes(t.icon)?[]:[t.icon]).forEach(i=>{const o=el('option',null,i);o.value=i;if(i===t.icon)o.selected=true;sel.append(o)});
    sel.onchange=()=>{t.icon=sel.value;persist();render()};
    const inp=el('input',null,null,{type:'text',maxlength:'70','aria-label':'Taak'});inp.value=t.label;
    inp.onchange=()=>{t.label=inp.value.trim()||'Taak';inp.value=t.label;persist();render()};
    const rm=btn('Verwijder','danger',()=>{
      if(!confirm('"'+t.label+'" verwijderen? Bestaande vinkjes voor deze taak worden ook gewist.'))return;
      c.tasks=c.tasks.filter(x=>x.id!==t.id);
      for(const k of Object.keys(data.checks))if(k.startsWith(c.id+'|'+t.id+'|'))delete data.checks[k];
      persist();render();renderSettings();
    });
    row.append(sel,inp,rm);root.append(row);
  });
  const add=el('div','actions');
  add.append(btn('+ Taak toevoegen','main',()=>{
    c.tasks.push({id:'taak'+Date.now()+'-'+Math.random().toString(36).slice(2,7),icon:'⭐',label:'Nieuwe taak'});
    persist();render();renderSettings();
  }));
  root.append(add,el('p','small','Wijzigingen worden direct bewaard.'));

  root.append(el('h3',null,'Back-up'));
  root.append(el('p','small','Een back-up bevat alle kinderen, taken en de volledige historie. Bewaar hem in Bestanden of iCloud Drive.'));
  const acts=el('div','actions');
  const imp=el('input',null,null,{type:'file',accept:'application/json,.json',class:'visually-hidden',id:'import'});
  imp.onchange=importBackup;
  const lbl=el('label','btn','Back-up herstellen',{for:'import'});
  acts.append(btn('Back-up maken','main',exportBackup),lbl,imp);
  root.append(acts);

  root.append(el('h3',null,'Week leegmaken'));
  const reset=btn('Vinkjes van '+c.name+' in de getoonde week wissen','danger',()=>{
    if(!confirm('Alle vinkjes van '+c.name+' voor de getoonde week verwijderen?'))return;
    const dates=Array.from({length:7},(_,i)=>keyDate(dateAt(i)));
    for(const k of Object.keys(data.checks)){const p=k.split('|');if(p[0]===c.id&&dates.includes(p[2]))delete data.checks[k]}
    persist();render();
  });
  root.append(reset);
  dlg.replaceChildren(root);
}

async function exportBackup(){
  const text=JSON.stringify({format:'kinder-takenbord',exportedAt:new Date().toISOString(),...data,lastBackup:keyDate(new Date())},null,2);
  const name='takenbord-backup-'+keyDate(new Date())+'.json';
  try{
    const file=new File([text],name,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Takenbord back-up'})}
    else{
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a',null,null,{href:url,download:name});
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    }
  }catch(e){if(e&&e.name==='AbortError')return;alert('Back-up maken is niet gelukt.');return}
  data.lastBackup=keyDate(new Date());persist();renderSettings();
}

async function importBackup(ev){
  const file=ev.target.files[0];if(!file)return;
  try{
    const p=normalize(JSON.parse(await file.text()));
    if(!p)throw Error('ongeldig');
    const n=Object.keys(p.checks).length;
    if(!confirm('Huidige gegevens vervangen door deze back-up ('+n+' vinkjes)?'))return;
    p.lastBackup=p.lastBackup||keyDate(new Date()); // zojuist uit een back-up hersteld = veilig bewaard
    data=p;selected=0;settingsChild=0;store.corrupt=false;persist();render();renderSettings();
  }catch(e){alert('Dit is geen geldige back-up van het takenbord.')}
  finally{ev.target.value=''}
}

/* ---------- start ---------- */
data=load();
$('prev').onclick=()=>{offset--;render()};
$('next').onclick=()=>{offset++;render()};
$('current').onclick=()=>{offset=0;render()};
$('parentBtn').onclick=openParent;
dlg.addEventListener('close',()=>{dlg.replaceChildren();render()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!dlg.open)render()}); // nieuwe dag → highlight bijwerken
render();
initStorageInfo().then(updateAlerts);
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
