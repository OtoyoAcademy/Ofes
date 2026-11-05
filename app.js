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
const ACCESS_MODE_KEY='ofes-access-mode-v127';
// 試作版の画面ロックのみ。Supabaseの安全な認証には使用しない。
const DEMO_ADMIN_PASSWORD='ofes0034';
const SESSION_IDS=['s1','s2','s3','s4'];
const DEFAULT_SESSIONS={
 s1:{label:'セッション①',start:'09:20',end:'09:40'},
 s2:{label:'セッション②',start:'09:50',end:'10:10'},
 s3:{label:'セッション③',start:'10:20',end:'10:40'},
 s4:{label:'セッション④',start:'10:50',end:'11:10'}
};
const SAFETY_TYPES={
 extinguisher:{label:'消火器',icon:'🧯'},
 exit:{label:'非常口',icon:'EXIT'},
 aed:{label:'AED',icon:'AED'},
 assembly:{label:'避難集合場所',icon:'集合'}
};
const DEFAULT_DATA = {
 year:'2026', eventDate:'2026-11-21', slogan:'挑戦・協働・創造', reactionDeadline:'2026-11-21T17:00',
 campusCanvasVersion:3,
 noticeTitle:'おおフェス（OFES）Webアプリのご案内',
 noticeMessage:'今年度のおおフェスでは、プログラムや会場案内などをスマートフォンで確認できるWebアプリ「OFES」をご利用いただけます。会場での移動や発表見学に、ぜひご活用ください。',
 noticeIssuer:'大豊学園',
 internalPasscode:'', stampCompleteImage:'', stampHints:['','','','',''], surveys:[],
 test:{enabled:false,date:'2026-11-21',time:'09:25'},
 sessions:JSON.parse(JSON.stringify(DEFAULT_SESSIONS)),
 zones:[],safetyItems:[],nextSafetyId:1,nextIds:{campus:1,zenki1:1,zenki2:1,koki1:1,koki2:1,koki3:1},
 programs:[
  {id:'p1',session:'other',start:'08:45',end:'09:05',grade:'',group:'',title:'開会行事・アトラクション',zoneId:'',presenters:''},
  {id:'p6',session:'afternoon',start:'13:32',end:'13:38',grade:'',group:'',title:'午後のステージ発表（仮）',zoneId:'',presenters:''}
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
const CAMPUS_CANVAS_SCALE=0.849825378346915;
const CAMPUS_CANVAS_OFFSET=7.508731082654249;
// Ver.1.29: 学校全体図の上下余白を15%→22%へ拡張。
// 既存の会場・安全情報は、図面本体に対する位置を保ったまま自動移行する。
const CAMPUS_ASPECT_H=1022/602;
const CAMPUS_OLD_PAD=0.15;
const CAMPUS_NEW_PAD=0.22;
function campusYFromLegacy(y){return CAMPUS_CANVAS_OFFSET+bound(y,0,100)*CAMPUS_CANVAS_SCALE;}
function campusHFromLegacy(h){return bound(h,.1,100)*CAMPUS_CANVAS_SCALE;}
function campusYV2toV3(y){
 const oldTotal=CAMPUS_ASPECT_H+2*CAMPUS_OLD_PAD,newTotal=CAMPUS_ASPECT_H+2*CAMPUS_NEW_PAD;
 const abs=bound(y,0,100)/100*oldTotal;
 const rel=(abs-CAMPUS_OLD_PAD)/CAMPUS_ASPECT_H;
 return bound((CAMPUS_NEW_PAD+rel*CAMPUS_ASPECT_H)/newTotal*100,0,100);
}
function campusHV2toV3(h){
 const oldTotal=CAMPUS_ASPECT_H+2*CAMPUS_OLD_PAD,newTotal=CAMPUS_ASPECT_H+2*CAMPUS_NEW_PAD;
 return bound(Number(h)||0.1,.1,100)*oldTotal/newTotal;
}
function validData(v){
 if(!v || typeof v!=='object'||!Array.isArray(v.zones)||!Array.isArray(v.programs))throw Error('データ形式が不正です');
 const out={...clone(DEFAULT_DATA), ...v};
 const canvasVer=Number(v.campusCanvasVersion||1);
 const migrateCampusCanvas=canvasVer<2;
 const migrateCampusV3=canvasVer<3;
 if(typeof v.reactionDeadline!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.reactionDeadline))out.reactionDeadline=out.eventDate+'T17:00';
 out.zones=v.zones.filter(z=>z && typeof z.id==='string' && MAPS.some(m=>m.id===z.mapId)).map(z=>{
  let y=bound(z.y,0,100),h=bound(z.h,.1,100);
  if(migrateCampusCanvas&&z.mapId==='campus'){y=campusYFromLegacy(y);h=campusHFromLegacy(h);}
  if(migrateCampusV3&&z.mapId==='campus'){y=campusYV2toV3(y);h=campusHV2toV3(h);}
  return {id:z.id,mapId:z.mapId,name:String(z.name||'会場'),note:String(z.note||''),kind:String(z.kind||'classroom'),x:bound(z.x,0,100),y,w:bound(z.w,.1,100),h};
 });
 const rawSafety=Array.isArray(v.safetyItems)?v.safetyItems:[];
 out.safetyItems=rawSafety.filter(it=>it&&typeof it.id==='string'&&MAPS.some(m=>m.id===it.mapId)).map(it=>{
  if(it.kind==='route'){
   let y1=bound(it.y1,0,100),y2=bound(it.y2,0,100);
   if(migrateCampusCanvas&&it.mapId==='campus'){y1=campusYFromLegacy(y1);y2=campusYFromLegacy(y2);}
   if(migrateCampusV3&&it.mapId==='campus'){y1=campusYV2toV3(y1);y2=campusYV2toV3(y2);}
   return {id:String(it.id),mapId:String(it.mapId),kind:'route',type:'route',label:String(it.label||'避難経路'),x1:bound(it.x1,0,100),y1,x2:bound(it.x2,0,100),y2};
  }
  const type=SAFETY_TYPES[it.type]?String(it.type):'extinguisher';
  let y=bound(it.y,0,100);if(migrateCampusCanvas&&it.mapId==='campus')y=campusYFromLegacy(y);if(migrateCampusV3&&it.mapId==='campus')y=campusYV2toV3(y);
  return {id:String(it.id),mapId:String(it.mapId),kind:'point',type,label:String(it.label||SAFETY_TYPES[type].label),x:bound(it.x,0,100),y};
 });
 out.campusCanvasVersion=3;
 out.nextSafetyId=Math.max(1,Number(v.nextSafetyId)||1);
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
  return {id:p.id,reactionId:String(p.reactionId||''),session,start:sd?.start||String(p.start||'09:00'),end:sd?.end||String(p.end||'09:20'),grade:String(p.grade||''),group:String(p.group||''),title:String(p.title||'発表'),zoneId:String(p.zoneId||''),presenters:String(p.presenters||'')};
 });
 // Ver.1.14: リアクションは「学年 + 発表グループ + 発表内容」を1つの発表単位として扱う。
 // 同じグループが複数セッションで同じ発表を行う場合だけreactionIdを共有する。
 syncReactionGroups(out);
 out.noticeTitle=String(v.noticeTitle||DEFAULT_DATA.noticeTitle);
 out.noticeMessage=String(v.noticeMessage||DEFAULT_DATA.noticeMessage);
 out.noticeIssuer=String(v.noticeIssuer||DEFAULT_DATA.noticeIssuer);
 out.internalPasscode=String(v.internalPasscode||'');
 out.stampCompleteImage=typeof v.stampCompleteImage==='string'?v.stampCompleteImage:'';
 out.stampHints=Array.from({length:5},(_,i)=>String(Array.isArray(v.stampHints)?(v.stampHints[i]||''):''));
 const rawSurveys=Array.isArray(v.surveys)?v.surveys:[];
 out.surveys=rawSurveys.filter(x=>x&&typeof x==='object').map((x,i)=>{
  const target=['public','internal','both'].includes(String(x.target))?String(x.target):'both';
  const startAt=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.startAt||''))?String(x.startAt):'';
  const endAt=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.endAt||''))?String(x.endAt):'';
  return {id:String(x.id||`survey-${i+1}`),title:String(x.title||'アンケート'),message:String(x.message||''),url:String(x.url||''),image:/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(String(x.image||''))?String(x.image):'',buttonLabel:String(x.buttonLabel||'回答する'),enabled:x.enabled!==false,target,startAt,endAt,order:Number.isFinite(Number(x.order))?Number(x.order):i+1};
 });
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
const schemaVersion=10;
function projectPublished(src){
 const safe=validData(src);
 // テスト日時はブラウザ専用。公開データには送らず、全来場者で実時刻を使う。
 const publicPrograms=safe.programs.map(({presenters,...p})=>p);
 return {schemaVersion,campusCanvasVersion:safe.campusCanvasVersion,year:safe.year,eventDate:safe.eventDate,slogan:safe.slogan,sessions:clone(safe.sessions),
   zones:clone(safe.zones),safetyItems:clone(safe.safetyItems),nextSafetyId:safe.nextSafetyId,nextIds:clone(safe.nextIds),programs:publicPrograms,reactionDeadline:safe.reactionDeadline,
   noticeTitle:safe.noticeTitle,noticeMessage:safe.noticeMessage,noticeIssuer:safe.noticeIssuer,stampCompleteImage:safe.stampCompleteImage,stampHints:clone(safe.stampHints),surveys:clone(safe.surveys.filter(x=>x.target==='public'||x.target==='both'))};
}
function projectInternal(src){
 const safe=validData(src);
 const presenters={};
 for(const p of safe.programs){const names=String(p.presenters||'').trim();if(names)presenters[p.id]=names;}
 return {year:safe.year,passcode:String(safe.internalPasscode||''),payload:{presenters,surveys:clone(safe.surveys.filter(x=>x.target==='internal'))}};
}
function projectArchive(src){
 const safe=validData(src);
 const archived=clone(safe);
 archived.internalPasscode='';
 archived.test={enabled:false,date:archived.eventDate,time:'09:25'};
 return archived;
}
let internalPresenterMap={};
let internalSurveyList=[];
let adminInternalPayload=null;
let audienceMode='';
function currentPresenterNames(p){
 if(editorActive)return String(p.presenters||'').trim();
 if(audienceMode==='internal')return String(internalPresenterMap?.[p.id]||'').trim();
 return '';
}
function presentersHtml(p,compact=false){const names=currentPresenterNames(p);return names?`<div class="program-presenters ${compact?'compact':''}"><span>児童生徒</span>${esc(names)}</div>`:'';}
function applyAdminInternalToDraft(){
 const map=adminInternalPayload?.presenters||{};
 if(map&&typeof map==='object'){for(const p of draftState.programs||[]){if(map[p.id]&&!p.presenters)p.presenters=String(map[p.id]);}}
 const privateSurveys=Array.isArray(adminInternalPayload?.surveys)?adminInternalPayload.surveys:[];
 if(privateSurveys.length){const merged=new Map((draftState.surveys||[]).map(x=>[x.id,x]));for(const item of privateSurveys)merged.set(item.id,{...item,target:'internal'});draftState.surveys=[...merged.values()];}
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
 applyAdminInternalToDraft();
 state=draftState;
}
function closeDraft(){editorActive=false;state=demoDraftPreview?draftState:(publishedState||draftState);renderPublic();}
window.OFESCloud={
  exportPublished:()=>projectPublished(draftState),
  exportInternal:()=>projectInternal(draftState),
  exportArchive:()=>projectArchive(draftState),
  publishedSummary:()=>({exists:cloudAvailable,year:publishedState?.year,zones:publishedState?.zones.length||0,programs:publishedState?.programs.length||0}),
  importPublishedAsDraft:()=>{
   if(!publishedState)throw Error('Supabaseにはまだ公開データがありません。');
   draftState=clone(publishedState);applyAdminInternalToDraft();state=draftState;persist();editId='';editDraft=null;selectedSafetyId='';drawMode='';adminMap='campus';
   renderAdmin();renderPublic();toast('Supabaseの公開データを編集用に読み込みました');
  }
};
window.addEventListener('ofes-cloud-published',e=>acceptPublished(e.detail?.data??null));
window.addEventListener('ofes-internal-admin',e=>{adminInternalPayload=e.detail?.payload||null;if(editorActive){applyAdminInternalToDraft();state=draftState;persist();renderAdminPrograms();renderSurveyAdmin();}});
window.addEventListener('ofes-internal-access',e=>{internalPresenterMap=e.detail?.payload?.presenters||{};internalSurveyList=Array.isArray(e.detail?.payload?.surveys)?e.detail.payload.surveys:[];audienceMode='internal';sessionStorage.setItem(ACCESS_MODE_KEY,'internal');hideEntryGate();renderPublic();renderTv();});

let visitorBuilding='campus',session='current',visitorSelected='';
let programReturnScrollY=0;
let reactionPreviewMode=false,reactionPreviewProgram=null;
const visitorZoom=Object.fromEntries(MAPS.map(m=>[m.id,100]));
let adminMap='campus',editId='',editDraft=null,drawMode='',dragStart=null,dragRect=null,adminProgramVenue='';
let safetyVisible=false,selectedSafetyId='';
function syncSessionProgramTimes(target=state){
 if(!target.sessions)target.sessions=clone(DEFAULT_SESSIONS);
 for(const p of target.programs||[]){const sd=target.sessions[p.session];if(sd){p.start=sd.start;p.end=sd.end;}}
}
function persist(){try{syncSessionProgramTimes(state);syncReactionGroups(state);draftState=state;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true}catch(e){alert('ブラウザに保存できませんでした。容量・設定をご確認ください。');return false}}
function toast(msg){byId('saveToast').textContent=msg;}
function getZone(id){return state.zones.find(z=>z.id===id)}
function getSafety(id){return (state.safetyItems||[]).find(it=>it.id===id)}
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
function roomLabel(p){return getZone(p.zoneId)?.name||'会場未登録'}
function renderHeader(){
 byId('heroYear').textContent=state.year;
 byId('heroSlogan').textContent=state.slogan;
 const today=new Date(),end=new Date(state.eventDate+'T00:00:00'), start=new Date(dateISO(today)+'T00:00:00');
 const dif=Math.round((end.getTime()-start.getTime())/86400000);
 byId('countdown').textContent=dif>0?`開催まであと ${dif} 日`:dif===0?'いよいよ本日！':'今年のおおフェスは終了しました';
 const v=viewTime();byId('previewTag').hidden=!v.demo;byId('previewTag').textContent=`TEST ${v.date} ${v.time}`;
}
function setTab(tab,opts={}){if(tab!=='stamp'&&stampScannerActive)closeStampScanner();$$('.nav[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.tab-view').forEach(v=>v.classList.toggle('active',v.id===`tab-${tab}`));if(tab==='venues')renderVisitorMap();if(opts.scrollTop!==false)window.scrollTo({top:0,behavior:'smooth'});}
$$('.nav[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function surveyNowKey(){const v=viewTime();return `${v.date}T${v.time}`;}
function surveyIsActive(item){if(!item||item.enabled===false||!String(item.url||'').trim())return false;const now=surveyNowKey();if(item.startAt&&now<item.startAt)return false;if(item.endAt&&now>item.endAt)return false;return true;}
function visibleSurveys(){
 let list=Array.isArray(state.surveys)?state.surveys.slice():[];
 if(audienceMode==='internal'&&internalSurveyList.length){const merged=new Map(list.map(x=>[x.id,x]));for(const x of internalSurveyList)merged.set(x.id,{...x,target:'internal'});list=[...merged.values()];}
 return list.filter(x=>{if(!surveyIsActive(x))return false;if(audienceMode==='internal')return x.target==='internal'||x.target==='both'||x.target==='public';return x.target==='public'||x.target==='both';}).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.title).localeCompare(String(b.title),'ja'));
}
function renderSurveys(){const panel=byId('surveyPanel'),cards=byId('surveyCards');if(!panel||!cards)return;const list=visibleSurveys();panel.hidden=!list.length;if(!list.length){cards.innerHTML='';return;}const label=byId('surveyAudienceLabel');if(label)label.textContent=audienceMode==='internal'?'大豊学園向けを含む':'来場者向け';cards.innerHTML=list.map(x=>`<article class="survey-card"><div><strong>${esc(x.title)}</strong>${x.message?`<p>${esc(x.message).replace(/\n/g,'<br>')}</p>`:''}${x.image?`<button class="survey-poster-button" type="button" data-survey-preview="${esc(x.id)}" aria-label="${esc(x.title)}の参考画像を拡大する"><img src="${esc(x.image)}" alt="${esc(x.title)}の参考ポスター"><span>🔍 ポスターを拡大する</span></button>`:''}${x.endAt?`<small>回答期間：〜 ${esc(x.endAt.replace('T',' '))}</small>`:''}</div><a class="survey-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.buttonLabel||'回答する')} ↗</a></article>`).join('');cards.querySelectorAll('[data-survey-preview]').forEach(btn=>btn.addEventListener('click',()=>{const item=list.find(x=>x.id===btn.dataset.surveyPreview);if(!item?.image)return;const modal=byId('surveyImageModal');byId('surveyImageLarge').src=item.image;byId('surveyImageLarge').alt=`${item.title}の参考画像`;modal.hidden=false;}));}

