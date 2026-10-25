"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MAPS = [
 {id:'campus', name:'学校全体図', src:'assets/maps/campus.svg', prefix:'A', building:'campus'},
 {id:'zenki1', name:'前期棟1F', src:'assets/maps/zenki1.svg', prefix:'Z1', building:'zenki',floor:1},
 {id:'zenki2', name:'前期棟2F', src:'assets/maps/zenki2.svg', prefix:'Z2', building:'zenki',floor:2},
 {id:'koki1', name:'後期棟1F', src:'assets/maps/koki1.svg', prefix:'K1', building:'koki',floor:1},
 {id:'koki2', name:'後期棟2F', src:'assets/maps/koki2.svg', prefix:'K2', building:'koki',floor:2},
 {id:'koki3', name:'後期棟3F', src:'assets/maps/koki3.svg', prefix:'K3', building:'koki',floor:3}
];
const STORAGE_KEY='ofes-prototype-v08'; // 旧版から維持
const STAMP_KEY='ofes-stamp-v08';
const STAMP_BASE_URL='https://otoyoacademy.github.io/Ofes/';
// 試作版の画面ロックのみ。Supabaseの安全な認証には使用しない。
const DEMO_ADMIN_PASSWORD='ofes0034';
const SESSION_IDS=['s1','s2','s3','s4'];
const DEFAULT_SESSIONS={
 s1:{label:'セッション①',start:'09:20',end:'09:40'},
 s2:{label:'セッション②',start:'09:50',end:'10:10'},
 s3:{label:'セッション③',start:'10:20',end:'10:40'},
 s4:{label:'セッション④',start:'10:50',end:'11:10'}
};
const DEFAULT_DATA = {
 year:'2026', eventDate:'2026-11-21', slogan:'挑戦・協働・創造', reactionDeadline:'2026-11-21T17:00',
 noticeTitle:'おおフェス（OFES）Webアプリのご案内',
 noticeMessage:'今年度のおおフェスでは、プログラムや会場案内などをスマートフォンで確認できるWebアプリ「OFES」をご利用いただけます。会場での移動や発表見学に、ぜひご活用ください。',
 noticeIssuer:'大豊学園',
 test:{enabled:false,date:'2026-11-21',time:'09:25'},
 sessions:JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
 zones:[],nextIds:{campus:1,zenki1:1,zenki2:1,koki1:1,koki2:1,koki3:1},
 programs:[
  {id:'p1',session:'other',start:'08:45',end:'09:05',grade:'',group:'',title:'開会行事・アトラクション',zoneId:''},
  {id:'p6',session:'afternoon',start:'13:32',end:'13:38',grade:'',group:'',title:'午後のステージ発表（仮）',zoneId:''}
 ]
};
const clone = (v)=>JSON.parse(JSON.stringify(v));
const esc = (v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=(id)=>document.getElementById(id);
function getSaved(){try {const a=localStorage.getItem(STORAGE_KEY);return a?validData(JSON.parse(a)):clone(DEFAULT_DATA)}catch(e){console.warn(e);return clone(DEFAULT_DATA)}}
function reactionProgramKey(p){
 return `${String(p.grade||'').trim()}|${String(p.group||'').trim()}|${String(p.title||'').trim()}`.toLocaleLowerCase('ja');
}
function syncReactionGroups(target){
 const programs=target?.programs||[];
 const eligible=programs.filter(p=>SESSION_IDS.includes(p.session)||p.session==='afternoon');
 const usage=new Map();
 for(const p of eligible){
  if(!p.reactionId)continue;
  const key=reactionProgramKey(p);if(!usage.has(p.reactionId))usage.set(p.reactionId,new Set());usage.get(p.reactionId).add(key);
 }
 const byKey=new Map();
 for(const p of eligible){const key=reactionProgramKey(p);if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(p);}
 for(const [key,items] of byKey){
  const stable=items.map(p=>p.reactionId).find(id=>id && usage.get(id)?.size===1);
  const chosen=stable||items[0]?.id||`reaction-${Date.now()}`;
  items.forEach(p=>p.reactionId=chosen);
 }
 for(const p of programs){if(!(SESSION_IDS.includes(p.session)||p.session==='afternoon')&&!p.reactionId)p.reactionId=p.id;}
}
function validData(v){
 if(!v || typeof v!=='object'||!Array.isArray(v.zones)||!Array.isArray(v.programs))throw Error('データ形式が不正です');
 const out={...clone(DEFAULT_DATA), ...v};
 if(typeof v.reactionDeadline!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.reactionDeadline))out.reactionDeadline=out.eventDate+'T17:00';
 out.zones=v.zones.filter(z=>z && typeof z.id==='string' && MAPS.some(m=>m.id===z.mapId)).map(z=>({id:z.id,mapId:z.mapId,name:String(z.name||'会場'),note:String(z.note||''),kind:String(z.kind||'classroom'),x:bound(z.x,0,100),y:bound(z.y,0,100),w:bound(z.w,.1,100),h:bound(z.h,.1,100)}));
 // Ver.1.6: セッションの時刻は4つだけを先に設定し、各会場の発表はセッションを参照する。
 out.sessions=clone(DEFAULT_SESSIONS);
 for(const sid of SESSION_IDS){
  const legacy=(v.programs||[]).find(p=>p&&p.session===sid);
  const src=v.sessions?.[sid]||legacy||{};
  const start=/^\d{2}:\d{2}$/.test(String(src.start||''))?String(src.start):DEFAULT_SESSIONS[sid].start;
  const end=/^\d{2}:\d{2}$/.test(String(src.end||''))?String(src.end):DEFAULT_SESSIONS[sid].end;
  out.sessions[sid]={label:DEFAULT_SESSIONS[sid].label,start,end};
 }
 out.programs=v.programs.filter(p=>p&&typeof p.id==='string').map(p=>{
  const session=String(p.session||'other');
  const sd=out.sessions[session];
  return {id:p.id,reactionId:String(p.reactionId||''),session,start:sd?.start||String(p.start||'09:00'),end:sd?.end||String(p.end||'09:20'),grade:String(p.grade||''),group:String(p.group||''),title:String(p.title||'発表'),zoneId:String(p.zoneId||'')};
 });
 // Ver.1.14: リアクションは「学年 + 発表グループ + 発表内容」を1つの発表単位として扱う。
 // 同じグループが複数セッションで同じ発表を行う場合だけreactionIdを共有する。
 syncReactionGroups(out);
 out.noticeTitle=String(v.noticeTitle||DEFAULT_DATA.noticeTitle);
 out.noticeMessage=String(v.noticeMessage||DEFAULT_DATA.noticeMessage);
 out.noticeIssuer=String(v.noticeIssuer||DEFAULT_DATA.noticeIssuer);
 out.nextIds={...clone(DEFAULT_DATA.nextIds),...(v.nextIds||{})};
 out.test={...clone(DEFAULT_DATA.test),...(v.test||{})};
 delete out.gallery;
 return out;
}
function bound(v,a,b){const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):a}
// ローカル編集用データと、Supabaseから取得した公開データは混ぜない。
// バージョン更新時、従来のlocalStorageデータは編集用としてそのまま引き継ぐ。
let hasLegacyDraft=false;
try {hasLegacyDraft=!!localStorage.getItem(STORAGE_KEY);} catch(e) {console.warn('localStorage unavailable',e);}
let draftState=getSaved();
let publishedState=null;
let editorActive=false;
// デモ登録後は、この端末だけ下書きを来場者画面で即時プレビューする。再読み込みすると解除される。
let demoDraftPreview=false;
let state=draftState;
let cloudAvailable=false;
const schemaVersion=6;
function projectPublished(src){
 const safe=validData(src);
 // テスト日時はブラウザ専用。公開データには送らず、全来場者で実時刻を使う。
 return {schemaVersion,year:safe.year,eventDate:safe.eventDate,slogan:safe.slogan,sessions:clone(safe.sessions),
   zones:clone(safe.zones),nextIds:clone(safe.nextIds),programs:clone(safe.programs),reactionDeadline:safe.reactionDeadline,
   noticeTitle:safe.noticeTitle,noticeMessage:safe.noticeMessage,noticeIssuer:safe.noticeIssuer};
}
function acceptPublished(doc){
 try {
  publishedState=doc?validData({...doc,test:{enabled:false,date:doc.eventDate||DEFAULT_DATA.eventDate,time:'09:25'}}):null;
  cloudAvailable=!!publishedState;
  if(!editorActive && !demoDraftPreview){state=publishedState||draftState;renderPublic();}
 }catch(e){console.error('公開データの形式が不正です',e);toast('Supabaseの公開データを読み込めませんでした。');}
}
function switchDraft(){
 editorActive=true;
 // 新規ブラウザの場合は、最初の編集時に公開済みデータから下書きを作る。
 if(!hasLegacyDraft && !localStorage.getItem(STORAGE_KEY) && publishedState){
  draftState=clone(publishedState);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(draftState));
 }
 state=draftState;
}
function closeDraft(){editorActive=false;state=demoDraftPreview?draftState:(publishedState||draftState);renderPublic();}
window.OFESCloud={
  exportPublished:()=>projectPublished(draftState),
  publishedSummary:()=>({exists:cloudAvailable,year:publishedState?.year,zones:publishedState?.zones.length||0,programs:publishedState?.programs.length||0}),
  importPublishedAsDraft:()=>{
   if(!publishedState)throw Error('Supabaseにはまだ公開データがありません。');
   draftState=clone(publishedState);state=draftState;persist();editId='';editDraft=null;drawMode='';adminMap='campus';
   renderAdmin();renderPublic();toast('Supabaseの公開データを編集用に読み込みました');
  }
};
window.addEventListener('ofes-cloud-published',e=>acceptPublished(e.detail?.data??null));