byId('closeSurveyImage')?.addEventListener('click',()=>{byId('surveyImageModal').hidden=true;byId('surveyImageLarge').removeAttribute('src');});
byId('surveyImageModal')?.addEventListener('click',e=>{if(e.target.id==='surveyImageModal')byId('closeSurveyImage').click();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('surveyImageModal').hidden)byId('closeSurveyImage').click();});
function renderProgram(){
 const filteredOrdered=orderedPrograms();
 const v=viewTime(),active=activePrograms();
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
  byId('programList').innerHTML='<div class="notice-card">プログラムはまだ登録されていません。</div>';
  return;
 }
 byId('programList').innerHTML=units.map(unit=>{
  if(unit.type==='session'){
   const d=sessionDef(unit.sid);
   const statuses=unit.programs.map(programStatus);
   const st=statuses.some(x=>x.key==='live')?{key:'live',label:'発表中'}:(statuses.every(x=>x.key==='ended')?{key:'ended',label:'終了しました'}:{key:'upcoming',label:'発表予定'});
   const items=unit.programs.slice().sort((a,b)=>String(roomLabel(a)).localeCompare(String(roomLabel(b)))).map(p=>`<div class="session-program-item"><div class="session-program-main"><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong>${presentersHtml(p,true)}<div class="where">${esc(roomLabel(p))}</div>${reactionsHtml(p)}</div><button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div>`).join('');
   return `<details class="program-session-group ${st.key==='live'?'on':''}" ${st.key==='live'?'open':''}><summary class="program-session-summary"><span class="time">${esc(d.start)}</span><span class="session-summary-main"><strong>${esc(d.label)}</strong><span class="program-status status-${st.key}">${st.label}</span><span class="where">${esc(d.start)}〜${esc(d.end)}　${unit.programs.length}発表</span></span><span class="session-fold-icon" aria-hidden="true">⌄</span></summary><div class="session-program-items">${items}</div></details>`;
  }
  if(unit.type==='afternoon-group'){
   const ps=unit.programs.slice().sort((a,b)=>timeNum(programTimes(a).start)-timeNum(programTimes(b).start)||String(a.id).localeCompare(String(b.id)));
   const first=programTimes(ps[0]),last=programTimes(ps[ps.length-1]);
   const anyLive=ps.some(p=>programStatus(p).key==='live');
   const allEnded=ps.every(p=>programStatus(p).key==='ended');
   const st=anyLive?{key:'live',label:'発表中'}:(allEnded?{key:'ended',label:'終了しました'}:{key:'upcoming',label:'発表予定'});
   const items=ps.map(p=>{const pt=programTimes(p),pst=programStatus(p);return `<div class="session-program-item"><div class="session-program-main"><div class="afternoon-program-time">${esc(pt.start)}〜${esc(pt.end)} <span class="program-status status-${pst.key}">${pst.label}</span></div><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong>${presentersHtml(p,true)}<div class="where">${esc(roomLabel(p))}</div>${reactionsHtml(p)}</div><button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div>`}).join('');
   return `<details class="program-session-group afternoon-program-group ${st.key==='live'?'on':''}" ${st.key==='live'?'open':''}><summary class="program-session-summary"><span class="time">${esc(first.start)}</span><span class="session-summary-main"><strong>午後の有志発表</strong><span class="program-status status-${st.key}">${st.label}</span><span class="where">${esc(first.start)}〜${esc(last.end)}　${ps.length}発表</span></span><span class="session-fold-icon" aria-hidden="true">⌄</span></summary><div class="session-program-items">${items}</div></details>`;
  }
  const p=unit.p,pt=programTimes(p),st=programStatus(p);
  return `<div class="program-row ${st.key==='live'?'on':''}"><div class="time">${esc(pt.start)}</div><div><strong>${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</strong>${presentersHtml(p,true)}<span class="program-status status-${st.key}">${st.label}</span><div class="where">${esc(sessionLabel(p.session))}　${esc(pt.start)}〜${esc(pt.end)}　${esc(roomLabel(p))} <button type="button" class="minilink" data-see="${esc(p.zoneId)}" ${p.zoneId?'':'disabled'}>会場を見る</button></div></div></div>`;
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
function bindReactionHelpToggle(buttonId,panelId){
 const button=byId(buttonId),panel=byId(panelId);if(!button||!panel)return;
 button.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;button.classList.toggle('active',open);button.setAttribute('aria-expanded',String(open));button.textContent=open?'リアクションの説明を閉じる':'リアクションの説明を表示';});
}
bindReactionHelpToggle('toggleReactionGuideProgram','reactionGuideProgram');
bindReactionHelpToggle('toggleReactionGuideVenue','reactionGuideVenue');
byId('toggleSafetyInfo')?.addEventListener('click',()=>{
 safetyVisible=!safetyVisible;
 byId('toggleSafetyInfo').classList.toggle('active',safetyVisible);
 byId('toggleSafetyInfo').setAttribute('aria-pressed',String(safetyVisible));
 byId('toggleSafetyInfo').textContent=safetyVisible?'安全情報を表示中':'安全情報を表示';
 byId('safetyLegend').hidden=!safetyVisible;
 renderVisitorMap();
});
function renderSessionButtons(){
 const shortMarks={s1:'①',s2:'②',s3:'③',s4:'④'};
 const entries=[{id:'current',label:'現在',aria:'現在の時間帯'},...SESSION_IDS.map((id)=>{const d=sessionDef(id);return {id,label:`${shortMarks[id]}${d.start}〜${d.end}`,aria:`${sessionLabel(id)} ${d.start}〜${d.end}`}})];
 byId('sessionSwitch').innerHTML=entries.map(({id,label,aria})=>`<button data-session="${id}" class="${id===session?'active':''}" aria-pressed="${id===session}" aria-label="${esc(aria)}">${esc(label)}</button>`).join('');
 $$('[data-session]').forEach(b=>b.onclick=()=>{session=b.dataset.session;renderVisitorMap();});
}
function zStyle(z){return `left:${bound(z.x,0,100)}%;top:${bound(z.y,0,100)}%;width:${bound(z.w,.1,100)}%;height:${bound(z.h,.1,100)}%;`}
function zoneHtml(z,active,selected){const label=z.name||z.id;return `<button type="button" class="zone ${active?'on':''} ${selected?'selected':''}" style="${zStyle(z)}" data-zone="${esc(z.id)}" title="${esc(z.name)}" aria-label="${esc(z.name)}"><span class="zone-caption">${esc(label)}</span></button>`}
function safetyPointHtml(it,admin=false){
 const def=SAFETY_TYPES[it.type]||SAFETY_TYPES.extinguisher;
 const selected=admin&&it.id===selectedSafetyId;
 return `<button type="button" class="safety-marker safety-${esc(it.type)} ${selected?'selected':''}" style="left:${bound(it.x,0,100)}%;top:${bound(it.y,0,100)}%" data-safety="${esc(it.id)}" title="${esc(it.label||def.label)}" aria-label="${esc(it.label||def.label)}"><span>${esc(def.icon)}</span></button>`;
}
function safetyOverlayHtml(mapId,admin=false){
 if(!admin&&!safetyVisible)return '';
 const items=(state.safetyItems||[]).filter(it=>it.mapId===mapId);
 const routes=items.filter(it=>it.kind==='route');
 const points=items.filter(it=>it.kind!=='route');
 const markerId=`safetyArrow-${admin?'admin':'visitor'}-${mapId}`;
 const lines=routes.map(it=>`<line class="safety-route-line ${admin&&it.id===selectedSafetyId?'selected':''}" x1="${bound(it.x1,0,100)}" y1="${bound(it.y1,0,100)}" x2="${bound(it.x2,0,100)}" y2="${bound(it.y2,0,100)}" marker-end="url(#${esc(markerId)})" />`).join('');
 const handles=admin?routes.map(it=>{const x=(Number(it.x1)+Number(it.x2))/2,y=(Number(it.y1)+Number(it.y2))/2;return `<button type="button" class="safety-route-handle ${it.id===selectedSafetyId?'selected':''}" style="left:${x}%;top:${y}%" data-safety="${esc(it.id)}" title="${esc(it.label||'避難経路')}" aria-label="${esc(it.label||'避難経路')}">→</button>`}).join(''):'';
 return `<svg class="safety-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="${esc(markerId)}" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" /></marker></defs>${lines}</svg>${points.map(it=>safetyPointHtml(it,admin)).join('')}${handles}`;
}

function floorLabel(m){return m.floor?`${m.floor}階`:'学校全体図'}
function floorDetailHtml(m){
 const z=getZone(visitorSelected);
 if(!z||z.mapId!==m.id)return '';
 let ps=state.programs.filter(p=>p.zoneId===z.id).slice();
 if(reactionPreviewMode&&reactionPreviewProgram?.zoneId===z.id&&!ps.some(p=>p.id===reactionPreviewProgram.id))ps.push(reactionPreviewProgram);
 ps.sort((a,b)=>timeNum(programTimes(a).start)-timeNum(programTimes(b).start)||timeNum(programTimes(a).end)-timeNum(programTimes(b).end)||String(a.id).localeCompare(String(b.id)));
 return `<h4>${esc(z.name)} <span class="pill">${esc(z.id)}</span></h4>${z.note?`<p>${esc(z.note)}</p>`:''}
 <p class="muted">${esc(m.name)}　登録されている発表：${ps.length}件</p>
 ${ps.length?`<div class="venue-program-list">${ps.map(p=>{const pt=programTimes(p),st=programStatus(p);return `<article class="venue-program-item status-border-${st.key}"><div class="venue-program-meta"><span class="program-status status-${st.key}">${st.label}</span><strong>${esc(sessionLabel(p.session))}</strong><span>${esc(pt.start)}〜${esc(pt.end)}</span></div><div class="venue-program-title">${p.grade?`<span class="program-grade">${esc(p.grade)}</span> `:''}${p.group?`<span class="program-group">${esc(p.group)}</span> `:''}${esc(p.title)}</div>${presentersHtml(p)}${SESSION_IDS.includes(p.session)?reactionsHtml(p):''}</article>`}).join('')}</div>`:'<p>この会場のプログラムはまだ登録されていません。</p>'}`;
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
 if(byId('toggleSafetyInfo')){byId('toggleSafetyInfo').classList.toggle('active',safetyVisible);byId('toggleSafetyInfo').setAttribute('aria-pressed',String(safetyVisible));byId('toggleSafetyInfo').textContent=safetyVisible?'安全情報を表示中':'安全情報を表示';}
 if(byId('safetyLegend'))byId('safetyLegend').hidden=!safetyVisible;
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
   <div class="floor-map-window ${m.id==='campus'?'campus-window':''}" id="window-${m.id}" data-map="${m.id}">
    <div class="map-stage ${m.id==='campus'?'campus-canvas':''}" id="stage-${m.id}" style="width:${visitorZoom[m.id]}%">
     <img src="${esc(m.src)}" draggable="false" alt="${esc(m.name)}">
     <div class="safety-layer">${safetyOverlayHtml(m.id,false)}</div>
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
function stampList(){
 try{
  const raw=JSON.parse(localStorage.getItem(STAMP_KEY)||'[]');
  if(!Array.isArray(raw))return [];
  return [...new Set(raw.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=5))].sort((a,b)=>a-b);
 }catch{return []}
}
function saveStamp(n){
 if(!Number.isInteger(n)||n<1||n>5)return {ok:false,added:false,list:stampList()};
 const current=stampList(),added=!current.includes(n);
 if(added)current.push(n);
 const clean=[...new Set(current)].sort((a,b)=>a-b);
 try{localStorage.setItem(STAMP_KEY,JSON.stringify(clean));}
 catch(e){console.error('stamp save failed',e);return {ok:false,added:false,list:stampList()};}
 return {ok:true,added,list:clean};
}
function renderStamps(){
 const a=stampList(),progress=byId('stampProgress');
 if(progress){
  progress.innerHTML=a.length===5
   ? `<strong>🎉 5 / 5　コンプリート！</strong><span>5つのスタンプがそろいました。</span>`
   : `<strong>獲得スタンプ：${a.length} / 5</strong><span>あと ${5-a.length} 個です。</span>`;
 }
 byId('stampCards').innerHTML=[1,2,3,4,5].map(i=>{const hint=String(state.stampHints?.[i-1]||'').trim();return `<div class="stamp-item ${a.includes(i)?'got':''}"><div class="star">⭐</div><b>STAMP ${i}</b><small>${a.includes(i)?'取得済み':'未取得'}</small>${hint?`<details class="stamp-hint"><summary>💡 ヒントを見る</summary><p>${esc(hint)}</p></details>`:''}</div>`;}).join('');
 const panel=byId('stampCompletePanel'),img=byId('stampCompleteImage');
 if(panel){panel.hidden=a.length!==5;if(a.length===5){if(state.stampCompleteImage){img.src=state.stampCompleteImage;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}}}
}
function parseStampQrValue(value){
 try{
  const base=new URL(STAMP_BASE_URL),u=new URL(String(value||'').trim(),STAMP_BASE_URL);
  const norm=p=>{const t=String(p||'').replace(/\/+$/,'');return (t||'')+'/';};
  if(u.origin!==base.origin||norm(u.pathname)!==norm(base.pathname))return null;
  const n=Number(u.searchParams.get('stamp'));
  return Number.isInteger(n)&&n>=1&&n<=5?n:null;
 }catch{return null}
}
function showStampMessage(text,type='success'){
 const el=byId('stampScanMessage');if(!el)return;el.textContent=text;el.className=`stamp-scan-message ${type}`;
}
function acceptStampNumber(n,source='camera'){
 const result=saveStamp(n);
 if(!result.ok){showStampMessage('スタンプを端末に保存できませんでした。ブラウザの保存設定をご確認ください。','error');return false;}
 renderStamps();
 if(result.added){
  const left=5-result.list.length;
  showStampMessage(left===0?`🎉 STAMP ${n} をGET！ 5つそろいました！`:`⭐ STAMP ${n} をGET！ あと ${left} 個です。`,'success');
 }else{showStampMessage(`STAMP ${n} はすでに取得済みです。`,'info');}
 return true;
}
function readStampFromUrl(){
 const n=parseStampQrValue(location.href);if(!n)return;
 acceptStampNumber(n,'url');renderStamps();setTab('stamp');
 try{history.replaceState(null,'',location.pathname+location.hash);}catch{}
}

// Ver.1.26: OFES内でカメラを起動してQRを読み取り、同じアプリのlocalStorageに保存する。
let stampScanner=null,stampScannerActive=false,stampScanLocked=false;
async function closeStampScanner(){
 const modal=byId('stampScannerModal');
 stampScanLocked=false;
 try{
  if(stampScanner&&stampScannerActive){await stampScanner.stop();}
 }catch(e){console.warn('stamp scanner stop',e)}
 try{if(stampScanner)stampScanner.clear();}catch(e){console.warn('stamp scanner clear',e)}
 stampScanner=null;stampScannerActive=false;
 if(modal)modal.hidden=true;
 const reader=byId('stampQrReader');if(reader)reader.innerHTML='';
}
async function handleStampDecoded(decodedText){
 if(stampScanLocked)return;
 const n=parseStampQrValue(decodedText);
 if(!n){
  const status=byId('stampScannerStatus');if(status)status.textContent='OFESスタンプラリーのQRコードではありません。別のQRコードを読み取ってください。';
  return;
 }
 stampScanLocked=true;
 const result=saveStamp(n);
 renderStamps();
 const status=byId('stampScannerStatus');
 if(!result.ok){
  if(status)status.textContent='端末への保存に失敗しました。';
  showStampMessage('スタンプを端末に保存できませんでした。','error');
  stampScanLocked=false;return;
 }
 const left=5-result.list.length;
 const msg=result.added?(left===0?`🎉 STAMP ${n} をGET！ 5つそろいました！`:`⭐ STAMP ${n} をGET！ あと ${left} 個です。`):`STAMP ${n} はすでに取得済みです。`;
 if(status)status.textContent=msg;showStampMessage(msg,result.added?'success':'info');
 if(navigator.vibrate)try{navigator.vibrate(80)}catch{}
 setTimeout(()=>closeStampScanner(),900);
}
async function openStampScanner(){
 setTab('stamp',{scrollTop:false});
 const modal=byId('stampScannerModal'),status=byId('stampScannerStatus');
 if(!modal)return;modal.hidden=false;
 if(status)status.textContent='カメラを準備しています…';
 stampScanLocked=false;
 if(!window.isSecureContext){if(status)status.textContent='カメラはHTTPS接続でのみ利用できます。学校用GitHub Pagesから開いてください。';return;}
 if(typeof Html5Qrcode==='undefined'){if(status)status.textContent='QR読み取り機能を読み込めませんでした。通信環境を確認して再読み込みしてください。';return;}
 try{
  stampScanner=new Html5Qrcode('stampQrReader',{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE],verbose:false});
  const minBox=Math.max(190,Math.min(280,Math.floor(Math.min(window.innerWidth,window.innerHeight)*0.58)));
  await stampScanner.start(
   {facingMode:'environment'},
   {fps:10,qrbox:{width:minBox,height:minBox},aspectRatio:1.0,disableFlip:false},
   handleStampDecoded,
   ()=>{}
  );
  stampScannerActive=true;if(status)status.textContent='QRコードを枠の中に入れてください。';
 }catch(error){
  console.error('stamp scanner start',error);
  stampScannerActive=false;
  const name=String(error?.name||'');
  if(status)status.textContent=name.includes('NotAllowed')?'カメラの使用が許可されていません。ブラウザのカメラ権限を許可してください。':'カメラを起動できませんでした。カメラ権限と通信環境をご確認ください。';
 }
}
byId('openStampScanner')?.addEventListener('click',openStampScanner);
byId('closeStampScanner')?.addEventListener('click',closeStampScanner);
byId('stopStampScanner')?.addEventListener('click',closeStampScanner);
byId('stampScannerModal')?.addEventListener('click',e=>{if(e.target===byId('stampScannerModal'))closeStampScanner();});
window.addEventListener('pagehide',()=>{if(stampScannerActive)closeStampScanner();});

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

function renderAudienceMode(){
 const chip=byId('audienceMode');if(!chip)return;
 const label=audienceMode==='internal'?'大豊学園':audienceMode==='admin'?'管理者':'一般来場者';
 chip.textContent=label;chip.classList.toggle('internal',audienceMode==='internal');
}
function showEntryGate(){byId('entryGate').hidden=false;byId('internalLoginForm').hidden=true;byId('internalLoginMessage').textContent='';}
function hideEntryGate(){byId('entryGate').hidden=true;}
function choosePublic(){audienceMode='public';internalPresenterMap={};internalSurveyList=[];sessionStorage.setItem(ACCESS_MODE_KEY,'public');hideEntryGate();renderPublic();}
byId('enterPublic')?.addEventListener('click',choosePublic);
for(const id of ['internalPasscodeInput','internalPasscodeSetting']){
 const input=byId(id);input?.addEventListener('input',()=>{const digits=input.value.replace(/[^0-9]/g,'');if(digits!==input.value)input.value=digits;});
}
byId('openInternalLogin')?.addEventListener('click',()=>{byId('internalLoginForm').hidden=false;byId('internalPasscodeInput').value='';byId('internalLoginMessage').textContent='';byId('internalPasscodeInput').focus();});
byId('cancelInternalLogin')?.addEventListener('click',()=>{byId('internalLoginForm').hidden=true;byId('internalLoginMessage').textContent='';});
byId('internalLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();const pass=byId('internalPasscodeInput').value.trim(),msg=byId('internalLoginMessage');if(!/^[0-9]{8,24}$/.test(pass)){msg.textContent='数字8〜24桁のパスコードを入力してください。';return;}msg.textContent='確認しています…';try{if(!window.OFESInternal?.verify)throw Error('Supabase接続準備中です。少し待ってからもう一度お試しください。');const payload=await window.OFESInternal.verify(state.year,pass);if(!payload)throw Error('パスコードが正しくありません。');internalPresenterMap=payload.presenters||{};internalSurveyList=Array.isArray(payload.surveys)?payload.surveys:[];audienceMode='internal';sessionStorage.setItem(ACCESS_MODE_KEY,'internal');hideEntryGate();renderPublic();}catch(err){msg.textContent=err.message||'パスコードを確認できませんでした。';}});
byId('backToEntry')?.addEventListener('click',()=>{audienceMode='';internalPresenterMap={};internalSurveyList=[];sessionStorage.removeItem(ACCESS_MODE_KEY);showEntryGate();renderAudienceMode();renderSurveys();});
byId('entryAdmin')?.addEventListener('click',()=>{hideEntryGate();byId('openAdmin').click();});

function tvPeople(p){const names=currentPresenterNames(p);const publicPeople=[p.grade,p.group].filter(Boolean).join(' ');return names?`${publicPeople}${publicPeople?' / ':''}${names}`:(publicPeople||'発表者');}
function tvProgramCard(p){const pt=programTimes(p);return `<article class="tv-program-card"><div class="tv-time">${esc(pt.start)}〜${esc(pt.end)}</div><h2>${esc(p.title)}</h2><div class="tv-meta"><span>📍 ${esc(roomLabel(p))}</span><span>👥 ${esc(tvPeople(p))}</span></div></article>`;}
function renderTv(){
 const panel=byId('tvPanel');if(!panel||panel.hidden)return;
 byId('tvYear').textContent=state.year;byId('tvSlogan').textContent=state.slogan;
 const v=viewTime();byId('tvClock').textContent=`${v.date.replaceAll('-','/')} ${v.time}`;
 const content=byId('tvContent');const all=orderedPrograms();
 if(v.date<state.eventDate){const now=new Date(v.date+'T00:00:00'),event=new Date(state.eventDate+'T00:00:00'),days=Math.max(0,Math.round((event-now)/86400000));content.innerHTML=`<div class="tv-message countdown"><span>おおフェスまで</span><strong>あと ${days} 日</strong><p>${esc(jpEventDate(state.eventDate))}</p></div>`;return;}
 if(v.date>state.eventDate){content.innerHTML='<div class="tv-message"><strong>今年のおおフェスも<br>ありがとうございました。</strong><p>次回もお楽しみに！</p></div>';return;}
 const active=activePrograms();if(active.length){content.innerHTML=`<div class="tv-kicker">ただいま開催中</div><div class="tv-program-grid">${active.map(tvProgramCard).join('')}</div>`;return;}
 const starts=all.map(p=>timeNum(programTimes(p).start));const ends=all.map(p=>timeNum(programTimes(p).end));const first=starts.length?Math.min(...starts):9999,last=ends.length?Math.max(...ends):-1;
 const deadlineTime=state.reactionDeadline?.startsWith(state.eventDate)?timeNum(state.reactionDeadline.slice(11,16)):17*60;
 if(v.minute<first){content.innerHTML='<div class="tv-message"><strong>本日、おおフェス開催！</strong><p>まもなくプログラムが始まります。</p></div>';return;}
 if(v.minute>=last){if(v.minute<deadlineTime){content.innerHTML=`<div class="tv-message reaction"><strong>本日のプログラムは終了しました。</strong><p>リアクションは <b>${esc(state.reactionDeadline.slice(11,16))}</b> まで受付中です。<br>ぜひ発表への感想を届けてください。</p></div>`;}else{content.innerHTML='<div class="tv-message"><strong>今年のおおフェスも<br>ありがとうございました。</strong><p>次回もお楽しみに！</p></div>';}return;}
 const next=all.filter(p=>timeNum(programTimes(p).start)>v.minute);const nextStart=next.length?Math.min(...next.map(p=>timeNum(programTimes(p).start))):null;const group=nextStart===null?[]:next.filter(p=>timeNum(programTimes(p).start)===nextStart);content.innerHTML=`<div class="tv-kicker">次のプログラム</div><div class="tv-program-grid">${group.map(tvProgramCard).join('')}</div>`;
}
byId('openTv')?.addEventListener('click',()=>{byId('tvPanel').hidden=false;renderTv();});
byId('closeTv')?.addEventListener('click',()=>{byId('tvPanel').hidden=true;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});});
byId('tvLandscape')?.addEventListener('click',()=>{byId('tvPanel').classList.add('tv-landscape');byId('tvPanel').classList.remove('tv-portrait');byId('tvLandscape').classList.add('active');byId('tvPortrait').classList.remove('active');});
byId('tvPortrait')?.addEventListener('click',()=>{byId('tvPanel').classList.add('tv-portrait');byId('tvPanel').classList.remove('tv-landscape');byId('tvPortrait').classList.add('active');byId('tvLandscape').classList.remove('active');});
byId('tvFullscreen')?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await byId('tvPanel').requestFullscreen();else await document.exitFullscreen();}catch{}});

async function compressStampImage(file){
 if(!file?.type?.startsWith('image/'))throw Error('画像ファイルを選択してください。');
 const url=URL.createObjectURL(file);try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});const max=1000,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82);}finally{URL.revokeObjectURL(url);}
}
byId('stampCompleteImageFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const msg=byId('stampCompleteImageMessage');msg.textContent='画像を調整しています…';try{state.stampCompleteImage=await compressStampImage(f);if(!persist())throw Error('ブラウザへ保存できませんでした。');renderStampQrAdmin();renderStamps();msg.textContent='画像を保存しました。「データ保存」からSupabaseへ公開すると来場者にも反映されます。';}catch(err){msg.textContent=`画像を保存できませんでした：${err.message}`;}finally{e.target.value='';}});
byId('removeStampCompleteImage')?.addEventListener('click',()=>{if(!state.stampCompleteImage)return;state.stampCompleteImage='';persist();renderStampQrAdmin();renderStamps();byId('stampCompleteImageMessage').textContent='画像を削除しました。';});
byId('saveStampHints')?.addEventListener('click',()=>{state.stampHints=Array.from({length:5},(_,i)=>String(byId(`stampHint${i+1}`)?.value||'').trim());persist();renderStamps();const msg=byId('stampHintMessage');if(msg)msg.textContent='ヒントを保存しました。「データ保存」からSupabaseへ公開すると来場者にも反映されます。';toast('スタンプのヒントを保存しました');});
byId('resetStampProgress')?.addEventListener('click',()=>{const current=stampList();if(!current.length){const msg=byId('stampResetMessage');if(msg)msg.textContent='この端末には取得済みスタンプがありません。';return;}if(!confirm(`この端末で取得済みのスタンプ ${current.length}個をすべてリセットします。よろしいですか？`))return;try{localStorage.removeItem(STAMP_KEY);renderStamps();showStampMessage('この端末のスタンプ取得状況をリセットしました。','info');const msg=byId('stampResetMessage');if(msg)msg.textContent='①〜⑤の取得状況をすべてリセットしました。もう一度QRコードを読み取れます。';toast('スタンプ取得状況をリセットしました');}catch(err){const msg=byId('stampResetMessage');if(msg)msg.textContent='リセットできませんでした。ブラウザの保存設定をご確認ください。';}});

async function renderYearArchives(){
 const box=byId('yearArchiveList'),msg=byId('yearArchiveMessage');if(!box)return;
 if(!window.OFESArchives){box.innerHTML='<p class="muted">Supabase接続を準備しています…</p>';return;}
 try{const rows=await window.OFESArchives.list();box.innerHTML=rows.length?rows.map(r=>`<article class="year-archive-item"><div><strong>${esc(r.year)}年度</strong><span>${r.event_date?esc(r.event_date):''}</span><small>更新：${r.updated_at?new Date(r.updated_at).toLocaleString('ja-JP'):''}</small></div><div class="row-actions"><button type="button" class="btn light" data-year-view="${esc(r.year)}">内容を見る</button><button type="button" class="btn light" data-year-copy="${esc(r.year)}">前年度としてコピー</button><button type="button" class="btn danger" data-year-delete="${esc(r.year)}">削除</button></div></article>`).join(''):'<p class="muted">保存済みの年度データはありません。</p>';
 box.querySelectorAll('[data-year-view]').forEach(b=>b.onclick=()=>previewYearArchive(b.dataset.year));box.querySelectorAll('[data-year-copy]').forEach(b=>b.onclick=()=>copyYearArchive(b.dataset.year));box.querySelectorAll('[data-year-delete]').forEach(b=>b.onclick=()=>deleteYearArchive(b.dataset.year));if(msg)msg.textContent=`保存済み年度：${rows.length}件`;
 }catch(err){box.innerHTML=`<p class="error">一覧を取得できません：${esc(err.message||err)}</p>`;}
}
async function previewYearArchive(year){try{const payload=await window.OFESArchives.load(year);if(!payload)throw Error('年度データが見つかりません。');const data=validData(payload),box=byId('yearArchivePreview');const list=orderedArchivePrograms(data);box.hidden=false;box.innerHTML=`<div class="year-preview-head"><div><strong>${esc(data.year)}年度</strong><span>${esc(data.eventDate)}　${esc(data.slogan)}</span></div><button type="button" class="btn light" id="closeYearPreview">閉じる</button></div><p>会場 ${data.zones.length}か所 ／ プログラム ${data.programs.length}件</p><div class="year-preview-programs">${list.map(p=>{const d=data.sessions?.[p.session],start=d?.start||p.start,end=d?.end||p.end;const zone=data.zones.find(z=>z.id===p.zoneId)?.name||'会場未設定';return `<article><time>${esc(start)}〜${esc(end)}</time><div><strong>${esc(p.title)}</strong><span>${esc([p.grade,p.group].filter(Boolean).join(' '))}</span><small>${esc(zone)}</small></div></article>`;}).join('')}</div>`;byId('closeYearPreview').onclick=()=>{box.hidden=true;};}catch(err){alert(`年度データを表示できませんでした：${err.message||err}`);}}
function orderedArchivePrograms(data){return [...data.programs].sort((a,b)=>{const sa=data.sessions?.[a.session]?.start||a.start||'99:99',sb=data.sessions?.[b.session]?.start||b.start||'99:99';return timeNum(sa)-timeNum(sb)||String(a.id).localeCompare(String(b.id));});}
async function copyYearArchive(year){try{const payload=await window.OFESArchives.load(year);if(!payload)throw Error('年度データが見つかりません。');const defaultYear=String(Number(year)+1||state.year);const newYear=prompt(`${year}年度の内容をコピーします。新しい年度を入力してください。`,defaultYear);if(!newYear)return;const newDate=prompt('新しい開催日を YYYY-MM-DD で入力してください。',`${newYear}-11-01`);if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate||''))return alert('開催日の形式が正しくありません。');const next=validData(payload);next.year=newYear;next.eventDate=newDate;next.reactionDeadline=`${newDate}T17:00`;next.internalPasscode='';next.test={enabled:false,date:newDate,time:'09:25'};draftState=next;state=draftState;editorActive=true;persist();renderAdmin();renderPublic();alert(`${year}年度を${newYear}年度の下書きとしてコピーしました。パスコードと開催内容を確認してから公開してください。`);}catch(err){alert(`コピーできませんでした：${err.message||err}`);}}
async function deleteYearArchive(year){if(!confirm(`${year}年度の保存データを削除しますか？\nこの操作は元に戻せません。`))return;try{await window.OFESArchives.remove(year);await renderYearArchives();}catch(err){alert(`削除できませんでした：${err.message||err}`);}}
byId('saveYearArchive')?.addEventListener('click',async()=>{const msg=byId('yearArchiveMessage');try{if(!window.OFESArchives)throw Error('Supabase接続準備中です。');if(!confirm(`${state.year}年度の現在の下書きを年度データとして保存しますか？`))return;await window.OFESArchives.save(projectArchive(draftState));msg.textContent=`${state.year}年度を保存しました。`;await renderYearArchives();}catch(err){msg.textContent=`保存できませんでした：${err.message||err}`;}});
byId('refreshYearArchives')?.addEventListener('click',renderYearArchives);