let visitorBuilding='campus',session='current',visitorSelected='';
let programGradeFilter='all';
let programReturnScrollY=0;
let reactionPreviewMode=false,reactionPreviewProgram=null;
const visitorZoom=Object.fromEntries(MAPS.map(m=>[m.id,100]));
let adminMap='campus',editId='',editDraft=null,drawMode='',dragStart=null,dragRect=null,adminProgramVenue='';
function syncSessionProgramTimes(target=state){
 if(!target.sessions)target.sessions=clone(DEFAULT_SESSIONS);
 for(const p of target.programs||[]){const sd=target.sessions[p.session];if(sd){p.start=sd.start;p.end=sd.end;}}
}
function persist(){try{syncSessionProgramTimes(state);syncReactionGroups(state);draftState=state;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true}catch(e){alert('ブラウザに保存できませんでした。容量・設定をご確認ください。');return false}}
function toast(msg){byId('saveToast').textContent=msg;}
function getZone(id){return state.zones.find(z=>z.id===id)}
function getMap(id){return MAPS.find(m=>m.id===id)||MAPS[0]}
function timeNum(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function sessionDef(id){return state.sessions?.[id]||DEFAULT_SESSIONS[id]||null}
function programTimes(p){const sd=sessionDef(p.session);return sd?{start:sd.start,end:sd.end}:{start:p.start,end:p.end}}
function sessionLabel(id){return sessionDef(id)?.label||({other:'その他',afternoon:'午後'}[id]||id)}
function programStatus(p){
 const t=viewTime(),pt=programTimes(p);
 if(t.date<state.eventDate)return {key:'upcoming',label:'発表予定'};
 if(t.date>state.eventDate)return {key:'ended',label:'終了しました'};
 if(t.minute<timeNum(pt.start))return {key:'upcoming',label:'発表予定'};
 if(t.minute<timeNum(pt.end))return {key:'live',label:'発表中'};
 return {key:'ended',label:'終了しました'};
}
function dateISO(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`}
function viewTime(){if(state.test.enabled){return {date:state.test.date,time:state.test.time,minute:timeNum(state.test.time),demo:true}}
 const d=new Date();return{date:dateISO(d),time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,minute:d.getHours()*60+d.getMinutes(),demo:false};}
function activePrograms(){const t=viewTime();return state.programs.filter(p=>{const pt=programTimes(p);return t.date===state.eventDate && timeNum(pt.start)<=t.minute && t.minute<timeNum(pt.end)})}
function scheduledPrograms(){if(session==='current')return activePrograms();return state.programs.filter(p=>p.session===session)}
function orderedPrograms(){return [...state.programs].sort((a,b)=>timeNum(programTimes(a).start)-timeNum(programTimes(b).start)||String(a.zoneId).localeCompare(String(b.zoneId))||String(a.id).localeCompare(String(b.id)))}
function normalizeGradeText(v){
 return String(v||'').replace(/[０-９]/g,ch=>String('０１２３４５６７８９'.indexOf(ch))).replace(/[～~]/g,'〜').replace(/[－—–]/g,'-');
}
function programGradeNumbers(p){
 const raw=normalizeGradeText(p?.grade).trim();
 if(!raw)return [];
 if(/全学年|全校|全体/.test(raw))return [1,2,3,4,5,6,7,8,9];
 const set=new Set();
 for(const m of raw.matchAll(/([1-9])\s*[〜-]\s*([1-9])/g)){
  const a=Number(m[1]),b=Number(m[2]),lo=Math.min(a,b),hi=Math.max(a,b);
  for(let n=lo;n<=hi;n++)set.add(n);
 }
 for(const m of raw.matchAll(/[1-9]/g))set.add(Number(m[0]));
 return [...set].sort((a,b)=>a-b);
}
function programMatchesGrade(p,filter=programGradeFilter){
 if(filter==='all')return true;
 const raw=String(p?.grade||'').trim();
 if(!raw)return true; // 学年未指定は全体行事として各学年に表示
 return programGradeNumbers(p).includes(Number(filter));
}
function renderGradeFilter(){
 const root=byId('gradeFilter');if(!root)return;
 root.querySelectorAll('[data-grade-filter]').forEach(b=>{
  const active=b.dataset.gradeFilter===programGradeFilter;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
 const label=programGradeFilter==='all'?'全プログラム':`${programGradeFilter}年生のプログラム`;
 if(byId('programHeading'))byId('programHeading').textContent=label;
 if(byId('gradeFilterNote'))byId('gradeFilterNote').textContent=programGradeFilter==='all'?'すべてのプログラムを表示しています。':`${programGradeFilter}年生に関係する発表と全体行事を表示しています。`;
}
function roomLabel(p){return getZone(p.zoneId)?.name||'会場未登録'}
function renderHeader(){
 byId('heroYear').textContent=state.year;
 byId('heroSlogan').textContent=state.slogan;
 const today=new Date(),end=new Date(state.eventDate+'T00:00:00'), start=new Date(dateISO(today)+'T00:00:00');
 const dif=Math.round((end.getTime()-start.getTime())/86400000);
 byId('countdown').textContent=dif>0?`開催まであと ${dif} 日`:dif===0?'いよいよ本日！':'今年のおおフェスは終了しました';
 const v=viewTime();byId('previewTag').hidden=!v.demo;byId('previewTag').textContent=`TEST ${v.date} ${v.time}`;
}
function setTab(tab,opts={}){$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.tab-view').forEach(v=>v.classList.toggle('active',v.id===`tab-${tab}`));if(tab==='venues')renderVisitorMap();if(opts.scrollTop!==false)window.scrollTo({top:0,behavior:'smooth'});}
$$('.nav').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
byId('gradeFilter')?.addEventListener('click',e=>{const b=e.target.closest('[data-grade-filter]');if(!b)return;programGradeFilter=b.dataset.gradeFilter||'all';renderProgram();});
function renderProgram(){
 renderGradeFilter();
 const filteredOrdered=orderedPrograms().filter(p=>programMatchesGrade(p));
 const v=viewTime(),active=activePrograms().filter(p=>programMatchesGrade(p));
 let text='';
 if(v.date!==state.eventDate){
  text=`開催日：<strong>${esc(state.eventDate.replaceAll('-','/'))}</strong>`;
 }else if(active.length){
  text=`<strong>ただいま開催中</strong><br>${active.map(p=>esc(`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`)).join('・')}`;
 }else{
  text='現在開催中のプログラムはありません。';
 }
 byId('timeStatus').innerHTML=text;
 const units=[];
 // 午前セッションは時間帯ごと、午後の有志発表も1つの折りたたみグループにまとめる。
 for(const p of filteredOrdered.filter(p=>!SESSION_IDS.includes(p.session) && p.session!=='afternoon')){const pt=programTimes(p);units.push({type:'single',start:pt.start,p});}
 for(const sid of SESSION_IDS){const ps=filteredOrdered.filter(p=>p.session===sid);if(ps.length){const d=sessionDef(sid);units.push({type:'session',start:d.start,sid,programs:ps});}}
 const afternoonPrograms=filteredOrdered.filter(p=>p.session==='afternoon');
 if(afternoonPrograms.length){
  const starts=afternoonPrograms.map(p=>timeNum(programTimes(p).start));
  units.push({type:'afternoon-group',start:programTimes(afternoonPrograms[0]).start,programs:afternoonPrograms,groupStart:Math.min(...starts)});
 }
 units.sort((a,b)=>timeNum(a.start)-timeNum(b.start)||String(a.sid||a.p?.id||a.type||'').localeCompare(String(b.sid||b.p?.id||b.type||'')));
 if(!units.length){
  byId('programList').innerHTML='<div class="notice-card">この学年に該当するプログラムは登録されていません。</div>';
  return;
 }
 byId('programList').innerHTML=units.map(unit=>{
  if(unit.type==='session'){
   const d=sessionDef(unit.sid);
   const statuses=unit.programs.map(programStatus);
   const st=statuses.some(x=>x.key==='live')?{key:'live',label:'発表中'}:(statuses.every(x=>x.key==='ended')?{key:'ended',label:'終了しました'}:{key:'upcoming',label:'発表予定'});
   const items=unit.programs.slice().sort((a,b)=>String(roomLabel(a)).localeCompare(String(roomLabel(b)))).map(p=>`<div class="session-program-item"><div class="session-program-main"><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong><div class="where">${esc(roomLabel(p))}</div>${reactionsHtml(p)}</div><button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div>`).join('');
   return `<details class="program-session-group ${st.key==='live'?'on':''}" ${st.key==='live'?'open':''}><summary class="program-session-summary"><span class="time">${esc(d.start)}</span><span class="session-summary-main"><strong>${esc(d.label)}</strong><span class="program-status status-${st.key}">${st.label}</span><span class="where">${esc(d.start)}〜${esc(d.end)}　${unit.programs.length}発表</span></span><span class="session-fold-icon" aria-hidden="true">⌄</span></summary><div class="session-program-items">${items}</div></details>`;
  }
  if(unit.type==='afternoon-group'){
   const ps=unit.programs.slice().sort((a,b)=>timeNum(programTimes(a).start)-timeNum(programTimes(b).start)||String(a.id).localeCompare(String(b.id)));
   const first=programTimes(ps[0]),last=programTimes(ps[ps.length-1]);
   const anyLive=ps.some(p=>programStatus(p).key==='live');
   const allEnded=ps.every(p=>programStatus(p).key==='ended');
   const st=anyLive?{key:'live',label:'発表中'}:(allEnded?{key:'ended',label:'終了しました'}:{key:'upcoming',label:'発表予定'});
   const items=ps.map(p=>{const pt=programTimes(p),pst=programStatus(p);return `<div class="session-program-item"><div class="session-program-main"><div class="afternoon-program-time">${esc(pt.start)}〜${esc(pt.end)} <span class="program-status status-${pst.key}">${pst.label}</span></div><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong><div class="where">${esc(roomLabel(p))}</div>${reactionsHtml(p)}</div><button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div>`}).join('');
   return `<details class="program-session-group afternoon-program-group ${st.key==='live'?'on':''}" ${st.key==='live'?'open':''}><summary class="program-session-summary"><span class="time">${esc(first.start)}</span><span class="session-summary-main"><strong>午後の有志発表</strong><span class="program-status status-${st.key}">${st.label}</span><span class="where">${esc(first.start)}〜${esc(last.end)}　${ps.length}発表</span></span><span class="session-fold-icon" aria-hidden="true">⌄</span></summary><div class="session-program-items">${items}</div></details>`;
  }
  const p=unit.p,pt=programTimes(p),st=programStatus(p);
  return `<div class="program-row ${st.key==='live'?'on':''}"><div class="time">${esc(pt.start)}</div><div><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong><span class="program-status status-${st.key}">${st.label}</span><div class="where">${esc(sessionLabel(p.session))}　${esc(pt.start)}〜${esc(pt.end)}　${esc(roomLabel(p))} <button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div></div></div>`;
 }).join('');
 $$('[data-see]').forEach(b=>b.onclick=()=>{
  if(!b.dataset.see)return;
  programReturnScrollY=window.scrollY;
  const z=getZone(b.dataset.see);if(!z)return;
  visitorBuilding=getMap(z.mapId).building;visitorSelected=z.id;session='current';
  setTab('venues',{scrollTop:false});
  requestAnimationFrame(()=>byId(`floor-${z.mapId}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
 });
}
function visibleMaps(){
 if(visitorBuilding==='campus')return MAPS.filter(m=>m.id==='campus');
 return MAPS.filter(m=>m.building===visitorBuilding).sort((a,b)=>b.floor-a.floor);
}
function renderBuildingTabs(){
 $$('#buildingTabs [data-building]').forEach(b=>{
  const active=b.dataset.building===visitorBuilding;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
}
$$('#buildingTabs [data-building]').forEach(b=>b.onclick=()=>{
 visitorBuilding=b.dataset.building;visitorSelected='';renderVisitorMap();
 byId('buildingTabs').scrollIntoView({behavior:'smooth',block:'start'});
});
byId('returnToProgram')?.addEventListener('click',()=>{
 setTab('program',{scrollTop:false});
 requestAnimationFrame(()=>window.scrollTo({top:programReturnScrollY||0,behavior:'smooth'}));
});
function renderSessionButtons(){
 const shortMarks={s1:'①',s2:'②',s3:'③',s4:'④'};
 const entries=[{id:'current',label:'現在',aria:'現在の時間帯'},...SESSION_IDS.map((id)=>{const d=sessionDef(id);return {id,label:`${shortMarks[id]}${d.start}〜${d.end}`,aria:`${sessionLabel(id)} ${d.start}〜${d.end}`}})];
 byId('sessionSwitch').innerHTML=entries.map(({id,label,aria})=>`<button data-session="${id}" class="${id===session?'active':''}" aria-pressed="${id===session}" aria-label="${esc(aria)}">${esc(label)}</button>`).join('');
 $$('[data-session]').forEach(b=>b.onclick=()=>{session=b.dataset.session;renderVisitorMap();});
}
function zStyle(z){return `left:${bound(z.x,0,100)}%;top:${bound(z.y,0,100)}%;width:${bound(z.w,.1,100)}%;height:${bound(z.h,.1,100)}%;`}
function zoneHtml(z,active,selected){const label=z.name||z.id;return `<button type="button" class="zone ${active?'on':''} ${selected?'selected':''}" style="${zStyle(z)}" data-zone="${esc(z.id)}" title="${esc(z.name)}" aria-label="${esc(z.name)}"><span class="zone-caption">${esc(label)}</span></button>`}
function floorLabel(m){return m.floor?`${m.floor}階`:'学校全体図'}
function floorDetailHtml(m){
 const z=getZone(visitorSelected);
 if(!z||z.mapId!==m.id)return '';
 let ps=state.programs.filter(p=>p.zoneId===z.id).slice();
 if(reactionPreviewMode&&reactionPreviewProgram?.zoneId===z.id&&!ps.some(p=>p.id===reactionPreviewProgram.id))ps.push(reactionPreviewProgram);
 ps.sort((a,b)=>timeNum(programTimes(a).start)-timeNum(programTimes(b).start)||timeNum(programTimes(a).end)-timeNum(programTimes(b).end)||String(a.id).localeCompare(String(b.id)));
 return `<h4>${esc(z.name)} <span class="pill">${esc(z.id)}</span></h4>${z.note?`<p>${esc(z.note)}</p>`:''}
 <p class="muted">${esc(m.name)}　登録されている発表：${ps.length}件</p>
 ${ps.length?`<div class="venue-program-list">${ps.map(p=>{const pt=programTimes(p),st=programStatus(p);return `<article class="venue-program-item status-border-${st.key}"><div class="venue-program-meta"><span class="program-status status-${st.key}">${st.label}</span><strong>${esc(sessionLabel(p.session))}</strong><span>${esc(pt.start)}〜${esc(pt.end)}</span></div><div class="venue-program-title">${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</div>${SESSION_IDS.includes(p.session)?reactionsHtml(p):''}</article>`}).join('')}</div>`:'<p>この会場のプログラムはまだ登録されていません。</p>'}`;
}
function updateSelectedFloorDetails(){
 $$('#visitorMaps [data-zone]').forEach(b=>{
  const selected=b.dataset.zone===visitorSelected;
  b.classList.toggle('selected',selected);
 });
 for(const m of visibleMaps()){
  const el=byId(`floor-detail-${m.id}`);if(!el)continue;
  const html=floorDetailHtml(m);
  el.hidden=!html;el.innerHTML=html;
 }
}
// Keep an entire floor map visible without an inner scrollbar at 100%.
// The source SVG proportions are fixed; using their natural aspect ratios also
// keeps all saved percentage-based clickable room coordinates aligned.
const FIT_MAP_RATIOS = {campus:602/1022, zenki1:782/742};
function baseMapWidth(mapId, win){
 const availableWidth=win.clientWidth;
 if(!availableWidth)return 0; // The venues page may currently be hidden.
 const aspect=FIT_MAP_RATIOS[mapId];
 if(!aspect)return availableWidth;
 const maxHeight=Math.min(window.innerHeight*.62,650);
 return Math.min(availableWidth,maxHeight*aspect);
}
function sizeFloorMap(mapId, focus){
 const win=byId(`window-${mapId}`),stage=byId(`stage-${mapId}`),out=byId(`zoom-${mapId}`);
 if(!win||!stage)return;
 const baseWidth=baseMapWidth(mapId,win);
 if(!baseWidth)return;
 const prevWidth=stage.getBoundingClientRect().width||baseWidth;
 const prevScrollLeft=win.scrollLeft,prevScrollTop=win.scrollTop;
 const rect=win.getBoundingClientRect();
 const fx=focus?.clientX??(rect.left+win.clientWidth/2);
 const fy=focus?.clientY??(rect.top+Math.min(win.clientHeight/2,130));
 const localX=fx-rect.left,localY=fy-rect.top;
 const newWidth=baseWidth*(visitorZoom[mapId]/100);
 // Scrollable only when enlarged. At default size there is NO internal scroll.
 win.classList.toggle('is-zoomed',visitorZoom[mapId]>100);
 stage.style.width=`${newWidth}px`;
 if(out)out.textContent=`${visitorZoom[mapId]}%`;
 if(visitorZoom[mapId]===100){win.scrollLeft=0;win.scrollTop=0;return;}
 const scale=newWidth/Math.max(prevWidth,1);
 win.scrollLeft=Math.max(0,(prevScrollLeft+localX)*scale-localX);
 win.scrollTop=Math.max(0,(prevScrollTop+localY)*scale-localY);
}
function updateFloorZoom(mapId, zoom, focus){
 const next=Math.round(bound(zoom,100,275));
 if(next===visitorZoom[mapId])return;
 visitorZoom[mapId]=next;
 sizeFloorMap(mapId,focus);
}
function sizeVisibleFloorMaps(){
 for(const m of visibleMaps())sizeFloorMap(m.id);
}
function enableMapPinch(){
 $$('#visitorMaps .floor-map-window').forEach(win=>{
  let gesture=null;
  const touchDistance=ts=>Math.hypot(ts[0].clientX-ts[1].clientX,ts[0].clientY-ts[1].clientY);
  const center=ts=>({clientX:(ts[0].clientX+ts[1].clientX)/2,clientY:(ts[0].clientY+ts[1].clientY)/2});
  win.addEventListener('touchstart',e=>{
   if(e.touches.length===2){gesture={distance:touchDistance(e.touches),zoom:visitorZoom[win.dataset.map]};}
  },{passive:true});
  win.addEventListener('touchmove',e=>{
   if(e.touches.length!==2||!gesture)return;
   e.preventDefault();
   updateFloorZoom(win.dataset.map,gesture.zoom*touchDistance(e.touches)/Math.max(gesture.distance,1),center(e.touches));
  },{passive:false});
  win.addEventListener('touchend',e=>{if(e.touches.length<2)gesture=null;},{passive:true});
  win.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
 });
}
function renderVisitorMap(){
 renderBuildingTabs();renderSessionButtons();
 const maps=visibleMaps();
 const programs=scheduledPrograms(),activeIds=new Set(programs.map(p=>p.zoneId).filter(Boolean));
 const count=state.zones.filter(z=>maps.some(m=>m.id===z.mapId)&&activeIds.has(z.id)).length;
 const buildingName={campus:'学校全体',zenki:'前期棟',koki:'後期棟'}[visitorBuilding];
 byId('mapSummary').textContent=session==='current'?`現在：${viewTime().time}　${buildingName}で使用中の会場：${count}か所`:`${sessionLabel(session)}（${sessionDef(session).start}〜${sessionDef(session).end}）　${buildingName}で使用する会場：${count}か所`;
 byId('visitorMaps').innerHTML=maps.map(m=>{
  const zones=state.zones.filter(z=>z.mapId===m.id),floorCount=zones.filter(z=>activeIds.has(z.id)).length;
  return `<article class="floor-card" id="floor-${esc(m.id)}">
   <div class="floor-card-header"><div><h3>${esc(floorLabel(m))}</h3><span class="floor-subtitle">${esc(m.name)}</span></div><span class="floor-count">${floorCount}か所 使用</span></div>
   <div class="floor-tools"><span>図を拡大して会場をタップ</span><div class="floor-zoom"><button type="button" data-zoom-map="${m.id}" data-zoom-action="out" aria-label="${esc(m.name)}を縮小">−</button><span id="zoom-${m.id}">${visitorZoom[m.id]}%</span><button type="button" data-zoom-map="${m.id}" data-zoom-action="in" aria-label="${esc(m.name)}を拡大">＋</button><button type="button" class="zoom-reset" data-zoom-map="${m.id}" data-zoom-action="reset">戻す</button></div></div>
   <div class="floor-map-window" id="window-${m.id}" data-map="${m.id}">
    <div class="map-stage" id="stage-${m.id}" style="width:${visitorZoom[m.id]}%">
     <img src="${esc(m.src)}" draggable="false" alt="${esc(m.name)}">
     <div class="map-zone-layer">${zones.map(z=>zoneHtml(z,activeIds.has(z.id),z.id===visitorSelected)).join('')}</div>
    </div>
   </div>
   <div class="floor-detail" id="floor-detail-${m.id}" hidden></div>
  </article>`;
 }).join('');
 byId('visitorMaps').querySelectorAll('[data-zone]').forEach(b=>b.addEventListener('click',()=>{
  visitorSelected=b.dataset.zone;
  updateSelectedFloorDetails();
  const detail=byId(`floor-detail-${getZone(visitorSelected)?.mapId}`);
  if(detail && !detail.hidden){detail.scrollIntoView({behavior:'smooth',block:'nearest'});}
 }));
 byId('visitorMaps').querySelectorAll('[data-zoom-map]').forEach(b=>b.addEventListener('click',()=>{
  const m=b.dataset.zoomMap,a=b.dataset.zoomAction;
  updateFloorZoom(m,a==='reset'?100:visitorZoom[m]+(a==='in'?25:-25));
 }));
 enableMapPinch();sizeVisibleFloorMaps();updateSelectedFloorDetails();
}
function stampList(){try{return JSON.parse(localStorage.getItem(STAMP_KEY)||'[]')}catch{return[]}}
function renderStamps(){const a=stampList();byId('stampProgress').textContent=`獲得スタンプ：${a.length} / 5`;
 byId('stampCards').innerHTML=[1,2,3,4,5].map(i=>`<div class="stamp-item ${a.includes(i)?'got':''}"><div class="star">⭐</div><b>STAMP ${i}</b><small>${a.includes(i)?'取得済み':'未取得'}</small></div>`).join('');}
function readStampFromUrl(){const v=new URLSearchParams(location.search).get('stamp'), n=Number(v);if(!Number.isInteger(n)||n<1||n>5)return;
 const current=stampList();if(!current.includes(n)){current.push(n);localStorage.setItem(STAMP_KEY,JSON.stringify(current));}
 renderStamps();setTab('stamp');}

// Ver.1.18: 午前は会場詳細と折りたたみ式プログラムの両方、午後はプログラム画面でリアクション。デモは公開前でもローカル操作確認可能。
const REACTION_KINDS=[['good','👍','よかった'],['aha','💡','なるほど'],['amazing','✨','すごい'],['fun','😊','楽しかった'],['cheer','🙌','応援したい']];
const reactionSelection={};
let currentReactionUid='';
function reactionEligibility(p){
 const reactionId=p.reactionId||p.id;
 if(reactionPreviewMode)return {active:true,preview:true,reason:'表示テスト中：アイコンを押すと選択・解除を試せます（Supabaseには保存しません）'};
 const pub=publishedState;
 const isPublished=!!pub?.programs?.some(x=>(x.reactionId||x.id)===reactionId);
 // Ver.1.13: デモデータは公開前でも操作感を確認できる。公開後は通常のSupabase保存へ自動的に切り替える。
 if(demoDraftPreview && String(p.id||'').startsWith('demo-') && !isPublished){
  return {active:true,preview:true,reason:'デモ操作：この端末だけで選択・解除を試せます。Supabaseへ公開すると、実際のリアクションとして保存・集計できます。'};
 }
 if(!pub||!pub.reactionDeadlineAt)return {active:false,reason:'リアクション準備中（管理者の公開待ち）'};
 if(!isPublished)return {active:false,reason:'この発表をSupabaseへ公開すると受付できます'};
 const deadline=new Date(pub.reactionDeadline+':00+09:00');
 if(!Number.isFinite(deadline.getTime()))return {active:false,reason:'受付終了日時が未設定です'};
 return Date.now()<deadline.getTime()?{active:true,preview:false,reason:''}:{active:false,reason:'リアクションの受付は終了しました'};
}
function reactionsHtml(p){
 const info=reactionEligibility(p);
 const reactionId=p.reactionId||p.id;
 const selected=reactionSelection[reactionId]||[];
 return `<div class="reactions-box ${info.preview?'reaction-preview':''}" data-reaction-box="${esc(reactionId)}"><div class="reactions-title">この発表にリアクション</div>
  <div class="reaction-choices">${REACTION_KINDS.map(([key,emoji,name])=>`<button type="button" title="${esc(name)}" aria-label="${esc(name)}" data-reaction-program="${esc(reactionId)}" data-reaction-kind="${key}" data-reaction-preview="${info.preview?'1':'0'}" class="reaction-choice ${selected.includes(key)?'is-selected':''}" aria-pressed="${selected.includes(key)}" ${info.active?'':'disabled'}><span aria-hidden="true">${emoji}</span></button>`).join('')}</div>
  <p class="reaction-hint" data-reaction-message="${esc(reactionId)}" role="status" ${info.reason?'':'hidden'}>${info.reason}</p></div>`;
}
function refreshReactionButtons(programId){
 const selected=reactionSelection[programId]||[];
 document.querySelectorAll('[data-reaction-program]').forEach(b=>{
  if(b.dataset.reactionProgram!==programId)return;
  const yes=selected.includes(b.dataset.reactionKind);
  b.classList.toggle('is-selected',yes);b.setAttribute('aria-pressed',String(yes));
 });
}
function reactionMessage(programId,text){
 document.querySelectorAll('[data-reaction-message]').forEach(el=>{if(el.dataset.reactionMessage!==programId)return;el.textContent=text;el.hidden=!text;});
}
window.addEventListener('ofes-reaction-selection',e=>{
 const {programId,selected,uid}=e.detail||{};
 if(!programId)return;
 if(uid&&uid!==currentReactionUid){currentReactionUid=uid;for(const k of Object.keys(reactionSelection))delete reactionSelection[k];}
 reactionSelection[programId]=Array.isArray(selected)?selected:[];
 refreshReactionButtons(programId);
});
window.addEventListener('ofes-reaction-notice',e=>{
 if(e.detail?.programId)reactionMessage(e.detail.programId,e.detail.message||'');
});
window.addEventListener('ofes-reaction-uid',e=>{
 const newUid=e.detail?.uid||'';
 if(currentReactionUid===newUid)return;
 currentReactionUid=newUid;for(const k of Object.keys(reactionSelection))delete reactionSelection[k];
 document.querySelectorAll('[data-reaction-program]').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});
});
for(const container of [byId('programList'),byId('visitorMaps')]){
 container.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-reaction-program]');
  if(!b||b.disabled)return;
  const programId=b.dataset.reactionProgram,kind=b.dataset.reactionKind;
  if(b.dataset.reactionPreview==='1'){
   const current=reactionSelection[programId]||[];
   reactionSelection[programId]=current.includes(kind)?current.filter(x=>x!==kind):[...current,kind];
   refreshReactionButtons(programId);
   reactionMessage(programId,reactionSelection[programId].length?`表示テスト：${reactionSelection[programId].length}種類を選択中。もう一度押すと取り消せます。`:'表示テスト：選択を取り消しました。');
   return;
  }
  if(!window.OFESReactions?.toggle)return reactionMessage(programId,'接続準備中です。少し待ってからお試しください。');
  await window.OFESReactions.toggle(programId,kind);
 });
}

function renderPublic(){renderHeader();renderProgram();renderVisitorMap();renderStamps();}

// 管理画面へのアクセスはブラウザ試作用の簡易パスワード。外部の書込権限には用いない。
byId('openAdmin').onclick=()=>{reactionPreviewMode=false;reactionPreviewProgram=null;byId('loginModal').hidden=false;byId('adminPassword').value='';byId('loginError').textContent='';byId('adminPassword').focus()};
byId('cancelLogin').onclick=()=>byId('loginModal').hidden=true;
byId('loginForm').onsubmit=e=>{e.preventDefault();if(byId('adminPassword').value!==DEMO_ADMIN_PASSWORD){byId('loginError').textContent='パスワードが違います。';return}
 byId('loginModal').hidden=true;switchDraft();byId('adminPanel').hidden=false;renderPublic();renderAdmin();};
byId('closeAdmin').onclick=()=>{byId('adminPanel').hidden=true;drawMode='';closeDraft()};
$$('#adminNav button').forEach(b=>b.onclick=()=>{const t=b.dataset.admin;$$('#adminNav button').forEach(x=>x.classList.toggle('active',x===b));$$('.admin-page').forEach(x=>x.classList.toggle('active',x.id===`admin-${t}`));if(t==='venues')renderEditor();if(t==='program')renderAdminPrograms();if(t==='basic')renderBasic();if(t==='notice')renderNotice();if(t==='stampqr')renderStampQrAdmin();});
function renderAdmin(){byId('adminMapSelect').innerHTML=MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');byId('adminMapSelect').value=adminMap;renderEditor();renderAdminPrograms();renderBasic();renderNotice();renderStampQrAdmin();}
byId('adminMapSelect').onchange=e=>{adminMap=e.target.value;editId='';editDraft=null;drawMode='';renderEditor()};
function renderEditor(){
 const m=getMap(adminMap);byId('adminMapSelect').value=adminMap;byId('adminMapImage').src=m.src;byId('adminMapImage').alt=m.name;
 const stage=byId('adminStage');stage.classList.toggle('drawing',Boolean(drawMode));
 byId('drawGuide').textContent=drawMode?`${drawMode==='new'?'新しい会場':'位置の再指定'}：図面上で教室の枠をドラッグして囲んでください。`:'登録済みの会場をタップすると、名前や位置を編集できます。';
 const zones=state.zones.filter(z=>z.mapId===adminMap);
 byId('adminZoneLayer').innerHTML=zones.map(z=>zoneHtml(z,false,z.id===editId)).join('')+(editDraft&&editDraft.mapId===adminMap&&!zones.some(z=>z.id===(editId||editDraft.id))?zoneHtml(editDraft,false,true):'');
 $$('#adminZoneLayer [data-zone]').forEach(el=>{el.onclick=()=>selectZone(el.dataset.zone);});
 byId('mapZoneList').innerHTML=zones.length?zones.map(z=>`<button type="button" class="${z.id===editId?'current':''}" data-list-zone="${esc(z.id)}"><b>${esc(z.name)}</b><small>${esc(z.id)}</small></button>`).join(''):'<p class="muted">まだ登録はありません。</p>';
 $$('[data-list-zone]').forEach(b=>b.onclick=()=>selectZone(b.dataset.listZone));
 renderEditForm();
}
function selectZone(id){const z=getZone(id);if(!z)return;drawMode='';editDraft=clone(z);editId=z.id;renderEditor()}
function renderEditForm(){const v=editDraft;
 byId('venueForm').hidden=!v;byId('emptyVenueNote').hidden=!!v;
 if(!v)return;
 byId('zoneId').value=v.id;byId('zoneName').value=v.name;byId('zoneNote').value=v.note||'';byId('zoneKind').value=v.kind||'classroom';
 for(const [k,el] of [['x','zoneX'],['y','zoneY'],['w','zoneW'],['h','zoneH']])byId(el).value=Number(v[k]).toFixed(1);
 byId('deleteVenue').disabled=!getZone(editId||v.id);
 byId('redrawVenue').disabled=false;
}
function newId(mapId){
 const map=getMap(mapId);let next=Math.max(1,Number(state.nextIds[mapId])||1),id='';
 do{id=map.prefix+'-'+String(next).padStart(2,'0');next++;}while(getZone(id));
 state.nextIds[mapId]=next;return id;
}
byId('newVenue').onclick=()=>{editId='';editDraft=null;drawMode='new';renderEditor()};
byId('redrawVenue').onclick=()=>{if(!editDraft){toast('先に会場を選んでください');return;}drawMode='redraw';renderEditor()};
byId('cancelDrawing').onclick=()=>{drawMode='';editDraft=null;editId='';renderEditor()};
const drawLayer=byId('drawLayer');
function pointOf(e){const box=byId('adminStage').getBoundingClientRect();return {x:bound((e.clientX-box.left)/box.width*100,0,100),y:bound((e.clientY-box.top)/box.height*100,0,100)}}
function rectFrom(a,b){let x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);return{x:+x.toFixed(2),y:+y.toFixed(2),w:+w.toFixed(2),h:+h.toFixed(2)}}
function drawPreview(rect){drawLayer.innerHTML=`<div class="draw-preview" style="${zStyle(rect)}"></div>`}
drawLayer.addEventListener('pointerdown',e=>{if(!drawMode)return;e.preventDefault();dragStart=pointOf(e);dragRect=null;drawLayer.setPointerCapture(e.pointerId);drawPreview({...dragStart,w:.1,h:.1});});
drawLayer.addEventListener('pointermove',e=>{if(!dragStart)return;e.preventDefault();dragRect=rectFrom(dragStart,pointOf(e));drawPreview(dragRect);});
function finishDraw(e){if(!dragStart)return;const r=rectFrom(dragStart,pointOf(e));dragStart=null;drawLayer.innerHTML='';if(r.w<.9||r.h<.9){toast('枠をもう少し大きくドラッグしてください');return}
 if(drawMode==='new'){editDraft={id:newId(adminMap),mapId:adminMap,name:'新しい会場',note:'',kind:'classroom',...r};editId='';}
 else if(drawMode==='redraw'&&editDraft){Object.assign(editDraft,r)}
 drawMode='';renderEditor();toast('位置を指定しました。会場名を入力して保存してください。');}