function renderPublic(){renderHeader();renderProgram();renderSurveys();renderVisitorMap();renderStamps();renderAudienceMode();if(!byId('tvPanel').hidden)renderTv();}

// 管理画面へのアクセスはブラウザ試作用の簡易パスワード。外部の書込権限には用いない。
byId('openAdmin').onclick=()=>{reactionPreviewMode=false;reactionPreviewProgram=null;byId('loginModal').hidden=false;byId('adminPassword').value='';byId('loginError').textContent='';byId('adminPassword').focus()};
byId('cancelLogin').onclick=()=>byId('loginModal').hidden=true;
byId('loginForm').onsubmit=e=>{e.preventDefault();if(byId('adminPassword').value!==DEMO_ADMIN_PASSWORD){byId('loginError').textContent='パスワードが違います。';return}
 byId('loginModal').hidden=true;switchDraft();byId('adminPanel').hidden=false;renderPublic();renderAdmin();};
byId('closeAdmin').onclick=()=>{byId('adminPanel').hidden=true;drawMode='';closeDraft();if(!audienceMode)showEntryGate();};
function openAdminTab(t){
 $$('#adminNav button').forEach(x=>x.classList.toggle('active',x.dataset.admin===t));
 $$('.admin-page').forEach(x=>x.classList.toggle('active',x.id===`admin-${t}`));
 if(t==='preflight')renderPreflight();if(t==='venues')renderEditor();if(t==='program')renderAdminPrograms();if(t==='basic')renderBasic();if(t==='surveys')renderSurveyAdmin();if(t==='notice')renderNotice();if(t==='stampqr')renderStampQrAdmin();if(t==='years')renderYearArchives();
}
$$('#adminNav button').forEach(b=>b.onclick=()=>openAdminTab(b.dataset.admin));
function renderPreflight(){
 const box=byId('preflightGrid'),score=byId('preflightScore'),badge=byId('preflightBadge');if(!box)return;
 const dateOk=/^\d{4}-\d{2}-\d{2}$/.test(state.eventDate||'')&&String(state.year||'').trim()&&String(state.slogan||'').trim();
 const unassigned=state.programs.filter(p=>!p.zoneId).length;
 const programOk=state.programs.length>0&&unassigned===0;
 const passOk=/^[0-9]{8,24}$/.test(String(state.internalPasscode||''));
 const deadline=String(state.reactionDeadline||'');
 const lastEnd=Math.max(0,...state.programs.map(p=>timeNum(programTimes(p).end)));
 const deadlineMinute=deadline.startsWith(state.eventDate+'T')?timeNum(deadline.slice(11,16)):-1;
 const reactionOk=deadlineMinute>=lastEnd&&deadlineMinute>0;
 const stampOk=Boolean(state.stampCompleteImage);
 const safetyOk=(state.safetyItems||[]).length>0;
 const noticeOk=Boolean(String(state.noticeTitle||'').trim()&&String(state.noticeMessage||'').trim()&&String(state.noticeIssuer||'').trim());
 const cloudText=byId('firebasePublishSummary')?.textContent||'';
 const sdkText=byId('firebaseSdkStatus')?.textContent||'';
 const cloudOk=/公開中：/.test(cloudText)&&/接続準備完了/.test(sdkText);
 const backupText=byId('publicationBackupSummary')?.textContent||'';
 const backupOk=/直前の復元ポイント/.test(backupText);
 const campusZones=state.zones.filter(z=>z.mapId==='campus').length;
 const tvOk=dateOk&&state.programs.length>0;
 const checks=[
  {ok:cloudOk,title:'Supabase同期',detail:cloudOk?'公開データと接続を確認':'公開状態・接続を確認してください',tab:'firebase'},
  {ok:dateOk,title:'年度・開催日・スローガン',detail:dateOk?`${state.year}年度／${state.eventDate}`:'未設定の項目があります',tab:'basic'},
  {ok:state.zones.length>0,title:'会場登録',detail:`${state.zones.length}か所（学校全体図 ${campusZones}か所）`,tab:'venues'},
  {ok:programOk,title:'プログラム',detail:programOk?`${state.programs.length}件／会場設定済み`:`${state.programs.length}件／会場未設定 ${unassigned}件`,tab:'program'},
  {ok:passOk,title:'大豊学園 関係者パスコード',detail:passOk?'数字8〜24桁で設定済み':'数字8〜24桁で設定してください',tab:'basic'},
  {ok:reactionOk,title:'リアクション受付期限',detail:reactionOk?deadline.replace('T',' '):'最終プログラム後の日時を確認',tab:'basic'},
  {ok:stampOk,title:'スタンプラリー',detail:`${stampOk?'5個達成画像を設定済み':'5個達成画像が未設定'}／ヒント ${(state.stampHints||[]).filter(x=>String(x).trim()).length}/5`,tab:'stampqr'},
  {ok:safetyOk,title:'安全情報',detail:safetyOk?`${state.safetyItems.length}件登録`:'消火器・避難経路等を確認',tab:'venues'},
  {ok:tvOk,title:'TV表示',detail:tvOk?'開催日・プログラムから自動表示':'開催日・プログラムを確認',tab:'basic'},
  {ok:backupOk,title:'最新バックアップ',detail:backupOk?'公開前の復元ポイントあり':'復元ポイントを確認してください',tab:'data'},
  {ok:noticeOk,title:'お知らせPDF',detail:noticeOk?'案内文を設定済み':'案内文・発行者を確認',tab:'notice'}
 ];
 const done=checks.filter(c=>c.ok).length,total=checks.length;
 score.textContent=`${done}/${total}`;badge.textContent=done===total?'準備OK':'要確認';badge.classList.toggle('ok',done===total);
 box.innerHTML=checks.map(c=>`<button type="button" class="preflight-item ${c.ok?'ok':'warn'}" data-preflight-tab="${c.tab}"><span class="preflight-icon">${c.ok?'✓':'!'}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.detail)}</small></span></button>`).join('');
 $$('[data-preflight-tab]').forEach(b=>b.onclick=()=>openAdminTab(b.dataset.preflightTab));
}
byId('refreshPreflight')?.addEventListener('click',()=>renderPreflight());
function renderAdmin(){byId('adminMapSelect').innerHTML=MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');byId('adminMapSelect').value=adminMap;renderEditor();renderAdminPrograms();renderBasic();renderSurveyAdmin();renderNotice();renderStampQrAdmin();renderYearArchives();renderPreflight();setTimeout(renderPreflight,500);}
byId('adminMapSelect').onchange=e=>{adminMap=e.target.value;editId='';editDraft=null;selectedSafetyId='';drawMode='';renderEditor()};
function renderEditor(){
 const m=getMap(adminMap);byId('adminMapSelect').value=adminMap;byId('adminMapImage').src=m.src;byId('adminMapImage').alt=m.name;
 const stage=byId('adminStage');stage.classList.toggle('drawing',Boolean(drawMode));stage.classList.toggle('campus-canvas',adminMap==='campus');
 byId('drawGuide').textContent=drawMode?(drawMode.includes('safety-point')?'安全設備：図面上の位置を1回タップしてください。':drawMode.includes('safety-route')?'避難経路：開始地点から終了地点までドラッグしてください。':`${drawMode==='new'?'新しい会場':'位置の再指定'}：図面上で教室の枠をドラッグして囲んでください。`):'登録済みの会場または安全情報をタップすると編集できます。';
 const zones=state.zones.filter(z=>z.mapId===adminMap);
 byId('adminZoneLayer').innerHTML=zones.map(z=>zoneHtml(z,false,z.id===editId)).join('')+(editDraft&&editDraft.mapId===adminMap&&!zones.some(z=>z.id===(editId||editDraft.id))?zoneHtml(editDraft,false,true):'');
 byId('adminSafetyLayer').innerHTML=safetyOverlayHtml(adminMap,true);
 $$('#adminZoneLayer [data-zone]').forEach(el=>{el.onclick=()=>selectZone(el.dataset.zone);});
 $$('#adminSafetyLayer [data-safety]').forEach(el=>{el.onclick=e=>{e.stopPropagation();selectSafety(el.dataset.safety);};});
 byId('mapZoneList').innerHTML=zones.length?zones.map(z=>`<button type="button" class="${z.id===editId?'current':''}" data-list-zone="${esc(z.id)}"><b>${esc(z.name)}</b><small>${esc(z.id)}</small></button>`).join(''):'<p class="muted">まだ登録はありません。</p>';
 $$('[data-list-zone]').forEach(b=>b.onclick=()=>selectZone(b.dataset.listZone));
 renderEditForm();renderSafetyAdmin();
}
function selectZone(id){const z=getZone(id);if(!z)return;drawMode='';selectedSafetyId='';editDraft=clone(z);editId=z.id;renderEditor()}
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
byId('newVenue').onclick=()=>{selectedSafetyId='';editId='';editDraft=null;drawMode='new';renderEditor()};
byId('redrawVenue').onclick=()=>{if(!editDraft){toast('先に会場を選んでください');return;}drawMode='redraw';renderEditor()};
byId('cancelDrawing').onclick=()=>{drawMode='';editDraft=null;editId='';selectedSafetyId='';renderEditor()};
const drawLayer=byId('drawLayer');
function pointOf(e){const box=byId('adminStage').getBoundingClientRect();return {x:bound((e.clientX-box.left)/box.width*100,0,100),y:bound((e.clientY-box.top)/box.height*100,0,100)}}
function rectFrom(a,b){let x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);return{x:+x.toFixed(2),y:+y.toFixed(2),w:+w.toFixed(2),h:+h.toFixed(2)}}
function drawPreview(rect){drawLayer.innerHTML=`<div class="draw-preview" style="${zStyle(rect)}"></div>`}
function drawRoutePreview(a,b){drawLayer.innerHTML=`<svg class="draw-route-preview" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" /></svg>`}
drawLayer.addEventListener('pointerdown',e=>{if(!drawMode)return;e.preventDefault();dragStart=pointOf(e);dragRect=null;drawLayer.setPointerCapture(e.pointerId);if(drawMode.includes('route'))drawRoutePreview(dragStart,dragStart);else if(!drawMode.includes('safety-point'))drawPreview({...dragStart,w:.1,h:.1});});
drawLayer.addEventListener('pointermove',e=>{if(!dragStart)return;e.preventDefault();const p=pointOf(e);if(drawMode.includes('route'))drawRoutePreview(dragStart,p);else if(!drawMode.includes('safety-point')){dragRect=rectFrom(dragStart,p);drawPreview(dragRect);}});
function finishDraw(e){if(!dragStart)return;const end=pointOf(e),mode=drawMode,start=dragStart;dragStart=null;drawLayer.innerHTML='';
 if(mode==='safety-point-new'||mode==='safety-point-redraw'){
  if(mode==='safety-point-new'){const type=byId('safetyAddType').value;const def=SAFETY_TYPES[type]||SAFETY_TYPES.extinguisher;const it={id:newSafetyId(),mapId:adminMap,kind:'point',type,label:def.label,x:+end.x.toFixed(2),y:+end.y.toFixed(2)};state.safetyItems.push(it);selectedSafetyId=it.id;}
  else {const it=getSafety(selectedSafetyId);if(it){it.x=+end.x.toFixed(2);it.y=+end.y.toFixed(2);}}
  drawMode='';persist();renderEditor();renderPublic();toast('安全設備の位置を保存しました');return;
 }
 if(mode==='safety-route-new'||mode==='safety-route-redraw'){
  const dist=Math.hypot(end.x-start.x,end.y-start.y);if(dist<1){drawMode='';renderEditor();toast('避難経路は少し長めにドラッグしてください');return;}
  if(mode==='safety-route-new'){const it={id:newSafetyId(),mapId:adminMap,kind:'route',type:'route',label:'避難経路',x1:+start.x.toFixed(2),y1:+start.y.toFixed(2),x2:+end.x.toFixed(2),y2:+end.y.toFixed(2)};state.safetyItems.push(it);selectedSafetyId=it.id;}
  else {const it=getSafety(selectedSafetyId);if(it){Object.assign(it,{x1:+start.x.toFixed(2),y1:+start.y.toFixed(2),x2:+end.x.toFixed(2),y2:+end.y.toFixed(2)});}}
  drawMode='';persist();renderEditor();renderPublic();toast('避難経路を保存しました');return;
 }
 const r=rectFrom(start,end);if(r.w<.9||r.h<.9){toast('枠をもう少し大きくドラッグしてください');return}
 if(mode==='new'){editDraft={id:newId(adminMap),mapId:adminMap,name:'新しい会場',note:'',kind:'classroom',...r};editId='';}
 else if(mode==='redraw'&&editDraft){Object.assign(editDraft,r)}
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

function newSafetyId(){let n=Math.max(1,Number(state.nextSafetyId)||1),id='';do{id=`SAFE-${String(n).padStart(2,'0')}`;n++;}while(getSafety(id));state.nextSafetyId=n;return id;}
function selectSafety(id){const it=getSafety(id);if(!it)return;drawMode='';editId='';editDraft=null;selectedSafetyId=id;renderEditor();}
function safetyKindLabel(it){return it.kind==='route'?'避難経路':(SAFETY_TYPES[it.type]?.label||'安全設備');}
function renderSafetyAdmin(){
 const items=(state.safetyItems||[]).filter(it=>it.mapId===adminMap);
 const selected=getSafety(selectedSafetyId);
 byId('safetyItemList').innerHTML=items.length?items.map(it=>`<button type="button" class="${it.id===selectedSafetyId?'current':''}" data-safety-list="${esc(it.id)}"><b>${esc(it.label||safetyKindLabel(it))}</b><small>${esc(safetyKindLabel(it))}｜${esc(it.id)}</small></button>`).join(''):'<p class="muted">この図には安全情報がまだ登録されていません。</p>';
 $$('[data-safety-list]').forEach(b=>b.onclick=()=>selectSafety(b.dataset.safetyList));
 const area=byId('safetyEditArea');if(!selected||selected.mapId!==adminMap){area.innerHTML='<p class="muted">追加後、地図上の安全マークや一覧を選ぶと編集できます。</p>';return;}
 if(selected.kind==='route')area.innerHTML=`<div class="safety-edit-box"><label>表示名<input id="safetyLabel" maxlength="60" value="${esc(selected.label||'避難経路')}"></label><div class="four-cols"><label>開始X %<input id="safetyX1" type="number" min="0" max="100" step="0.1" value="${Number(selected.x1).toFixed(1)}"></label><label>開始Y %<input id="safetyY1" type="number" min="0" max="100" step="0.1" value="${Number(selected.y1).toFixed(1)}"></label><label>終了X %<input id="safetyX2" type="number" min="0" max="100" step="0.1" value="${Number(selected.x2).toFixed(1)}"></label><label>終了Y %<input id="safetyY2" type="number" min="0" max="100" step="0.1" value="${Number(selected.y2).toFixed(1)}"></label></div><div class="row-actions"><button type="button" class="btn primary" id="saveSafety">保存</button><button type="button" class="btn light" id="redrawSafety">経路を描き直す</button><button type="button" class="btn danger" id="deleteSafety">削除</button></div></div>`;
 else area.innerHTML=`<div class="safety-edit-box"><label>種類<select id="safetyTypeEdit">${Object.entries(SAFETY_TYPES).map(([k,d])=>`<option value="${k}" ${selected.type===k?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label><label>表示名<input id="safetyLabel" maxlength="60" value="${esc(selected.label||safetyKindLabel(selected))}"></label><div class="four-cols"><label>左位置 %<input id="safetyX" type="number" min="0" max="100" step="0.1" value="${Number(selected.x).toFixed(1)}"></label><label>上位置 %<input id="safetyY" type="number" min="0" max="100" step="0.1" value="${Number(selected.y).toFixed(1)}"></label></div><div class="row-actions"><button type="button" class="btn primary" id="saveSafety">保存</button><button type="button" class="btn light" id="redrawSafety">位置を指定し直す</button><button type="button" class="btn danger" id="deleteSafety">削除</button></div></div>`;
 byId('saveSafety').onclick=()=>{const it=getSafety(selectedSafetyId);if(!it)return;it.label=byId('safetyLabel').value.trim()||safetyKindLabel(it);if(it.kind==='route'){it.x1=bound(byId('safetyX1').value,0,100);it.y1=bound(byId('safetyY1').value,0,100);it.x2=bound(byId('safetyX2').value,0,100);it.y2=bound(byId('safetyY2').value,0,100);}else{it.type=byId('safetyTypeEdit').value;it.x=bound(byId('safetyX').value,0,100);it.y=bound(byId('safetyY').value,0,100);}persist();renderEditor();renderPublic();toast('安全情報を保存しました');};
 byId('redrawSafety').onclick=()=>{const it=getSafety(selectedSafetyId);if(!it)return;drawMode=it.kind==='route'?'safety-route-redraw':'safety-point-redraw';renderEditor();toast(it.kind==='route'?'地図上で避難経路をドラッグしてください':'地図上で新しい位置をタップしてください');};
 byId('deleteSafety').onclick=()=>{const it=getSafety(selectedSafetyId);if(!it||!confirm(`「${it.label||safetyKindLabel(it)}」を削除しますか？`))return;state.safetyItems=state.safetyItems.filter(x=>x.id!==it.id);selectedSafetyId='';persist();renderEditor();renderPublic();toast('安全情報を削除しました');};
}
byId('addSafetyPoint').onclick=()=>{editId='';editDraft=null;selectedSafetyId='';drawMode='safety-point-new';renderEditor();toast('地図上で安全設備の位置をタップしてください');};
byId('addSafetyRoute').onclick=()=>{editId='';editDraft=null;selectedSafetyId='';drawMode='safety-route-new';renderEditor();toast('地図上で避難経路の開始地点から終了地点までドラッグしてください');};

function roomOptions(sel){return `<option value="">（会場未登録）</option>`+state.zones.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(z=>`<option value="${esc(z.id)}" ${z.id===sel?'selected':''}>${esc(z.id)}｜${esc(z.name)}</option>`).join('')}
function sessionOptions(sel){return SESSION_IDS.map(id=>`<option value="${id}" ${id===sel?'selected':''}>${esc(sessionLabel(id))}（${esc(sessionDef(id).start)}〜${esc(sessionDef(id).end)}）</option>`).join('')}
function sessionProgramsForVenue(zoneId){return orderedPrograms().filter(p=>p.zoneId===zoneId&&SESSION_IDS.includes(p.session))}
function hasDuplicateVenueSession(program){return state.programs.some(p=>p.id!==program.id&&p.zoneId===program.zoneId&&p.session===program.session&&SESSION_IDS.includes(p.session))}
function parseCsvRows(text){
 const rows=[];let row=[],cell='',quoted=false;
 const src=String(text||'').replace(/^\uFEFF/,'');
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(quoted){if(ch==='"'&&src[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}
  if(ch==='"'){quoted=true;continue;}if(ch===','){row.push(cell);cell='';continue;}
  if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';continue;}cell+=ch;
 }
 if(cell!==''||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows;
}
function normalizeCsvSession(v){const x=String(v||'').trim().replace(/^セッション/,'');const m={'①':'s1','1':'s1','s1':'s1','②':'s2','2':'s2','s2':'s2','③':'s3','3':'s3','s3':'s3','④':'s4','4':'s4','s4':'s4'};return m[x]||'';}
function csvTimeValid(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||'').trim());}
async function readCsvFile(file){const buf=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buf);if(text.includes('�')){try{const sjis=new TextDecoder('shift_jis').decode(buf);if((sjis.match(/�/g)||[]).length<(text.match(/�/g)||[]).length)text=sjis;}catch{}}return text;}
// Ver.1.38: OFES専用Excelの「プログラム入力」タブを直接読み込む。
// Excelのプルダウンと説明タブはそのまま維持し、CSVへの保存操作を不要にする。
async function readProgramExcel(file){
 if(typeof JSZip==='undefined')throw Error('Excel読込ライブラリが読み込まれていません。ページを再読み込みしてください。');
 if(file.size>8*1024*1024)throw Error('Excelファイルのサイズは8MB以下にしてください。');
 let zip;
 try{zip=await JSZip.loadAsync(await file.arrayBuffer());}catch{throw Error('Excelファイルを開けませんでした。OFESのExcel入力様式（.xlsx）を使用してください。');}
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 async function loadXml(path,limit){
  const ent=zip.file(path);if(!ent)throw Error(`Excel内の必要なデータが見つかりません（${path}）。`);
  const text=await ent.async('string');if(text.length>limit)throw Error('Excelのデータ量が多すぎます（最大300件程度）。');
  const xml=new DOMParser().parseFromString(text,'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw Error('Excelの内部形式を読み取れませんでした。');
  return xml;
 }
 // 本アプリの専用テンプレートは先頭シートにプログラム入力を格納する。
 const wb=await loadXml('xl/workbook.xml',1000000);
 const first=wb.getElementsByTagNameNS(ns,'sheet')[0];
 if(first?.getAttribute('name')!=='プログラム入力')throw Error('「プログラム入力」が先頭タブのOFES専用Excel様式を使用してください。');
 const doc=await loadXml('xl/worksheets/sheet1.xml',3000000);
 let shared=[];
 if(zip.file('xl/sharedStrings.xml')){
  const sharedDoc=await loadXml('xl/sharedStrings.xml',1500000);
  shared=[...sharedDoc.getElementsByTagNameNS(ns,'si')].map(si=>[...si.getElementsByTagNameNS(ns,'t')].map(t=>t.textContent||'').join(''));
 }
 const data=doc.getElementsByTagNameNS(ns,'sheetData')[0];
 if(!data)throw Error('「プログラム入力」タブの入力欄が見つかりません。');
 const out=[];
 for(const row of [...data.getElementsByTagNameNS(ns,'row')]){
  const rowNumber=Number(row.getAttribute('r'))||0;
  if(rowNumber<1||rowNumber>301)continue;
  const fields=Array(11).fill('');
  for(const cell of [...row.getElementsByTagNameNS(ns,'c')]){
   const address=cell.getAttribute('r')||'';
   const match=/^([A-Z]+)\d+$/.exec(address);if(!match)continue;
   const colIndex=[...match[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
   // Ver.1.38: J/K are optional manually entered times for non-session items.
   if(colIndex<0||colIndex>=11)continue;
   const type=cell.getAttribute('t')||'';
   const raw=cell.getElementsByTagNameNS(ns,'v')[0]?.textContent||'';
   let val=type==='s'?shared[Number(raw)]||'':type==='inlineStr'?
     [...cell.getElementsByTagNameNS(ns,'t')].map(x=>x.textContent||'').join(''):raw;
   if((colIndex===2||colIndex===3||colIndex===9||colIndex===10)&&val!==''&&/^\d*\.\d+$/.test(val)){
    // Excelが時刻を1日の小数値で保存した場合は HH:MM に戻す。
    const minutes=Math.round((Number(val)%1)*1440)%1440;
    val=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
   }
   fields[colIndex]=String(val||'').trim();
  }
  if(rowNumber!==1 && ['午前','午後','その他'].includes(fields[0])){
   // Use the explicitly typed J/K values even when Excel has no formula result cache.
   // Old template remains compatible: if J/K are empty, retain C/D.
   if(fields[9])fields[2]=fields[9];
   if(fields[10])fields[3]=fields[10];
  }
  if(rowNumber===1||fields.some(x=>x!==''))out.push(fields);
 }
 if(!out.length||out[0][0]!=='種別')throw Error('入力タブの見出しが見つかりません。OFES専用のExcel様式をお使いください。');
 if(out.length<2)throw Error('Excelにプログラムが入力されていません。');
 return out.map(fields=>fields.slice(0,9).map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\r\n');
}
async function readProgramImportFile(file){
 const name=String(file.name||'').toLowerCase();
 if(name.endsWith('.xlsx'))return readProgramExcel(file);
 if(name.endsWith('.csv'))return readCsvFile(file);
 throw Error('Excel（.xlsx）またはCSV（.csv）ファイルを選んでください。');
}
// Ver.1.36: 会場名を選ぶExcel入力用の表示名を生成する。
// 同名会場だけ図面名を付け、同一図面にも同名がある場合は番号で区別する。
function programVenueChoices(){
 const zones=state.zones.filter(z=>z&&z.id&&String(z.name||'').trim())
  .slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ja')||String(a.id).localeCompare(String(b.id),'ja'));
 const names=new Map();zones.forEach(z=>{const n=String(z.name).trim();names.set(n,(names.get(n)||0)+1)});
 const used=new Map();
 return zones.map(z=>{
  const name=String(z.name).trim(),map=MAPS.find(m=>m.id===z.mapId)?.name||'配置図未設定';
  const base=names.get(name)>1?`${name}（${map}）`:name;
  const order=(used.get(base)||0)+1;used.set(base,order);
  return {id:z.id,name,label:order===1?base:`${base}・${order}`};
 });
}
function resolveCsvVenue(raw){
 const val=String(raw||'').trim();if(!val)return {id:''};
 const byId=state.zones.find(z=>z.id===val);if(byId)return {id:byId.id}; // 旧CSV互換
 const choices=programVenueChoices();
 const option=choices.find(z=>z.label===val);if(option)return {id:option.id};
 const named=choices.filter(z=>z.name===val);
 if(named.length===1)return {id:named[0].id};
 if(named.length>1)return {error:`会場名「${val}」が複数あります。Excelを再ダウンロードして、図面名付きの候補を選択してください。`};
 return {error:`会場「${val}」が登録されていません。会場・配置図を確認し、必要に応じてExcelを再ダウンロードしてください。`};
}
// Excel入力テンプレート本体（オフラインでも生成可能）
const OFES_EMBEDDED_PROGRAM_XLSX='UEsDBBQAAAAIAMEZZV1flH2RJwEAAFoCAAAPAAAAeGwvd29ya2Jvb2sueG1stdJBS8MwFAfwr1Jyd0mzduvKul28ePUbZGmyhjVJSTLt1RUvO3hVFEQEQcWJR79P6ZjfQtxkG5687PZ4/Hn84P/6w1Lm3hkzVmiVAL+FgMcU1alQ4wRMHT+KwHDQL+NzbSYjrSdeKXNl4zIBmXNFDKGlGZPEtnTBVClzro0kzra0GUNbGEZSmzHmZA4xQh0oiVDg5956a7eTp4hkCair67pa1LOPunqpq4fm8qmZ3wFvHTlJE+ADz8QiTcApDtrU7+IAcYqDHgnBL8z8B6Y5F5QdazqVTLmNzLCcOKGVzURhgQf/0jaW1evb8uZqT4R3oi5HKSJkFPZo4Ef44KKvi8/l/H41e1w9L5r32z1Ue4uKumHU60SdkOMo4Gh0ABTclQl3fzL4BlBLAwQUAAAACADBGWVdBuY1B1oEAABoUAAADQAAAHhsL3N0eWxlcy54bWztnEtzmzAQx78Kw70x4u1MaUtsa6aXXtpDr8SWbWaE5AGSkn76Di+bpKWxU1aL7ebCI+jPT6vVrgRY7z8WCdceWZrFUgQ6uTF0jYmlXMViE+gP+fqdr3/88L64zfInzr5uGcu1IuEiuy0CfZvnu9vJJFtuWRJlN3LHRJHwtUyTKM9uZLqZZLuURausLJbwiWkY7iSJYqGXiuIhoUmeaUv5IPJANzsntXrzeRXopmHoWi05kysW6NvtbZLo2qTnavL86k/VlZP93cpSaykOtyWO3p6rqvlTe4x4oBPS3iJKWH1qFqU8zmUr2JZot/f19b8JLCWXqZZu7gOdNn+nSu81jT9pEs8KHfdfcd3hcF9Km3DSBM4gDhy1AeAaA1riFU3LnrkhTMO59vR06b9rmo4V2ndAfmZTyx26Mzu2bQzcYgubetPjNJudOk7GnB/Cs1HHyZjzcruL8pylgsaca83+t6cdC3QhBdtLNhe/WmiTRk/EdE4ul0ker2quzexZlaf2zLNavU75gfTplN7ROZz+glKHhoD6PrWbYANjH0rtOaR9QmrRKZy+6TgLn4Dapw32QO27mFNI/7eoB+mf1KQO9eH0SeiGvgfIb1CPzuD05/7Cg7QPpdSB7L9za+HPIeNbSN0FbPwh9O7v+s1OlUrvZbpi6Yu5Tn2yTsuH/cn+6iqRM86/llOv7+vDlKUqXaw7855qjiT2uzHnzW4t1RzU6l3J9hZddWK+Vb9YH250ugDpCES7HX/68pDcs5RWs7nq39VZKkX3KOb8cHRXiVXHxyKYfXUARiDXglAdhzzeiIQdvDdqT2hbmcY/pcjLIemSiZylraMW6/Okf2RpHi9PrU+fTyrsFuRaEFT7JDl/n7SQgpSJj9BnBYJvBRwEG98XbHwrOPhWcPCt4OJbwVVpheZ9BG5wOgpCoT9Y+INZNQivpd63pdk+9hG0oNqRyz+PUjz8aHTZCK+14I802n1jRS11TOONA/t3xzu5In1eiJOWLxtBmReSM/ZCHykQ2deCAJ7NfKRObF8LAngLTvEHA5eNAJkJELGHzQRT/MHAZSMo80Jyxl5YfvCEEomcETD02oGMwA44b17Lj9WwM9OlM0AGJkzugSMTwc9Ol86gzhPPLke6+E/P1SDATLf62BX2ITUI4LPVsb3RPJ9c6FxKKhzBG2VABGUugN3xT66Ih//QVg0CTBDtY1fYg9QggOcgrG+LfHyEPisQfCvgIGCNR/oQcJ6TuPhWwELoswKOO2IhdJ9UYE0Q/REw9NoBxx3GwID1cu+YHwEp9AasL8PJCBi6dsAauUxHwKCoLQafQiqy3eDcakIAJHa5xAeOq14TBGgLYg1MyzcOOBDNCkfYGD2BF/ET3uF+9VYO7P7XCK9Gx0WEvt/AEKXPL59RlOMOLAwyBoyeKI01SynHU1cDEb0tzzYLQnTWgqjWhnix2MT+vFauHxXoX0pG/nzFh+7SEll1eFgz8MMvUEsDBBQAAAAIAMEZZV36XAFZAwMAANoNAAATAAAAeGwvdGhlbWUvdGhlbWUxLnhtbL1X23KbMBT8FUbvDTdz84RkEsduH9Jpp8kPyCBAjRAeSY6dv+8gbgKM4zR27AdLYs/ZReewwte3+5xor4hxXNAQmFcG0BCNihjTNARbkXzzwe3NNZyLDOVIozBHIVhkUHz//Qy0fU4on8MQZEJs5rrOowzlkF8VG0T3OUkKlkPBrwqW6jGDO0zTnOiWYbh6DjEFbd4lQTmigpcLEWFP0QGy8lr8YpY//I0vCNNeIQnBDtO42D2jvQAagVwsCAuBIT9A02+u9TaKiIlgJXAlP01gHRG/WDKQpes20lha/szsGCSCiDFw6ZffLqNEwChCtJajgk3HNXyrASuoangge+CZ9iBAYbDHDIF7b836ARJVDWfjG10FywenHyBR1dAZBdwZ1n1g9wMkqhq6o4DZ8s6zlv0AicoIpi9juOv5vtvAW0xSkB8H8YHrGt5Dg+9gutJqVQIqeo33K0lwhGTf5fBvwVYFFbLKUGCqibcNSmBUNigkeM2w9ojTTEgeOEfwHUDEjwL0AWeO6bsCjlAfIW3pOgZd3Qy5NbmYfCQTTMiTeCPokUtxvCA4XmFC5ERGtaXYZAvCGsIeMGWwG/M6Vcq1TcFDYIDJXNJBMBXVmus1Tz2ck23+s4jrpjdbO4BzDkV3wXAUn2gZ5CzlqoYSd7IOz57Q0dENddgn6pB3crIQ3/ywkOCoEF0pD8FUg+Up4cxqu+URJCguC1Yn6JX1LCUOZlN3ZH12a08oMc9gjJq8xpSSqWbruvAMRVakeP5hJUEwIaTcqksUWR/bAaH9mbYr+b3m7v7LLDaMiwfIswonL7XnK1VoAsP5Ahqr3JnL0ejDPURJgiIxsdJNH7mosxy8/Fl0OSm2ArGnLN5pa7Jlf2AcAsczHQNoMeaiKYAWY9a1z/j9oluHZJPB2sl7D22Fl+OWUxEr5Qyl9+e14nW6Ostx9X7UwLWm7NabfhIvcD4Gyrmk+Efgf9RTK6s897Gp6lDlTRqtPSHPvpDRdl35dYY6bNnSY5vXMTkb/IFqVm7+AVBLAwQUAAAACADBGWVdDR656GUAAABzAAAAFAAAAHhsL3NoYXJlZFN0cmluZ3MueG1sBcFRCsMgDADQq0j+Z9w+xpDankXatAomFpMNj7/3lm1ycz8aWrskePoAjmTvR5UrwdfOxwe2dZlR1dzkJhpngmJ2R0TdC3FW32+Sye3sg7Op7+NCvQflQwuRccNXCG/kXAUcrn9QSwMEFAAAAAgAwRllXYn9wNxMRgAAeeICABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWy1nW2vpclZnf9K52gkbGni2e8vI9rI3t62az+BIAeRfG1mejwjZqYn3cf2kE+xRyDzYgmjiAgUEiAhICGsRCFKwBb5L243Np/4C9Ha7rvqnPtZq6tuVPWJmjW1u9ZUXWOk+zqzz8/+3McfvP/g64+fPnvvyYcPb5afWdw8ePzhW0/efu/Drz68+drtO//8cPNzn/3Zj9/8xpOnv/rs3cePbx98/MH7Hz578+OHN+/e3n705htvPHvr3ccfPHr2mScfPf7w4w/ef+fJ0w8e3T77zJOnX33j2UdPHz96+/qxD95/Y7VY7N744NF7H97gD7ymv/ze4288u/dXD3DQrzx58qv4i/T2w5vFdfdHjz58/ODX/tVH7793+/BmefPg9slH/+LxO7enx++///Dmc6ubB4/eun3v649/8dGHjx/e/MqT29snH+Dv3zx4dvvo9vHDm3eePvl3jz+8efDGZ3/2jTun3f+r0uSL13+IX3z64O3H7zz62vu3X3nyjS8/fu+r7+Lw7fVP+fjNt568f/3AW0/ef/DBe7i8mwcfPPr4+n+/8d7bt+8+vFnubh68+97bbz/+EP8cD9762rPbJx/865d/r/wxP/346uXHV+Xj28DH1y8/vv6nnb55+fHNP+3j25cf3+aPr1eBj+9efnyXP76K/LPvX358Xz6+Dnz88PLjh/zxTeSf/fjy48f88W3kn325MG4WpX7k/GUGbxn4A94oBF+R/8Kj20f4i6dPvvHg6XUTaF8f7MOZ/+u/j29hz+eWNw+eXd/89uHNs9un17/z9c/++C++9+Lbf4YDvv7TY/IHPs8/8Pxb33/+ySfPv/V/nn/y588/+V/sk6effnK58J/9h9//7Rd//tt//wffevHt77MPfkF98Mf/+1s/+tvf0B88864/+sEfvvjjv37xu99hn/miuJA/+Nuf/MlfvPir//7ib/6afexLr/rY82/9j+ef/OXzT37w/JP/yD785Vee+Ru//uJ7f8M+lvjHXvz67/74L//sx//hv7z4u9978bvf+ccffPvFf/vzn/zP30L5//R7z7/5veff/H//+IPfZH/i5ad/4vHo/8h//9svvv1nd98Jf+p3vv3iN7/z/JPvY/F3v/P8k+8//+YfPf/m9370/d8Xf/z0yj/+7mvG/vg3rsjfIR//7t4+vFltXkX+6qdUbezfxSvdLDy9DBeHe73f+Wz64qde+9zq4Y2D/+b19MXzV77yL7/yqfQLXzj/m0/9zD988//+/W/95598609/8hd/9eJ7f/gz/+y1L7+2efO1L7+2f/3nP/dLpy9/6rXPr14nu76EXV96bf/64tOffv3m5tOv48DL6uHNzes3N6+/dll9+tP4Z3/H//vSv29Ck/RP6jvlvpPoe37Zd3f30r/4MjzcDb/0Msz/+3n9t4eFiYUXu5jV3XS6n85g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';
// ブラウザ内でXLSXを編集し、ダウンロード時点の下書きの会場名をプルダウン候補へ埋め込む。
async function downloadProgramExcel(event){
 event.preventDefault();
 const choices=programVenueChoices();
 if(!choices.length){alert('登録済み会場がありません。先に「会場・配置図」で会場を登録・保存してください。');return;}
 if(choices.length>300){alert('会場は300件まで自動反映できます。件数を確認してください。');return;}
 const btn=byId('downloadProgramXlsx');const old=btn.textContent;
 btn.setAttribute('aria-disabled','true');btn.style.pointerEvents='none';btn.textContent='会場名を反映しています…';
 try{
  if(typeof JSZip==='undefined')throw Error('Excel編集ライブラリを読み込めませんでした。ページを再読み込みしてお試しください。');
  // Ver.1.39: テンプレートはapp.jsに同梱。公開先のパス違いやファイル未配置でのHTTP 404を防ぐ。
  // 更新時はapp.jsとassets/vendor/jszip.min.jsを上書きすれば生成できます。
  const templateBytes=Uint8Array.from(atob(OFES_EMBEDDED_PROGRAM_XLSX),ch=>ch.charCodeAt(0));
  const zip=await JSZip.loadAsync(templateBytes);
  const sheetPath='xl/worksheets/sheet3.xml';
  const sheetFile=zip.file(sheetPath);if(!sheetFile)throw Error('Excel様式の選択肢設定タブが見つかりません。');
  const sheetText=await sheetFile.async('string');
  const xml=new DOMParser().parseFromString(sheetText,'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw Error('Excel様式の解析に失敗しました。');
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const sheetData=xml.getElementsByTagNameNS(ns,'sheetData')[0];
  if(!sheetData)throw Error('Excelの入力欄が見つかりません。');
  const rows=new Map([...sheetData.getElementsByTagNameNS(ns,'row')].map(el=>[Number(el.getAttribute('r')),el]));
  function setText(rowNumber,col,value){
   const row=rows.get(rowNumber);if(!row)throw Error(`Excel様式に${rowNumber}行目がありません。`);
   const addr=`${col}${rowNumber}`;
   let cell=[...row.getElementsByTagNameNS(ns,'c')].find(x=>x.getAttribute('r')===addr);
   if(!cell){cell=xml.createElementNS(ns,'x:c');cell.setAttribute('r',addr);row.appendChild(cell);}
   while(cell.firstChild)cell.removeChild(cell.firstChild);
   cell.setAttribute('t','inlineStr');
   const inline=xml.createElementNS(ns,'x:is');const t=xml.createElementNS(ns,'x:t');t.textContent=value;inline.appendChild(t);cell.appendChild(inline);
  }
  for(let i=0;i<choices.length;i++){
   setText(i+4,'C',choices[i].label); // ExcelではIDではなく会場名を選ぶ
   setText(i+4,'E',choices[i].id); // 確認用のID（CSVには含まれない）
  }
  // Ver.1.38: Copy the current 4 session windows from management settings.
  // Excel's C/D formulas look these up when the user chooses a session number.
  SESSION_IDS.forEach((sid,i)=>{
   const schedule=sessionDef(sid);
   setText(i+4,'G',['①','②','③','④'][i]);
   setText(i+4,'H',schedule.start);
   setText(i+4,'I',schedule.end);
  });
  zip.file(sheetPath,new XMLSerializer().serializeToString(xml));
  const blob=new Blob([await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`OFES_${state.year}年度_プログラム入力_会場名選択.xlsx`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  toast(`登録済み会場 ${choices.length}件とセッション時間をExcelへ反映しました`);
 }catch(err){console.error(err);alert(`Excel入力様式を作成できませんでした。${err.message||err}`);}
 finally{btn.removeAttribute('aria-disabled');btn.style.pointerEvents='';btn.textContent=old;}
}
function parseProgramCsv(text,mode){
 const rows=parseCsvRows(text);const headerAt=rows.findIndex(r=>String(r[0]||'').trim()==='種別');
 if(headerAt<0)throw Error('「種別」から始まる見出し行が見つかりません。OFESのCSV様式を使用してください。');
 const headers=rows[headerAt].map(x=>String(x||'').trim());
 const required=['種別','セッション','開始時刻','終了時刻','発表学年','発表グループ','発表内容','児童生徒名（大豊学園のみ）'];
 for(const h of required)if(!headers.includes(h))throw Error(`必要な列「${h}」がありません。`);
 const venueCol=headers.includes('会場名')?'会場名':headers.includes('会場ID')?'会場ID':null;
 if(!venueCol)throw Error('必要な列「会場名」または「会場ID」がありません。');
 const idx=Object.fromEntries(headers.map((h,i)=>[h,i])),out=[],errors=[];
 const existing=mode==='append'?[...state.programs]:[];
 const seen=new Set(existing.filter(p=>SESSION_IDS.includes(p.session)&&p.zoneId).map(p=>`${p.zoneId}|${p.session}`));
 for(let ri=headerAt+1;ri<rows.length;ri++){
  const r=rows[ri],first=String(r[0]||'').trim();if(!r.some(x=>String(x||'').trim())||first.startsWith('#'))continue;
  const type=String(r[idx['種別']]||'').trim(),sessionRaw=String(r[idx['セッション']]||'').trim(),start=String(r[idx['開始時刻']]||'').trim(),end=String(r[idx['終了時刻']]||'').trim();
  const rawVenue=String(r[idx[venueCol]]||'').trim(),grade=String(r[idx['発表学年']]||'').trim(),group=String(r[idx['発表グループ']]||'').trim(),title=String(r[idx['発表内容']]||'').trim(),presenters=String(r[idx['児童生徒名（大豊学園のみ）']]||'').trim();
  const line=ri+1;if(!title){errors.push(`${line}行目：発表内容が空欄です。`);continue;}
  const resolved=resolveCsvVenue(rawVenue);
  if(resolved.error){errors.push(`${line}行目：${resolved.error}`);continue;}
  const zoneId=resolved.id;
  let session='';
  if(type==='セッション'){
   session=normalizeCsvSession(sessionRaw);
   if(!session){errors.push(`${line}行目：セッションは①〜④を入力してください。`);continue;}
   if(!zoneId){errors.push(`${line}行目：セッションの会場名が空欄です。`);continue;}
   const key=`${zoneId}|${session}`;
   if(seen.has(key)){errors.push(`${line}行目：${rawVenue} の ${sessionLabel(session)} はすでに登録されています。`);continue;}
   seen.add(key);const d=sessionDef(session);
   out.push({id:`p${Date.now()}-${ri}`,reactionId:'',session,start:d.start,end:d.end,grade,group,title,zoneId,presenters});
  }
  else if(type==='午前'||type==='午後'||type==='その他'){
   // 午前は「セッション以外の午前行事」として、従来のその他と同じ時刻順で扱う。
   session=type==='午後'?'afternoon':'other';
   if(!csvTimeValid(start)||!csvTimeValid(end)){errors.push(`${line}行目：開始時刻・終了時刻を HH:MM で入力してください。`);continue;}
   if(timeNum(end)<=timeNum(start)){errors.push(`${line}行目：終了時刻は開始時刻より後にしてください。`);continue;}
   out.push({id:`p${Date.now()}-${ri}`,reactionId:'',session,start,end,grade,group,title,zoneId,presenters});
  }
  else errors.push(`${line}行目：種別は「セッション」「午前」「午後」「その他」のいずれかを入力してください。`);
 }
 if(errors.length)throw Error(`入力データに修正が必要な箇所があります。\n${errors.slice(0,12).join('\n')}${errors.length>12?`\nほか ${errors.length-12}件`:''}`);
 if(!out.length)throw Error('読み込めるプログラムがありません。');return out;
}

function renderAdminPrograms(){
 if(!adminProgramVenue || !state.zones.some(z=>z.id===adminProgramVenue))adminProgramVenue=state.zones[0]?.id||'';
 const selectedZone=getZone(adminProgramVenue);
 const venuePrograms=selectedZone?sessionProgramsForVenue(selectedZone.id):[];
 const unassigned=orderedPrograms().filter(p=>!p.zoneId&&SESSION_IDS.includes(p.session));
 const other=orderedPrograms().filter(p=>!SESSION_IDS.includes(p.session));
 byId('adminPrograms').innerHTML=`
 <div class="editor-card program-step-card"><div class="step-title"><span>1</span><div><h3>セッション①〜④の時間帯</h3><p class="muted">ここで設定した時間が、同じセッションを選んだすべての会場に共通で適用されます。</p></div></div>
 <div class="session-time-grid">${SESSION_IDS.map(id=>{const d=sessionDef(id);return `<div class="session-time-row" data-session-setting="${id}"><strong>${esc(d.label)}</strong><label>開始<input type="time" data-session-time="start" value="${esc(d.start)}"></label><label>終了<input type="time" data-session-time="end" value="${esc(d.end)}"></label></div>`}).join('')}</div></div>
 <div class="editor-card program-step-card"><div class="step-title"><span>2</span><div><h3>会場ごとの発表登録</h3><p class="muted">会場を選び、セッション・発表学年（複数可）・発表グループ・発表内容を登録します。開始・終了時刻は上の設定から自動で入ります。</p><p class="caption">発表学年は「7年生・8年生」「7・8年生」「6〜9年生」のように入力できます。児童生徒名は専用欄へ入力し、一般来場者には表示しません。</p></div></div>
 <label class="venue-program-selector">会場<select id="programVenueSelect">${state.zones.length?state.zones.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(z=>`<option value="${esc(z.id)}" ${z.id===adminProgramVenue?'selected':''}>${esc(z.id)}｜${esc(z.name)}</option>`).join(''):'<option value="">先に会場を登録してください</option>'}</select></label>
 <div class="venue-program-editor">${selectedZone?`<div class="venue-program-admin-heading"><strong>${esc(selectedZone.name)}</strong><span>${esc(selectedZone.id)}</span></div>${venuePrograms.length?venuePrograms.map(p=>adminVenueProgramRow(p)).join(''):'<p class="muted">この会場には、まだ発表が登録されていません。</p>'}<button type="button" id="addVenueProgram" class="btn light">＋ この会場に発表を登録</button>`:'<p class="muted">「会場・配置図」で会場を登録すると、ここから発表を追加できます。</p>'}</div></div>
 ${unassigned.length?`<div class="editor-card"><h3>会場未設定の発表</h3><p class="muted">旧バージョンから引き継いだ発表などです。会場を選択すると上の会場別登録へ移ります。</p><div class="legacy-program-list">${unassigned.map(p=>adminUnassignedRow(p)).join('')}</div></div>`:''}
 <details class="editor-card other-programs"><summary>開会行事・午後など、セッション以外の全体プログラム</summary><p class="muted">午後の体育館行事は「午後（プログラムでリアクション）」を選ぶと、来場者のプログラム画面にリアクションアイコンを表示します。</p><div class="admin-program-list">${other.map(p=>adminOtherProgramRow(p)).join('')}</div><div class="row-actions"><button type="button" id="addAfternoonProgram" class="btn light">＋ 午後プログラムを追加</button><button type="button" id="addOtherProgram" class="btn light">＋ その他の全体プログラムを追加</button></div></details>`;
 bindAdminProgramEvents();
}
function adminVenueProgramRow(p){return `<div class="venue-program-admin-row" data-program="${esc(p.id)}"><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年（複数可）<input data-vpfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" placeholder="例：A班・1班" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" placeholder="発表内容を入力" value="${esc(p.title)}"></label><label class="program-presenters-field">児童生徒名（大豊学園のみ）<input data-vpfield="presenters" maxlength="300" placeholder="例：山田○○、田中○○" value="${esc(p.presenters||'')}"></label><div class="derived-time">${esc(programTimes(p).start)}〜${esc(programTimes(p).end)}</div><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
function adminUnassignedRow(p){return `<div class="venue-program-admin-row legacy" data-program="${esc(p.id)}"><label>会場<select data-vpfield="zoneId">${roomOptions('')}</select></label><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年<input data-vpfield="grade" maxlength="40" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" value="${esc(p.title)}"></label><label>児童生徒名（大豊学園のみ）<input data-vpfield="presenters" maxlength="300" value="${esc(p.presenters||'')}"></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
function adminOtherProgramRow(p){return `<div class="admin-program-row whole-program-row" data-program="${esc(p.id)}"><label>区分<select data-opfield="session"><option value="afternoon" ${p.session==='afternoon'?'selected':''}>午後（リアクション対象）</option><option value="other" ${p.session!=='afternoon'?'selected':''}>その他（リアクションなし）</option></select></label><label>開始<input type="time" data-opfield="start" value="${esc(p.start)}"></label><label>終了<input type="time" data-opfield="end" value="${esc(p.end)}"></label><label>発表学年<input data-opfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>グループ<input data-opfield="group" maxlength="40" placeholder="例：合同A班" value="${esc(p.group||'')}"></label><label>内容<input data-opfield="title" maxlength="120" value="${esc(p.title)}"></label><label>児童生徒名（大豊学園のみ）<input data-opfield="presenters" maxlength="300" value="${esc(p.presenters||'')}"></label><label>会場<select data-opfield="zoneId">${roomOptions(p.zoneId)}</select></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button></div>`}
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
   {grade:'1年生',group:'A班',title:'学校のすてきを見つけよう',presenters:'山田 はる・田中 そうた'},
   {grade:'4年生',group:'A班',title:'大豊町の自然を調べよう',presenters:'佐藤 ひなた・小林 りく'},
   {grade:'6年生',group:'A班',title:'地域の魅力を伝えよう',presenters:'高橋 ゆい・伊藤 けん'},
   {grade:'9年生',group:'A班',title:'未来の大豊町を考える',presenters:'中村 あおい・松本 れん'}
  ],
  s2:[
   {grade:'3年生',group:'A班',title:'町たんけんで見つけたこと',presenters:'井上 みお・木村 そう'},
   {grade:'6年生',group:'B班',title:'大豊町の課題とこれから',presenters:'林 さくら・森 はると'},
   {grade:'7年生',group:'A班',title:'ふるさと大豊の魅力',presenters:'山本 ひかり・藤田 かい'},
   {grade:'9年生',group:'B班',title:'地域を元気にするアイデア',presenters:'岡田 みなみ・前田 しゅん'}
  ],
  s3:[
   {grade:'2年生',group:'A班',title:'大豊町のすてきな場所',presenters:'橋本 えま・石川 りお'},
   {grade:'5年生',group:'A班',title:'大豊町の産業を調べよう',presenters:'近藤 なお・清水 こう'},
   {grade:'8年生',group:'A班',title:'探究学習の成果発表',presenters:'吉田 まい・山口 たいち'},
   {grade:'7年生・8年生',group:'合同A班',title:'大豊町の魅力を未来へ',presenters:'斎藤 りん・加藤 ゆう・村上 そら'}
  ],
  s4:[
   {grade:'2年生',group:'B班',title:'地域の人に聞いてみよう',presenters:'池田 ひな・阿部 るい'},
   {grade:'4年生',group:'B班',title:'大豊町の文化を伝えよう',presenters:'西村 ゆな・福田 かなた'},
   {grade:'5年生',group:'B班',title:'地域を支える仕事',presenters:'太田 みさき・藤井 こうた'},
   {grade:'8年生',group:'B班',title:'私たちが考える大豊町の未来',presenters:'長谷川 あかり・青木 はやと'}
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
    grade:item.grade,group:item.group,title:item.title,zoneId:room.id,presenters:item.presenters||''
   });
  });
 });
 return rows;
}
function demoWholeProgramRows(){
 const pool=demoVenuePool();
 const hall=demoHallZoneId(pool);
 const demoNames={
  'pm01':'鈴木 りこ・中川 けい','pm02':'後期生徒 有志メンバー','pm03':'音楽クラブ メンバー','pm04':'吉田 まい・山口 たいち','pm05':'長谷川 あかり・青木 はやと','pm06':'石井 かな・森本 りょう','pm07':'山本 ひかり・松本 れん','pm08':'高橋 ゆい・藤田 かい','pm09':'斎藤 りん・村上 そら','pm10':'中村 あおい','pm11':'吹奏楽部 メンバー'
 };
 const r=(id,session,start,end,grade,group,title,zoneId='')=>({id:`demo-${id}`,reactionId:'',session,start,end,grade,group,title,zoneId,presenters:demoNames[id]||''});
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
 const msg=byId('demoDataMessage');if(msg)msg.textContent=`2025年度プログラムの流れを参考に、午前${morning.length}件（最大4会場×4セッション）と午後${afternoonCount}件のリアクション対象ステージを含むデモデータを登録しました。1〜9年生、複数グループ、合同発表、架空の児童生徒名を確認できます。この端末では会場案内に即時反映されます。`;
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
 byId('downloadProgramXlsx').addEventListener('click',downloadProgramExcel);
 $$('[data-session-setting]').forEach(row=>row.querySelectorAll('[data-session-time]').forEach(input=>input.addEventListener('change',()=>{const id=row.dataset.sessionSetting,start=row.querySelector('[data-session-time="start"]').value,end=row.querySelector('[data-session-time="end"]').value;if(!start||!end||timeNum(start)>=timeNum(end)){alert('開始時刻より後に終了時刻を設定してください。');renderAdminPrograms();return;}state.sessions[id]={...state.sessions[id],label:DEFAULT_SESSIONS[id].label,start,end};syncSessionProgramTimes();persist();renderAdminPrograms();renderPublic();toast(`${sessionLabel(id)}の時間を保存しました`)})));
 byId('programVenueSelect')?.addEventListener('change',e=>{adminProgramVenue=e.target.value;renderAdminPrograms()});
 $$('[data-vpfield]').forEach(el=>el.addEventListener('change',e=>{const row=e.target.closest('[data-program]'),p=state.programs.find(x=>x.id===row.dataset.program);if(!p)return;const field=e.target.dataset.vpfield,old=p[field];p[field]=e.target.value;if(field==='session'){const d=sessionDef(p.session);p.start=d.start;p.end=d.end;}if(hasDuplicateVenueSession(p)){alert('同じ会場の同じセッションには、すでに別の発表が登録されています。');p[field]=old;renderAdminPrograms();return;}if(field==='zoneId'&&p.zoneId)adminProgramVenue=p.zoneId;persist();renderAdminPrograms();renderPublic();toast('発表内容を保存しました')}));
 $$('[data-opfield]').forEach(el=>el.addEventListener('change',e=>{const row=e.target.closest('[data-program]'),p=state.programs.find(x=>x.id===row.dataset.program);if(!p)return;p[e.target.dataset.opfield]=e.target.value;persist();renderPublic();toast('全体プログラムを保存しました')}));
 $$('[data-del-program]').forEach(el=>el.onclick=()=>{if(!confirm('この発表を削除しますか？'))return;state.programs=state.programs.filter(p=>p.id!==el.dataset.delProgram);persist();renderAdminPrograms();renderPublic()});
 byId('addVenueProgram')?.addEventListener('click',()=>{if(!adminProgramVenue)return;const used=new Set(sessionProgramsForVenue(adminProgramVenue).map(p=>p.session));const sid=SESSION_IDS.find(id=>!used.has(id));if(!sid){alert('この会場にはセッション①〜④がすべて登録されています。');return;}const d=sessionDef(sid);state.programs.push({id:'p'+Date.now(),reactionId:'',session:sid,start:d.start,end:d.end,grade:'',group:'',title:'',zoneId:adminProgramVenue,presenters:''});persist();renderAdminPrograms();renderPublic();toast(`${sessionLabel(sid)}の入力欄を追加しました`)});
 byId('addAfternoonProgram')?.addEventListener('click',()=>{state.programs.push({id:'p'+Date.now(),reactionId:'',session:'afternoon',start:'13:00',end:'13:20',grade:'',group:'',title:'新しい午後プログラム',zoneId:'',presenters:''});persist();renderAdminPrograms();renderPublic();toast('午後プログラムを追加しました')});
 byId('addOtherProgram')?.addEventListener('click',()=>{state.programs.push({id:'p'+Date.now(),reactionId:'',session:'other',start:'08:30',end:'08:50',grade:'',group:'',title:'新しい全体プログラム',zoneId:'',presenters:''});persist();renderAdminPrograms();renderPublic();toast('全体プログラムを追加しました')});
 byId('importProgramCsv')?.addEventListener('click',async()=>{
 const input=byId('programCsvFile'),msg=byId('programCsvMessage'),file=input?.files?.[0];if(!file){if(msg)msg.textContent='ExcelまたはCSVファイルを選んでください。';return;}
 const mode=byId('programCsvMode')?.value||'append';try{if(msg)msg.textContent='Excel／CSVを確認しています…';const text=await readProgramImportFile(file);const imported=parseProgramCsv(text,mode);if(mode==='replace'&&!confirm(`現在のプログラム ${state.programs.length}件を削除し、ファイルの ${imported.length}件に置き換えます。よろしいですか？`)){if(msg)msg.textContent='読み込みをキャンセルしました。';return;}state.programs=mode==='replace'?imported:[...state.programs,...imported];syncReactionGroups(state);persist();renderAdminPrograms();renderPublic();if(msg)msg.textContent=`Excel／CSVから ${imported.length}件を${mode==='replace'?'読み込み、現在のプログラムを置き換え':'追加'}ました。Supabaseへ公開する前に内容を確認してください。`;toast('プログラムを読み込みました');input.value='';}catch(err){if(msg)msg.textContent=String(err.message||err);alert(String(err.message||err));}
});
byId('addDemoData')?.addEventListener('click',addDemoPrograms);
 byId('removeDemoData')?.addEventListener('click',removeDemoPrograms);
}
function renderBasic(){byId('settingYear').value=state.year;byId('settingDate').value=state.eventDate;byId('settingSlogan').value=state.slogan;byId('reactionDeadline').value=state.reactionDeadline||state.eventDate+'T17:00';byId('internalPasscodeSetting').value=state.internalPasscode||'';
 byId('testEnabled').checked=!!state.test.enabled;byId('testDate').value=state.test.date;byId('testTime').value=state.test.time;byId('testSlider').value=timeNum(state.test.time);byId('testTimeText').textContent=state.test.time;}
byId('saveBasic').onclick=()=>{const year=byId('settingYear').value.trim(),date=byId('settingDate').value;if(!year||!date)return alert('年度と開催日を入力してください');
 const oldDate=state.eventDate;const deadline=byId('reactionDeadline').value;if(!deadline)return alert('リアクションの受付終了日時を入力してください');
 const internalPass=byId('internalPasscodeSetting').value.trim();if(internalPass && !/^[0-9]{8,24}$/.test(internalPass))return alert('大豊学園関係者用パスコードは数字8〜24桁で設定してください。');
 state.year=year;state.eventDate=date;state.slogan=byId('settingSlogan').value.trim();state.internalPasscode=internalPass;state.reactionDeadline=oldDate!==date&&deadline.startsWith(oldDate+'T')?date+deadline.slice(10):deadline;byId('reactionDeadline').value=state.reactionDeadline;persist();renderPublic();toast('年度設定を保存しました');};
function updateTest(){state.test.enabled=byId('testEnabled').checked;state.test.date=byId('testDate').value||state.eventDate;state.test.time=byId('testTime').value||'09:25';
 byId('testTimeText').textContent=state.test.time;byId('testSlider').value=timeNum(state.test.time);persist();renderPublic();}
byId('testEnabled').onchange=updateTest;byId('testDate').onchange=updateTest;byId('testTime').oninput=updateTest;
byId('testSlider').oninput=e=>{const n=Number(e.target.value);byId('testTime').value=`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;byId('testEnabled').checked=true;updateTest();};
$$('[data-quick]').forEach(b=>b.onclick=()=>{byId('testTime').value=b.dataset.quick;byId('testDate').value=state.eventDate;byId('testEnabled').checked=true;updateTest();});

function appPublicUrl(){
 const here=(location.protocol==='http:'||location.protocol==='https:')?location.origin+location.pathname:STAMP_BASE_URL;
 return here.endsWith('/')?here:here.replace(/\/[^/]*$/,'/');
}
function surveyTargetLabel(v){return ({both:'一般＋大豊学園',public:'一般来場者',internal:'大豊学園のみ'})[v]||'一般＋大豊学園';}
// 画像はSupabase StorageではなくアンケートJSONに圧縮データとして保存する（追加SQL不要）。
const SURVEY_IMAGE_MAX_BYTES=450000;
const SURVEY_IMAGES_TOTAL_MAX=2300000;
async function compressSurveyPoster(file){
 if(!file || !/^image\/(jpeg|png|webp)$/i.test(file.type))throw Error('JPEG・PNG・WebPの画像を選んでください。');
 if(file.size>15*1024*1024)throw Error('元画像は15MB以下にしてください。');
 const url=URL.createObjectURL(file);
 try{
  const photo=new Image();photo.src=url;await photo.decode();
  if(!photo.naturalWidth||!photo.naturalHeight)throw Error('画像を読み取れませんでした。');
  for(const max of [1700,1500,1300,1100,900]){
   const scale=Math.min(1,max/Math.max(photo.naturalWidth,photo.naturalHeight));
   const cvs=document.createElement('canvas');cvs.width=Math.max(1,Math.round(photo.naturalWidth*scale));cvs.height=Math.max(1,Math.round(photo.naturalHeight*scale));
   const ctx=cvs.getContext('2d',{alpha:false});if(!ctx)throw Error('画像の変換に対応していません。');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,cvs.width,cvs.height);ctx.drawImage(photo,0,0,cvs.width,cvs.height);
   for(const quality of [.88,.78,.66]){
    const data=cvs.toDataURL('image/jpeg',quality);
    if(data.length*3/4<=SURVEY_IMAGE_MAX_BYTES)return data;
   }
  }
  throw Error('画像を十分に圧縮できませんでした。別の画像をお試しください。');
 }finally{URL.revokeObjectURL(url);}
}
function renderSurveyAdmin(){
 const box=byId('surveyAdminList');if(!box)return;
 const list=(state.surveys||[]).slice().sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
 box.innerHTML=list.length?list.map((x,i)=>`<article class="editor-card survey-admin-item" data-survey-id="${esc(x.id)}">
 <div class="survey-admin-head"><div><strong>${esc(x.title||`アンケート${i+1}`)}</strong><span>${esc(surveyTargetLabel(x.target))}</span></div><label class="check"><input type="checkbox" data-survey-field="enabled" ${x.enabled!==false?'checked':''}> 表示する</label></div>
 <div class="survey-form-grid">
 <label>アンケート名<input data-survey-field="title" value="${esc(x.title)}" maxlength="80"></label>
 <label>対象<select data-survey-field="target"><option value="both" ${x.target==='both'?'selected':''}>一般＋大豊学園</option><option value="public" ${x.target==='public'?'selected':''}>一般来場者のみ</option><option value="internal" ${x.target==='internal'?'selected':''}>大豊学園のみ</option></select></label>
 <label class="survey-span-2">案内文<textarea data-survey-field="message" rows="3" maxlength="500">${esc(x.message)}</textarea></label>
 <label class="survey-span-2">GoogleフォームURL<input data-survey-field="url" type="url" value="${esc(x.url)}" placeholder="https://docs.google.com/forms/..."></label>
 <div class="survey-image-admin"><strong>参考ポスター（任意・1枚）</strong><input type="file" accept="image/jpeg,image/png,image/webp" data-survey-image aria-label="参考ポスター画像を選択"><small>画像は自動縮小して保存。PDFはここでは添付できません。ポスターの画像を指定してください。</small>${x.image?`<img class="survey-image-admin-preview" src="${esc(x.image)}" alt="設定済みの参考ポスター"><button type="button" class="btn light" data-remove-survey-image="${esc(x.id)}">画像を削除する</button>`:'<small>画像は未登録です。</small>'}</div>
 <label>ボタン名<input data-survey-field="buttonLabel" value="${esc(x.buttonLabel||'回答する')}" maxlength="40"></label>
 <label>表示順<input data-survey-field="order" type="number" min="1" max="99" value="${Number(x.order)||i+1}"></label>
 <label>表示開始（任意）<input data-survey-field="startAt" type="datetime-local" value="${esc(x.startAt||'')}"></label>
 <label>表示終了（任意）<input data-survey-field="endAt" type="datetime-local" value="${esc(x.endAt||'')}"></label></div>
 <div class="row-actions"><button type="button" class="btn danger" data-delete-survey="${esc(x.id)}">削除</button></div>
 <p class="caption">${x.target==='internal'?'このURLと参考画像は一般公開データには含めません。大豊学園関係者用パスコードで入った人だけに表示します。':'来場者画面では参考画像を拡大でき、Googleフォームをボタンから開けます。'}</p></article>`).join(''):'<div class="editor-card"><p class="muted">アンケートはまだ登録されていません。「＋ アンケートを追加」から必要な数だけ登録してください。</p></div>';
 box.querySelectorAll('[data-survey-field]').forEach(el=>el.addEventListener('change',e=>{
  const card=e.target.closest('[data-survey-id]'),item=state.surveys.find(v=>v.id===card?.dataset.surveyId);if(!item)return;
  const field=e.target.dataset.surveyField;item[field]=field==='enabled'?e.target.checked:field==='order'?Number(e.target.value)||1:e.target.value;
  if(field==='url'&&item.url&&!/^https:\/\//i.test(item.url)){alert('URLは https:// から始まる形式で入力してください。');item.url='';}
  persist();setTimeout(()=>{renderSurveyAdmin();renderSurveys();},0);toast('アンケート設定を保存しました');
 }));
 box.querySelectorAll('[data-survey-image]').forEach(input=>input.addEventListener('change',async e=>{
  const card=e.target.closest('[data-survey-id]'),item=state.surveys.find(v=>v.id===card?.dataset.surveyId),file=e.target.files?.[0];if(!item||!file)return;
  input.disabled=true;
  try{
   const data=await compressSurveyPoster(file);
   const sum=state.surveys.reduce((n,x)=>n+(x.id===item.id?data.length:(x.image||'').length),0);
   if(sum>SURVEY_IMAGES_TOTAL_MAX)throw Error('ポスター画像の合計容量が大きすぎます。古い画像の削除や別の軽い画像をご検討ください。');
   const previous=item.image;item.image=data;
   if(!persist()){item.image=previous;return;}
   renderSurveyAdmin();renderSurveys();toast('参考画像を保存しました。公開操作後に来場者へ反映されます');
  }catch(err){alert(`画像を登録できませんでした：${err.message||err}`);input.disabled=false;input.value='';}
 }));
 box.querySelectorAll('[data-remove-survey-image]').forEach(b=>b.onclick=()=>{
  const item=state.surveys.find(x=>x.id===b.dataset.removeSurveyImage);if(!item)return;item.image='';persist();renderSurveyAdmin();renderSurveys();toast('参考画像を削除しました');
 });
 box.querySelectorAll('[data-delete-survey]').forEach(b=>b.onclick=()=>{const id=b.dataset.deleteSurvey;if(!confirm('このアンケート設定を削除しますか？'))return;state.surveys=state.surveys.filter(x=>x.id!==id);persist();renderSurveyAdmin();renderSurveys();});
}
byId('addSurvey')?.addEventListener('click',()=>{const n=(state.surveys||[]).length+1;state.surveys.push({id:`survey-${Date.now()}`,title:`アンケート${n}`,message:'アンケートへのご協力をお願いします。',url:'',image:'',buttonLabel:'回答する',enabled:true,target:'both',startAt:'',endAt:'',order:n});persist();renderSurveyAdmin();toast('アンケートを追加しました');});

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
 const grid=byId('stampQrAdminGrid');if(grid)grid.innerHTML=[1,2,3,4,5].map(i=>`<article class="stamp-qr-preview"><div class="stamp-qr-preview-head"><strong>スタンプ${'①②③④⑤'[i-1]}</strong><span>STAMP ${i}</span></div><img src="${stampQrAsset(i)}" alt="スタンプ${i} QRコード"><code>${esc(stampFixedUrl(i))}</code></article>`).join('');
 for(let i=1;i<=5;i++){const el=byId(`stampHint${i}`);if(el)el.value=String(state.stampHints?.[i-1]||'');}
 const preview=byId('stampCompleteAdminPreview');if(preview)preview.innerHTML=state.stampCompleteImage?`<img src="${state.stampCompleteImage}" alt="5個達成時の画像"><span>現在の達成画像</span>`:'<span>達成画像は未設定です。</span>';
}
function openStampQrPrint(mode){
 const logo=new URL('assets/ofes-logo.png',location.href).href;
 const colors=['#e94253','#1688db','#28a452','#ee9319','#9455c9'];
 const cards=[1,2,3,4,5].map(i=>({i,qr:stampQrAsset(i),color:colors[i-1]}));
 const w=window.open('','OFES_STAMP_QR_PDF','width=1000,height=1000');
 if(!w){alert('印刷画面を開けませんでした。ポップアップを許可してください。');return;}
 const isPoster=mode==='poster';
 const body=isPoster?cards.map(c=>`<section class="poster-page" style="--stamp-color:${c.color}"><header class="poster-brand"><img src="${logo}" alt="OFES"><div><b>OFES</b><span>STAMP RALLY</span></div></header><h1>スタンプラリー</h1><svg class="number-badge" viewBox="0 0 160 160" role="img" aria-label="スタンプ番号 ${c.i}"><circle cx="80" cy="80" r="79" fill="${c.color}"/><text x="80" y="89" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="122" font-weight="900">${c.i}</text></svg><img class="qr poster-qr" src="${c.qr}" alt="スタンプ${c.i}のQRコード"><p class="scan-tip">カメラでQRコードを読み取って<br>スタンプをGET！</p><footer>OFES · 大豊学園</footer></section>`).join(''):
 `<section class="sheet-page"><div class="sheet-title"><img src="${logo}" alt="OFES"><div><h1>OFES スタンプラリー</h1><p>QRコード一覧（1〜5）</p></div></div><div class="sheet-grid">${cards.map(c=>`<article class="sheet-card" style="--stamp-color:${c.color}"><svg class="sheet-number" viewBox="0 0 80 80" role="img" aria-label="スタンプ番号 ${c.i}"><circle cx="40" cy="40" r="39" fill="${c.color}"/><text x="40" y="44" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="55" font-weight="900">${c.i}</text></svg><img class="qr sheet-qr" src="${c.qr}" alt="スタンプ${c.i}のQRコード"><strong>STAMP ${c.i}</strong></article>`).join('')}</div><p class="sheet-note">掲示場所の名称は印字していません。5つのQRコードは年度をまたいで使用できます。</p></section>`;
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>OFES スタンプラリーQRコード</title><style>
 @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:#172019;background:#fff}.printbar{position:fixed;right:12px;top:12px;z-index:20}.printbar button{font-size:15px;padding:10px 16px;border:1px solid #bbb;border-radius:8px;background:#fff}.qr{object-fit:contain;background:#fff;display:block}.poster-page{height:277mm;display:flex;align-items:center;flex-direction:column;text-align:center;page-break-after:always;border:3.5mm solid var(--stamp-color);border-radius:13mm;padding:9mm 9mm 7mm;position:relative}.poster-page:last-child{page-break-after:auto}.poster-brand{display:flex;align-items:center;gap:5mm;align-self:flex-start;text-align:left}.poster-brand img{width:18mm;height:18mm;object-fit:contain}.poster-brand b{font-size:19pt;display:block}.poster-brand span{color:#5d7065;font-size:10pt;letter-spacing:.15em}.poster-page h1{font-size:25pt;margin:3mm 0 5mm}.number-badge{width:48mm;height:48mm;display:block;filter:drop-shadow(0 2mm 4mm #0002)}.poster-qr{width:122mm;height:122mm;margin:5mm auto 0}.scan-tip{font-size:18pt;font-weight:800;line-height:1.5;margin:6mm 0}.poster-page footer{margin-top:auto;font-weight:700;color:#6d7b70;font-size:11pt}.sheet-page{padding:1mm}.sheet-title{display:flex;align-items:center;gap:4mm;border-bottom:2mm solid #d8e2d8;padding-bottom:4mm;margin-bottom:6mm}.sheet-title img{width:20mm;height:20mm;object-fit:contain}.sheet-title h1{font-size:19pt;margin:0}.sheet-title p{font-size:10pt;color:#657267;margin:1mm 0 0}.sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.sheet-card{border:1.2mm solid var(--stamp-color);border-radius:6mm;min-height:72mm;padding:3mm;display:flex;align-items:center;justify-content:center;flex-direction:column;break-inside:avoid}.sheet-number{width:18mm;height:18mm;display:block}.sheet-qr{width:44mm;height:44mm;margin:1mm auto}.sheet-card strong{font-size:9pt;color:#52665a}.sheet-note{font-size:9pt;color:#637269;margin-top:4mm}@media print{.printbar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.poster-page{break-after:page}.poster-page:last-child{break-after:auto}}
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
 ${state.internalPasscode?`<div class="message"><strong>大豊学園関係者用パスコード：</strong> <span style="font-size:16pt;font-weight:800;letter-spacing:.08em">${esc(state.internalPasscode)}</span><br><small>児童生徒・保護者・学校関係者は、最初の画面で「大豊学園関係者」を選び、このパスコードを入力してください。</small></div>`:''}<div class="note">※ OFESはWebアプリです。一般来場者は「一般来場者」から利用できます。児童生徒名は一般来場者には表示されません。表示にはインターネット接続が必要です。端末やOSのバージョンにより、メニュー名や表示位置が異なる場合があります。</div><div class="issuer">${esc(state.noticeIssuer)}</div>
 </body></html>`;
 w.document.open();w.document.write(html);w.document.close();
};

byId('exportJson').onclick=()=>{const blob=new Blob([JSON.stringify({version:18,data:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`OFES_${state.year}_backup.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);};
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
audienceMode=sessionStorage.getItem(ACCESS_MODE_KEY)==='public'?'public':'';renderPublic();readStampFromUrl();if(!audienceMode)showEntryGate();else hideEntryGate();
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
setInterval(()=>{if(!state.test.enabled){renderHeader();renderProgram();renderSurveys();if($('#tab-venues').classList.contains('active'))renderVisitorMap();renderTv();}},30000);