drawLayer.addEventListener('pointerup',finishDraw);
drawLayer.addEventListener('pointercancel',()=>{dragStart=null;drawLayer.innerHTML=''});
function normalizeZoneId(v){return String(v||'').trim().replace(/\s+/g,'-');}
function readVenueForm(){if(!editDraft)return null;
 const r={...editDraft,id:normalizeZoneId(byId('zoneId').value),name:byId('zoneName').value.trim(),note:byId('zoneNote').value.trim(),kind:byId('zoneKind').value};
 for(const [k,el] of [['x','zoneX'],['y','zoneY'],['w','zoneW'],['h','zoneH']])r[k]=bound(byId(el).value,k==='w'||k==='h'?.1:0,100);
 if(r.x+r.w>100)r.w=+(100-r.x).toFixed(2);if(r.y+r.h>100)r.h=+(100-r.y).toFixed(2);
 if(!r.id||!r.name||r.w<.1||r.h<.1)return null;return r;}
function saveVenueRecord(r){
 const oldId=editId||'';
 const duplicate=state.zones.find(z=>z.id===r.id && z.id!==oldId);
 if(duplicate){alert(`会場ID「${r.id}」はすでに「${duplicate.name}」で使用されています。別のIDを入力してください。`);return false;}
 if(oldId){
  const idx=state.zones.findIndex(z=>z.id===oldId);
  if(idx>=0)state.zones[idx]=r;else state.zones.push(r);
  if(oldId!==r.id)state.programs.forEach(p=>{if(p.zoneId===oldId)p.zoneId=r.id;});
 }else state.zones.push(r);
 return true;
}
byId('venueForm').onsubmit=e=>{e.preventDefault();const r=readVenueForm();if(!r){alert('会場ID・会場名と位置・サイズを確認してください。');return;}
 const oldId=editId;if(!saveVenueRecord(r))return;
 persist();editId=r.id;editDraft=clone(r);renderEditor();renderAdminPrograms();renderPublic();toast(oldId&&oldId!==r.id?`会場IDを ${oldId} → ${r.id} に変更しました`:`${r.name} を保存しました`);};
byId('deleteVenue').onclick=()=>{const z=getZone(editId||editDraft?.id);if(!z||!confirm(`「${z.name}」を削除しますか？この会場に割り当てられたプログラムの会場は未設定になります。`))return;
 state.zones=state.zones.filter(x=>x.id!==z.id);state.programs.forEach(p=>{if(p.zoneId===z.id)p.zoneId=''});editId='';editDraft=null;persist();renderEditor();renderAdminPrograms();renderPublic();toast('削除しました');};
for(const id of ['zoneX','zoneY','zoneW','zoneH'])byId(id).addEventListener('input',()=>{if(!editDraft)return;const r=readVenueForm();if(!r)return;Object.assign(editDraft,r);renderZoneGeometryOnly();});
byId('zoneId').addEventListener('input',()=>{if(!editDraft)return;const v=normalizeZoneId(byId('zoneId').value);byId('zoneId').value=v;});
function renderZoneGeometryOnly(){const layer=byId('adminZoneLayer');const active=layer.querySelector(`.zone.selected`);if(active&&editDraft)active.style.cssText=zStyle(editDraft);}
byId('attachDemo').onclick=()=>{const r=readVenueForm();if(!r)return alert('先に会場ID・会場名・位置を入力してください。');
 if(!saveVenueRecord(r))return;
 const real=sessionProgramsForVenue(r.id)[0]||null;
 const sid=real?.session||'s1',d=sessionDef(sid);
 reactionPreviewProgram=real?null:{id:`preview-${r.id}`,reactionId:`preview-${r.id}`,session:sid,start:d.start,end:d.end,grade:'テスト',group:'デモ班',title:'リアクション表示テスト',zoneId:r.id,_previewOnly:true};
 reactionPreviewMode=true;
 state.test.enabled=true;state.test.date=state.eventDate;state.test.time=d.start;
 persist();editId=r.id;editDraft=clone(r);
 visitorBuilding=getMap(r.mapId).building;visitorSelected=r.id;session='current';
 byId('adminPanel').hidden=true;
 renderPublic();setTab('venues',{scrollTop:false});
 requestAnimationFrame(()=>{const detail=byId(`floor-detail-${r.mapId}`);if(detail&&!detail.hidden)detail.scrollIntoView({behavior:'smooth',block:'center'});});
 toast(`${sessionLabel(sid)}のリアクション表示テストを開始しました`);
};

function roomOptions(sel){return `<option value="">（会場未登録）</option>`+state.zones.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(z=>`<option value="${esc(z.id)}" ${z.id===sel?'selected':''}>${esc(z.id)}｜${esc(z.name)}</option>`).join('')}
function sessionOptions(sel){return SESSION_IDS.map(id=>`<option value="${id}" ${id===sel?'selected':''}>${esc(sessionLabel(id))}（${esc(sessionDef(id).start)}〜${esc(sessionDef(id).end)}）</option>`).join('')}
function sessionProgramsForVenue(zoneId){return orderedPrograms().filter(p=>p.zoneId===zoneId&&SESSION_IDS.includes(p.session))}
function hasDuplicateVenueSession(program){return state.programs.some(p=>p.id!==program.id&&p.zoneId===program.zoneId&&p.session===program.session&&SESSION_IDS.includes(p.session))}
function renderAdminPrograms(){
 if(!adminProgramVenue || !state.zones.some(z=>z.id===adminProgramVenue))adminProgramVenue=state.zones[0]?.id||'';
 const selectedZone=getZone(adminProgramVenue);
 const venuePrograms=selectedZone?sessionProgramsForVenue(selectedZone.id):[];
 const unassigned=orderedPrograms().filter(p=>!p.zoneId&&SESSION_IDS.includes(p.session));
 const other=orderedPrograms().filter(p=>!SESSION_IDS.includes(p.session));
 byId('adminPrograms').innerHTML=`
 <div class="editor-card program-step-card"><div class="step-title"><span>1</span><div><h3>セッション①〜④の時間帯</h3><p class="muted">ここで設定した時間が、同じセッションを選んだすべての会場に共通で適用されます。</p></div></div>
 <div class="session-time-grid">${SESSION_IDS.map(id=>{const d=sessionDef(id);return `<div class="session-time-row" data-session-setting="${id}"><strong>${esc(d.label)}</strong><label>開始<input type="time" data-session-time="start" value="${esc(d.start)}"></label><label>終了<input type="time" data-session-time="end" value="${esc(d.end)}"></label></div>`}).join('')}</div></div>
 <div class="editor-card program-step-card"><div class="step-title"><span>2</span><div><h3>会場ごとの発表登録</h3><p class="muted">会場を選び、セッション・発表学年（複数可）・発表グループ・発表内容を登録します。開始・終了時刻は上の設定から自動で入ります。</p><p class="caption">発表学年は「7年生・8年生」「7・8年生」「6〜9年生」のように入力できます。学年欄を空欄にしたプログラムは全体行事として扱い、来場者がどの学年を選んでも表示します。</p></div></div>
 <label class="venue-program-selector">会場<select id="programVenueSelect">${state.zones.length?state.zones.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(z=>`<option value="${esc(z.id)}" ${z.id===adminProgramVenue?'selected':''}>${esc(z.id)}｜${esc(z.name)}</option>`).join(''):'<option value="">先に会場を登録してください</option>'}</select></label>
 <div class="venue-program-editor">${selectedZone?`<div class="venue-program-admin-heading"><strong>${esc(selectedZone.name)}</strong><span>${esc(selectedZone.id)}</span></div>${venuePrograms.length?venuePrograms.map(p=>adminVenueProgramRow(p)).join(''):'<p class="muted">この会場には、まだ発表が登録されていません。</p>'}<button type="button" id="addVenueProgram" class="btn light">＋ この会場に発表を登録</button>`:'<p class="muted">「会場・配置図」で会場を登録すると、ここから発表を追加できます。</p>'}</div></div>
 ${unassigned.length?`<div class="editor-card"><h3>会場未設定の発表</h3><p class="muted">旧バージョンから引き継いだ発表などです。会場を選択すると上の会場別登録へ移ります。</p><div class="legacy-program-list">${unassigned.map(p=>adminUnassignedRow(p)).join('')}</div></div>`:''}
 <details class="editor-card other-programs"><summary>開会行事・午後など、セッション以外の全体プログラム</summary><p class="muted">午後の体育館行事は「午後（プログラムでリアクション）」を選ぶと、来場者のプログラム画面にリアクションアイコンを表示します。</p><div class="admin-program-list">${other.map(p=>adminOtherProgramRow(p)).join('')}</div><div class="row-actions"><button type="button" id="addAfternoonProgram" class="btn light">＋ 午後プログラムを追加</button><button type="button" id="addOtherProgram" class="btn light">＋ その他の全体プログラムを追加</button></div></details>`;
 bindAdminProgramEvents();
}
function adminVenueProgramRow(p){return `<div class="venue-program-admin-row" data-program="${esc(p.id)}"><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年（複数可）<input data-vpfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" placeholder="例：A班・1班" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" placeholder="発表内容を入力" value="${esc(p.title)}"></label><div class="derived-time">${esc(programTimes(p).start)}〜${esc(programTimes(p).end)}</div><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
function adminUnassignedRow(p){return `<div class="venue-program-admin-row legacy" data-program="${esc(p.id)}"><label>会場<select data-vpfield="zoneId">${roomOptions('')}</select></label><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年<input data-vpfield="grade" maxlength="40" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" value="${esc(p.title)}"></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
function adminOtherProgramRow(p){return `<div class="admin-program-row whole-program-row" data-program="${esc(p.id)}"><label>区分<select data-opfield="session"><option value="afternoon" ${p.session==='afternoon'?'selected':''}>午後（リアクション対象）</option><option value="other" ${p.session!=='afternoon'?'selected':''}>その他（リアクションなし）</option></select></label><label>開始<input type="time" data-opfield="start" value="${esc(p.start)}"></label><label>終了<input type="time" data-opfield="end" value="${esc(p.end)}"></label><label>発表学年<input data-opfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>グループ<input data-opfield="group" maxlength="40" placeholder="例：合同A班" value="${esc(p.group||'')}"></label><label>内容<input data-opfield="title" maxlength="120" value="${esc(p.title)}"></label><label>会場<select data-opfield="zoneId">${roomOptions(p.zoneId)}</select></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
function demoVenuePool(){
 const excluded=/(廊下|階段|トイレ|便所|エレベーター|入口|玄関|駐車)/;
 const eligible=state.zones.filter(z=>!['building','parking'].includes(z.kind));
 const rank=Object.fromEntries(MAPS.map((m,i)=>[m.id,i]));
 const sortZones=a=>a.sort((x,y)=>(rank[x.mapId]??99)-(rank[y.mapId]??99)||String(x.id).localeCompare(String(y.id),'ja'));
 const classroom=sortZones(eligible.filter(z=>z.kind==='classroom'&&!excluded.test(z.name||'')));
 const exhibit=sortZones(eligible.filter(z=>z.kind==='exhibit'&&!excluded.test(z.name||'')));
 const other=sortZones(eligible.filter(z=>!['classroom','exhibit','hall'].includes(z.kind)&&!excluded.test(z.name||'')));
 const hall=sortZones(eligible.filter(z=>z.kind==='hall'&&!excluded.test(z.name||'')));
 const rest=sortZones(eligible.filter(z=>!classroom.includes(z)&&!exhibit.includes(z)&&!other.includes(z)&&!hall.includes(z)));
 return [...classroom,...exhibit,...other,...hall,...rest];
}
function demoRoomsForSession(pool,sid,sessionIndex){
 const occupied=new Set(state.programs.filter(p=>!String(p.id).startsWith('demo-')&&p.session===sid&&p.zoneId).map(p=>p.zoneId));
 let available=pool.filter(z=>!occupied.has(z.id));
 if(!available.length)return [];
 // 午前のデモでは体育館を避け、教室・展示会場を優先する。4会場に足りない場合だけホールを補う。
 const noHall=available.filter(z=>z.kind!=='hall');
 if(noHall.length>=4)available=noHall;
 const picked=[];
 const offset=(sessionIndex*4)%available.length;
 for(let i=0;i<available.length&&picked.length<4;i++){
  const z=available[(offset+i)%available.length];
  if(!picked.some(x=>x.id===z.id))picked.push(z);
 }
 return picked;
}
function demoHallZoneId(pool){
 const named=pool.find(z=>/(体育館|アリーナ|講堂|ホール)/.test(z.name||''));
 const hall=named||pool.find(z=>z.kind==='hall');
 if(hall)return hall.id;
 if(!pool.length)return '';
 return pool.slice().sort((a,b)=>(Number(b.w||0)*Number(b.h||0))-(Number(a.w||0)*Number(a.h||0)))[0].id;
}
function demoProgramRows(){
 const pool=demoVenuePool();
 if(!pool.length)return [];
 // 2025年度プログラムのセッション構成を参考にした試作用データ。
 // 発表内容と会場はデモ用に再構成し、最大4会場×4セッションで1〜9年生を確認できるようにする。
 const plan={
  s1:[
   {grade:'1年生',group:'A班',title:'学校のすてきを見つけよう'},
   {grade:'4年生',group:'A班',title:'大豊町の自然を調べよう'},
   {grade:'6年生',group:'A班',title:'地域の魅力を伝えよう'},
   {grade:'9年生',group:'A班',title:'未来の大豊町を考える'}
  ],
  s2:[
   {grade:'3年生',group:'A班',title:'町たんけんで見つけたこと'},
   {grade:'6年生',group:'B班',title:'大豊町の課題とこれから'},
   {grade:'7年生',group:'A班',title:'ふるさと大豊の魅力'},
   {grade:'9年生',group:'B班',title:'地域を元気にするアイデア'}
  ],
  s3:[
   {grade:'2年生',group:'A班',title:'大豊町のすてきな場所'},
   {grade:'5年生',group:'A班',title:'大豊町の産業を調べよう'},
   {grade:'8年生',group:'A班',title:'探究学習の成果発表'},
   {grade:'7年生・8年生',group:'合同A班',title:'大豊町の魅力を未来へ'}
  ],
  s4:[
   {grade:'2年生',group:'B班',title:'地域の人に聞いてみよう'},
   {grade:'4年生',group:'B班',title:'大豊町の文化を伝えよう'},
   {grade:'5年生',group:'B班',title:'地域を支える仕事'},
   {grade:'8年生',group:'B班',title:'私たちが考える大豊町の未来'}
  ]
 };
 const rows=[];
 SESSION_IDS.forEach((sid,sessionIndex)=>{
  const rooms=demoRoomsForSession(pool,sid,sessionIndex);
  const d=sessionDef(sid);
  rooms.forEach((room,roomIndex)=>{
   const item=plan[sid][roomIndex];
   rows.push({
    id:`demo-${sid}-${roomIndex+1}`,reactionId:'',session:sid,start:d.start,end:d.end,
    grade:item.grade,group:item.group,title:item.title,zoneId:room.id
   });
  });
 });
 return rows;
}
function demoWholeProgramRows(){
 const pool=demoVenuePool();
 const hall=demoHallZoneId(pool);
 const r=(id,session,start,end,grade,group,title,zoneId='')=>({id:`demo-${id}`,reactionId:'',session,start,end,grade,group,title,zoneId});
 return [
  r('opening','other','08:45','09:05','','','開会行事',hall),
  r('attraction','other','09:05','09:20','','','アトラクション',hall),
  r('zenki-choir','other','11:25','11:40','1年生・2年生・3年生・4年生・5年生','','前期合唱「大豊の四季」',hall),
  r('review','other','11:40','11:50','','','午前の部 講評',hall),
  r('lunch','other','11:50','12:40','','','昼休み・スライド上映',hall),
  r('pm-open','other','12:40','12:43','5年生','','午後の部 開始のあいさつ',hall),
  r('pm01','afternoon','12:43','12:53','4年生','演舞チーム','演舞「寺内太刀踊り」',hall),
  r('pm02','afternoon','12:53','13:00','6年生・7年生・8年生・9年生','後期生徒','後期合唱「ふるさと」',hall),
  r('prep01','other','13:00','13:10','','','幕間・ステージ準備',hall),
  r('pm03','afternoon','13:10','13:17','','音楽クラブ','器楽合奏「残酷な大豊のテーゼ」',hall),
  r('prep02','other','13:17','13:32','','','幕間・ステージ準備',hall),
  r('pm04','afternoon','13:32','13:38','8年生','英語発表チーム','英語発表「My Neighbor Totoro」',hall),
  r('pm05','afternoon','13:38','13:44','8年生','ダンスチーム','ダンス「HIP」',hall),
  r('pm06','afternoon','13:44','13:50','8年生','歌チーム','歌「地球儀」',hall),
  r('pm07','afternoon','13:50','13:56','7年生・9年生','合同ステージ','歌・ダンス「スキスキ星人」',hall),
  r('pm-pta','afternoon','13:56','14:02','','PTAバンド','PTAバンド演奏「大豊のゆず」',hall),
  r('pm08','afternoon','14:02','14:08','6年生・7年生','合同ステージ','演奏・ダンス「Magnetic」',hall),
  r('pm09','afternoon','14:08','14:14','7年生・8年生・9年生','合同ステージ','劇・ダンス「アン・・・マン」',hall),
  r('pm10','afternoon','14:14','14:20','9年生','サックスチーム','サックス演奏「情熱大陸」',hall),
  r('prep03','other','14:20','14:30','','','幕間・ステージ準備',hall),
  r('pm11','afternoon','14:30','14:50','','吹奏楽部','吹奏楽メドレー',hall),
  r('closing','other','14:50','15:00','','','閉会行事',hall)
 ];
}
function addDemoPrograms(){
 if(!state.zones.length){alert('先に「会場・配置図」で1か所以上の会場を登録してください。');return;}
 const morning=demoProgramRows();
 if(!morning.length){alert('デモ発表を置ける会場がありません。');return;}
 const whole=demoWholeProgramRows();
 // 以前のデモだけを入れ替える。本番データには触れない。
 state.programs=state.programs.filter(p=>!String(p.id).startsWith('demo-'));
 // 初期状態の仮プログラムが未編集のまま残っている場合だけ除き、デモ表示を分かりやすくする。
 state.programs=state.programs.filter(p=>!(p.id==='p1'&&p.session==='other'&&p.title==='開会行事・アトラクション')&&!(p.id==='p6'&&p.session==='afternoon'&&p.title==='午後のステージ発表（仮）'));
 state.programs.push(...morning,...whole);
 if(morning[0]?.zoneId){
  adminProgramVenue=morning[0].zoneId;
  const firstZone=getZone(morning[0].zoneId);
  if(firstZone)visitorBuilding=getMap(firstZone.mapId).building;
 }
 // 登録直後に場所の反映を確認しやすいよう、同じ端末では下書きを公開画面へ即時プレビューする。
 demoDraftPreview=true;session='s1';visitorSelected='';state=draftState;
 persist();renderAdminPrograms();renderPublic();
 const afternoonCount=whole.filter(p=>p.session==='afternoon').length;
 const msg=byId('demoDataMessage');if(msg)msg.textContent=`2025年度プログラムの流れを参考に、午前${morning.length}件（最大4会場×4セッション）と午後${afternoonCount}件のリアクション対象ステージを含むデモデータを登録しました。1〜9年生、複数グループ、合同発表を確認できます。この端末では会場案内に即時反映されます。`;
 toast('2025年度プログラム参考のデモデータを登録しました');
}
function removeDemoPrograms(){
 const n=state.programs.filter(p=>String(p.id).startsWith('demo-')).length;
 if(!n){const msg=byId('demoDataMessage');if(msg)msg.textContent='削除するデモデータはありません。';return;}
 if(!confirm(`デモ用プログラム${n}件を下書きから削除します。実際に登録した会場や本番プログラムは削除しません。よろしいですか？`))return;
 state.programs=state.programs.filter(p=>!String(p.id).startsWith('demo-'));
 demoDraftPreview=true;state=draftState;
 persist();renderAdminPrograms();renderPublic();
 const msg=byId('demoDataMessage');if(msg)msg.textContent='デモ用プログラムを削除しました。この端末の会場案内にも即時反映しています。Supabaseへ公開済みの場合は、再度公開すると他端末からも消えます。';
 toast('デモデータを削除しました');
}
function bindAdminProgramEvents(){
 $$('[data-session-setting]').forEach(row=>row.querySelectorAll('[data-session-time]').forEach(input=>input.addEventListener('change',()=>{const id=row.dataset.sessionSetting,start=row.querySelector('[data-session-time="start"]').value,end=row.querySelector('[data-session-time="end"]').value;if(!start||!end||timeNum(start)>=timeNum(end)){alert('開始時刻より後に終了時刻を設定してください。');renderAdminPrograms();return;}state.sessions[id]={...state.sessions[id],label:DEFAULT_SESSIONS[id].label,start,end};syncSessionProgramTimes();persist();renderAdminPrograms();renderPublic();toast(`${sessionLabel(id)}の時間を保存しました`)})));
 byId('programVenueSelect')?.addEventListener('change',e=>{adminProgramVenue=e.target.value;renderAdminPrograms()});
 $$('[data-vpfield]').forEach(el=>el.addEventListener('change',e=>{const row=e.target.closest('[data-program]'),p=state.programs.find(x=>x.id===row.dataset.program);if(!p)return;const field=e.target.dataset.vpfield,old=p[field];p[field]=e.target.value;if(field==='session'){const d=sessionDef(p.session);p.start=d.start;p.end=d.end;}if(hasDuplicateVenueSession(p)){alert('同じ会場の同じセッションには、すでに別の発表が登録されています。');p[field]=old;renderAdminPrograms();return;}if(field==='zoneId'&&p.zoneId)adminProgramVenue=p.zoneId;persist();renderAdminPrograms();renderPublic();toast('発表内容を保存しました')}));
 $$('[data-opfield]').forEach(el=>el.addEventListener('change',e=>{const row=e.target.closest('[data-program]'),p=state.programs.find(x=>x.id===row.dataset.program);if(!p)return;p[e.target.dataset.opfield]=e.target.value;persist();renderPublic();toast('全体プログラムを保存しました')}));
 $$('[data-del-program]').forEach(el=>el.onclick=()=>{if(!confirm('この発表を削除しますか？'))return;state.programs=state.programs.filter(p=>p.id!==el.dataset.delProgram);persist();renderAdminPrograms();renderPublic()});
 byId('addVenueProgram')?.addEventListener('click',()=>{if(!adminProgramVenue)return;const used=new Set(sessionProgramsForVenue(adminProgramVenue).map(p=>p.session));const sid=SESSION_IDS.find(id=>!used.has(id));if(!sid){alert('この会場にはセッション①〜④がすべて登録されています。');return;}const d=sessionDef(sid);state.programs.push({id:'p'+Date.now(),reactionId:'',session:sid,start:d.start,end:d.end,grade:'',group:'',title:'',zoneId:adminProgramVenue});persist();renderAdminPrograms();renderPublic();toast(`${sessionLabel(sid)}の入力欄を追加しました`)});
 byId('addAfternoonProgram')?.addEventListener('click',()=>{state.programs.push({id:'p'+Date.now(),reactionId:'',session:'afternoon',start:'13:00',end:'13:20',grade:'',group:'',title:'新しい午後プログラム',zoneId:''});persist();renderAdminPrograms();renderPublic();toast('午後プログラムを追加しました')});
 byId('addOtherProgram')?.addEventListener('click',()=>{state.programs.push({id:'p'+Date.now(),reactionId:'',session:'other',start:'08:30',end:'08:50',grade:'',group:'',title:'新しい全体プログラム',zoneId:''});persist();renderAdminPrograms();renderPublic();toast('全体プログラムを追加しました')});
 byId('addDemoData')?.addEventListener('click',addDemoPrograms);
 byId('removeDemoData')?.addEventListener('click',removeDemoPrograms);
}
function renderBasic(){byId('settingYear').value=state.year;byId('settingDate').value=state.eventDate;byId('settingSlogan').value=state.slogan;byId('reactionDeadline').value=state.reactionDeadline||state.eventDate+'T17:00';
 byId('testEnabled').checked=!!state.test.enabled;byId('testDate').value=state.test.date;byId('testTime').value=state.test.time;byId('testSlider').value=timeNum(state.test.time);byId('testTimeText').textContent=state.test.time;}
byId('saveBasic').onclick=()=>{const year=byId('settingYear').value.trim(),date=byId('settingDate').value;if(!year||!date)return alert('年度と開催日を入力してください');
 const oldDate=state.eventDate;const deadline=byId('reactionDeadline').value;if(!deadline)return alert('リアクションの受付終了日時を入力してください');
 state.year=year;state.eventDate=date;state.slogan=byId('settingSlogan').value.trim();state.reactionDeadline=oldDate!==date&&deadline.startsWith(oldDate+'T')?date+deadline.slice(10):deadline;byId('reactionDeadline').value=state.reactionDeadline;persist();renderPublic();toast('年度設定を保存しました');};
function updateTest(){state.test.enabled=byId('testEnabled').checked;state.test.date=byId('testDate').value||state.eventDate;state.test.time=byId('testTime').value||'09:25';
 byId('testTimeText').textContent=state.test.time;byId('testSlider').value=timeNum(state.test.time);persist();renderPublic();}
byId('testEnabled').onchange=updateTest;byId('testDate').onchange=updateTest;byId('testTime').oninput=updateTest;
byId('testSlider').oninput=e=>{const n=Number(e.target.value);byId('testTime').value=`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;byId('testEnabled').checked=true;updateTest();};
$$('[data-quick]').forEach(b=>b.onclick=()=>{byId('testTime').value=b.dataset.quick;byId('testDate').value=state.eventDate;byId('testEnabled').checked=true;updateTest();});

function appPublicUrl(){
 const here=(location.protocol==='http:'||location.protocol==='https:')?location.origin+location.pathname:STAMP_BASE_URL;
 return here.endsWith('/')?here:here.replace(/\/[^/]*$/,'/');
}
function renderNotice(){
 byId('noticeTitle').value=state.noticeTitle||DEFAULT_DATA.noticeTitle;
 byId('noticeMessage').value=state.noticeMessage||DEFAULT_DATA.noticeMessage;
 byId('noticeIssuer').value=state.noticeIssuer||DEFAULT_DATA.noticeIssuer;
 byId('noticeAppUrl').textContent=appPublicUrl();
}
byId('saveNotice').onclick=()=>{
 state.noticeTitle=byId('noticeTitle').value.trim()||DEFAULT_DATA.noticeTitle;
 state.noticeMessage=byId('noticeMessage').value.trim()||DEFAULT_DATA.noticeMessage;
 state.noticeIssuer=byId('noticeIssuer').value.trim()||DEFAULT_DATA.noticeIssuer;
 persist();toast('保護者向け案内文を保存しました');
};
function stampFixedUrl(i){return `${STAMP_BASE_URL}?stamp=${i}`;}
function stampQrAsset(i){return new URL(`assets/stamp-qr/stamp-${i}.svg`,location.href).href;}
function renderStampQrAdmin(){
 const grid=byId('stampQrAdminGrid');if(!grid)return;
 grid.innerHTML=[1,2,3,4,5].map(i=>`<article class="stamp-qr-preview"><div class="stamp-qr-preview-head"><strong>スタンプ${'①②③④⑤'[i-1]}</strong><span>STAMP ${i}</span></div><img src="${stampQrAsset(i)}" alt="スタンプ${i} QRコード"><code>${esc(stampFixedUrl(i))}</code></article>`).join('');
}
function openStampQrPrint(mode){
 const logo=new URL('assets/ofes-logo.png',location.href).href;
 const cards=[1,2,3,4,5].map(i=>({i,url:stampFixedUrl(i),qr:stampQrAsset(i),circle:'①②③④⑤'[i-1]}));
 const w=window.open('','OFES_STAMP_QR_PDF','width=1000,height=1000');
 if(!w){alert('印刷画面を開けませんでした。ポップアップを許可してください。');return;}
 const isPoster=mode==='poster';
 const body=isPoster?cards.map(c=>`<section class="poster-page"><div class="brand"><img src="${logo}" alt="OFES"><div><b>OFES スタンプラリー</b><span>おおフェス</span></div></div><div class="stamp-no">スタンプ ${c.circle}</div><p class="lead">QRコードを読み取って<br><strong>スタンプGET！</strong></p><img class="qr poster-qr" src="${c.qr}" alt="スタンプ${c.i} QRコード"><div class="stamp-label">STAMP ${c.i}</div><div class="url">${esc(c.url)}</div><p class="foot">このQRコードは翌年度以降も同じものを使用できます。</p></section>`).join(''):
 `<section class="sheet-page"><div class="sheet-title"><img src="${logo}" alt="OFES"><div><h1>OFES スタンプラリー QRコード一覧</h1><p>学校用・管理保管用 / 毎年同じQRコードを使用できます。</p></div></div><div class="sheet-grid">${cards.map(c=>`<article class="sheet-card"><div class="sheet-stamp">スタンプ ${c.circle}</div><img class="qr sheet-qr" src="${c.qr}" alt="スタンプ${c.i} QRコード"><b>STAMP ${c.i}</b><div class="url">${esc(c.url)}</div></article>`).join('')}</div><p class="sheet-note">印刷したQRコードを校内5か所に掲示してください。URLは https://otoyoacademy.github.io/Ofes/ に固定されています。</p></section>`;
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>OFES スタンプラリーQRコード</title><style>
 @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:#172019;background:#fff}.printbar{position:fixed;right:12px;top:12px;z-index:20}.printbar button{font-size:15px;padding:10px 16px;border:1px solid #bbb;border-radius:8px;background:#fff}.poster-page{height:273mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;page-break-after:always;padding:6mm 8mm}.poster-page:last-child{page-break-after:auto}.brand{align-self:flex-start;display:flex;align-items:center;gap:8px;text-align:left}.brand img{width:22mm;height:22mm;object-fit:contain}.brand b{display:block;font-size:15pt}.brand span{font-size:10pt;color:#526058}.stamp-no{margin-top:12mm;font-size:30pt;font-weight:900;color:#197a4b}.lead{font-size:20pt;line-height:1.45;margin:7mm 0 5mm}.lead strong{font-size:28pt}.qr{object-fit:contain;background:#fff}.poster-qr{width:112mm;height:112mm}.stamp-label{font-size:20pt;font-weight:900;letter-spacing:.08em;margin-top:4mm}.url{font-size:8pt;word-break:break-all;color:#59675c;margin-top:3mm}.foot{margin-top:auto;font-size:9pt;color:#526058}.sheet-page{padding:2mm 1mm}.sheet-title{display:flex;align-items:center;gap:10px;border-bottom:2px solid #197a4b;padding-bottom:4mm;margin-bottom:5mm}.sheet-title img{width:20mm;height:20mm;object-fit:contain}.sheet-title h1{font-size:18pt;margin:0}.sheet-title p{margin:1mm 0 0;color:#526058;font-size:9.5pt}.sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.sheet-card{border:1px solid #cfd9d0;border-radius:10px;padding:4mm;text-align:center;min-height:76mm}.sheet-stamp{font-size:15pt;font-weight:850;color:#197a4b}.sheet-qr{width:45mm;height:45mm;display:block;margin:2mm auto}.sheet-card b{display:block;font-size:11pt}.sheet-card .url{font-size:6.5pt}.sheet-note{font-size:8.5pt;color:#526058;margin-top:4mm}@media print{.printbar{display:none}}
 </style></head><body><div class="printbar"><button onclick="window.print()">印刷／PDFとして保存</button></div>${body}</body></html>`;
 w.document.open();w.document.write(html);w.document.close();
}
byId('printStampPosters').onclick=()=>openStampQrPrint('poster');
byId('printStampSheet').onclick=()=>openStampQrPrint('sheet');
function jpEventDate(iso){try{const d=new Date(iso+'T00:00:00');return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`;}catch(e){return iso}}
function nl2brText(v){return esc(v).replace(/\n/g,'<br>')}
byId('printNotice').onclick=()=>{
 byId('saveNotice').click();
 const url=appPublicUrl();
 const qr=new URL('assets/app-qr.png',location.href).href;
 const logo=new URL('assets/ofes-logo.png',location.href).href;
 const w=window.open('','OFES_NOTICE_PDF','width=900,height=1000');
 if(!w){alert('印刷画面を開けませんでした。ポップアップを許可してください。');return;}
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(state.noticeTitle)}</title><style>
 @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:#172019;margin:0;font-size:11.2pt;line-height:1.55}h1{font-size:20pt;margin:0 0 5mm;text-align:center}h2{font-size:13.5pt;margin:4mm 0 2mm;border-left:5px solid #197a4b;padding-left:8px}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #197a4b;padding-bottom:4mm;margin-bottom:4mm}.brand{display:flex;align-items:center;gap:10px}.brand img{width:18mm;height:18mm;object-fit:contain}.meta{text-align:right;font-size:9.5pt}.message{background:#f5f8f4;border:1px solid #cfd9d0;border-radius:8px;padding:4mm;margin:3mm 0}.main-grid{display:grid;grid-template-columns:1.6fr .8fr;gap:5mm;align-items:start}.qrbox{text-align:center;border:1px solid #cfd9d0;border-radius:10px;padding:4mm}.qrbox img{width:36mm;height:36mm}.url{font-size:7.5pt;word-break:break-all}.features{margin:1mm 0 0;padding-left:5mm}.features li{margin:1.2mm 0}.install{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.install>div{border:1px solid #cfd9d0;border-radius:8px;padding:3mm}.install ol{margin:1mm 0 0;padding-left:6mm}.note{font-size:8.6pt;color:#526058;margin-top:4mm;border-top:1px solid #d8ddd8;padding-top:3mm}.issuer{text-align:right;margin-top:3mm;font-weight:700}@media print{.printbar{display:none}}.printbar{position:fixed;right:12px;top:12px}.printbar button{font-size:16px;padding:10px 18px}
 </style></head><body><div class="printbar"><button onclick="window.print()">印刷／PDFとして保存</button></div>
 <div class="top"><div class="brand"><img src="${logo}"><div><strong>OFES - おおフェス</strong><div>保護者の皆様へ</div></div></div><div class="meta">開催日：${jpEventDate(state.eventDate)}<br>${esc(state.noticeIssuer)}</div></div>
 <h1>${esc(state.noticeTitle)}</h1><div class="message">${nl2brText(state.noticeMessage)}</div>
 <div class="main-grid"><div><h2>OFESアプリでできること</h2><ul class="features"><li><strong>プログラム：</strong>発表時間・発表内容・会場を確認できます。</li><li><strong>会場案内：</strong>学校全体図、前期棟、後期棟から会場を確認できます。</li><li><strong>スタンプラリー：</strong>校内5か所のQRコードを読み取って楽しめます。</li><li><strong>リアクション：</strong>発表への感想を5種類のボタンで届けられます。</li></ul><p><strong>今年度のスローガン：</strong>${esc(state.slogan)}</p></div><div class="qrbox"><strong>OFESはこちら</strong><br><img src="${qr}" alt="OFES QRコード"><div class="url">${esc(url)}</div><small>カメラでQRコードを読み取ってください。</small></div></div>
 <h2>スマートフォンのホーム画面に追加する方法</h2><div class="install"><div><strong>iPhone（Safari）</strong><ol><li>QRコードからOFESをSafariで開く</li><li>画面下の「共有」ボタン（□に↑）をタップ</li><li>「ホーム画面に追加」を選ぶ</li><li>「追加」をタップ</li></ol></div><div><strong>Android（Chrome）</strong><ol><li>QRコードからOFESをChromeで開く</li><li>右上の「︙」メニューをタップ</li><li>「ホーム画面に追加」または「アプリをインストール」を選ぶ</li><li>画面の案内に従って追加する</li></ol></div></div>
 <div class="note">※ OFESはWebアプリです。通常の閲覧にはログインは必要ありません。表示にはインターネット接続が必要です。端末やOSのバージョンにより、メニュー名や表示位置が異なる場合があります。</div><div class="issuer">${esc(state.noticeIssuer)}</div>
 </body></html>`;
 w.document.open();w.document.write(html);w.document.close();
};

byId('exportJson').onclick=()=>{const blob=new Blob([JSON.stringify({version:14,data:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`OFES_${state.year}_backup.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);};
byId('importJson').onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 const status=byId('importJsonStatus');
 try{
  const parsed=JSON.parse(await f.text());
  const next=validData(parsed.data||parsed);
  if(!confirm('現在の設定を読み込んだデータで置き換えますか？')){
   if(status){status.className='cloud-state warning';status.textContent='JSONの読み込みをキャンセルしました。現在の下書きは変更していません。';}
   return;
  }
  // 読み込みデータを「編集用の下書き」として明示的に採用する。
  draftState=clone(next);
  state=draftState;
  editorActive=true;
  hasLegacyDraft=true;
  if(!persist())throw Error('ブラウザへの保存に失敗しました');
  adminMap='campus';editId='';editDraft=null;adminProgramVenue='';
  renderAdmin();renderPublic();
  if(status){
   status.className='cloud-state';
   status.textContent=`読み込み完了：${f.name} ／ 会場${state.zones.length}件 ／ プログラム${state.programs.length}件。内容を確認後、「Supabaseへ公開」を押してください。`;
  }
  toast(`JSONを読み込みました（会場${state.zones.length}件・プログラム${state.programs.length}件）`);
 }catch(error){
  console.error(error);
  if(status){status.className='cloud-state warning';status.textContent=`読み込みに失敗しました：${f.name}。JSON形式またはデータ内容を確認してください。`;}
  alert('JSON形式またはデータ内容を確認してください。');
 }finally{
  // 同じJSONを再選択して検証できるよう、ファイル入力だけをリセットする。
  e.target.value='';
 }
};
byId('resetAll').onclick=()=>{if(!confirm('このブラウザに保存した会場・プログラムなどの下書きデータをすべて初期化しますか？'))return;state=clone(DEFAULT_DATA);draftState=state;persist();adminMap='campus';editId='';editDraft=null;adminProgramVenue='';renderAdmin();renderPublic();toast('初期化しました')};
renderPublic();readStampFromUrl();
// 外部SDKが読み込めない場合も、接続タブで理由が分かるようにする。
setTimeout(()=>{
 const node=byId('firebaseSdkStatus');
 if(node && node.textContent.includes('読み込み中')){
   node.textContent='SDKを読み込めませんでした';
   byId('firebaseAuthStatus').textContent='利用不可';
   byId('firebaseAuthMessage').textContent='通信環境を確認し、GitHub Pages（https://）で開いてください。ローカルファイルからは認証できません。';
 }
},16000);
window.addEventListener('resize',()=>{if($('#tab-venues').classList.contains('active'))sizeVisibleFloorMaps();});
setInterval(()=>{if(!state.test.enabled){renderHeader();renderProgram();if($('#tab-venues').classList.contains('active'))renderVisitorMap();}},30000);
