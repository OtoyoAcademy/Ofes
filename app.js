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
const OFES_EMBEDDED_PROGRAM_XLSX='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';
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

// Ver.1.40: Keep checkmarks when switching venue tabs; never persist them as event data.
let selectedProgramIds=new Set();
function programDeleteCheckbox(p){
 return `<label class="program-select-control"><input type="checkbox" data-select-program="${esc(p.id)}" ${selectedProgramIds.has(p.id)?'checked':''} aria-label="削除対象に選択：${esc(p.title||'名称未設定')}"/><span>削除対象に選択</span></label>`;
}
function updateProgramSelectionControls(){
 const count=[...selectedProgramIds].filter(id=>state.programs.some(p=>p.id===id)).length;
 const indicator=byId('programSelectionCount');if(indicator)indicator.textContent=`選択中：${count}件／全${state.programs.length}件`;
 const btn=byId('deleteSelectedPrograms');if(btn){btn.disabled=count===0;btn.textContent=`選択したものを削除（${count}件）`;}
 const all=byId('deleteAllPrograms');if(all){all.disabled=state.programs.length===0;all.textContent=`全削除（${state.programs.length}件）`;}
}
function bulkDeletePrograms(mode){
 // Management changes are edits to the local draft; publishing remains a separate action.
 if(!editorActive || byId('adminPanel')?.hidden)return;
 const ids=mode==='all'?new Set(state.programs.map(p=>p.id)):new Set([...selectedProgramIds].filter(id=>state.programs.some(p=>p.id===id)));
 if(!ids.size)return;
 const title=mode==='all'?'【プログラム全削除】':'【選択プログラムの削除】';
 const confirmText=`${title}\n\n下書きのプログラム ${ids.size}件を削除します。\n会場・配置図やアンケートは削除しません。\nSupabaseの公開内容には「データ保存」から再公開するまで反映されません。\nリアクション投票履歴は自動削除されません。\n\nよろしいですか？`;
 if(!confirm(confirmText))return;
 if(mode==='all'&&prompt(`すべての ${ids.size}件を削除するには「全削除」と入力してください。`) !== '全削除')return;
 state.programs=state.programs.filter(p=>!ids.has(p.id));
 selectedProgramIds.clear();
 persist();renderAdminPrograms();renderPublic();toast(`下書きから${ids.size}件のプログラムを削除しました`);
}
function renderAdminPrograms(){
 if(!adminProgramVenue || !state.zones.some(z=>z.id===adminProgramVenue))adminProgramVenue=state.zones[0]?.id||'';
 selectedProgramIds=new Set([...selectedProgramIds].filter(id=>state.programs.some(p=>p.id===id)));
 const selectedZone=getZone(adminProgramVenue);
 const venuePrograms=selectedZone?sessionProgramsForVenue(selectedZone.id):[];
 const unassigned=orderedPrograms().filter(p=>!p.zoneId&&SESSION_IDS.includes(p.session));
 const other=orderedPrograms().filter(p=>!SESSION_IDS.includes(p.session));
 byId('adminPrograms').innerHTML=`
 <div class="editor-card program-bulk-card">
  <h3>プログラムの一括削除</h3>
  <p class="muted">削除する発表にチェックを付けてください。会場を切り替えても選択は保持されます。「全削除」は<strong>すべての会場・セッション・午後・その他</strong>の発表を対象にします。</p>
  <div class="row-actions"><button type="button" id="selectAllPrograms" class="btn light">全件を選択</button><button type="button" id="clearProgramSelection" class="btn light">選択解除</button><strong id="programSelectionCount" class="program-selection-count">選択中：${selectedProgramIds.size}件／全${state.programs.length}件</strong></div>
  <div class="row-actions"><button type="button" id="deleteSelectedPrograms" class="btn danger" ${selectedProgramIds.size?'':'disabled'}>選択したものを削除（${selectedProgramIds.size}件）</button><button type="button" id="deleteAllPrograms" class="btn danger" ${state.programs.length?'':'disabled'}>全削除（${state.programs.length}件）</button></div>
  <p class="caption">削除前に件数を表示して確認します。削除するのは下書きで、公開中のプログラムは再公開するまで変わりません。必要な場合は「データ保存」からJSONバックアップを保存してください。</p>
 </div>
 <div class="editor-card program-step-card"><div class="step-title"><span>1</span><div><h3>セッション①〜④の時間帯</h3><p class="muted">ここで設定した時間が、同じセッションを選んだすべての会場に共通で適用されます。</p></div></div>
 <div class="session-time-grid">${SESSION_IDS.map(id=>{const d=sessionDef(id);return `<div class="session-time-row" data-session-setting="${id}"><strong>${esc(d.label)}</strong><label>開始<input type="time" data-session-time="start" value="${esc(d.start)}"></label><label>終了<input type="time" data-session-time="end" value="${esc(d.end)}"></label></div>`}).join('')}</div></div>
 <div class="editor-card program-step-card"><div class="step-title"><span>2</span><div><h3>会場ごとの発表登録</h3><p class="muted">会場を選び、セッション・発表学年（複数可）・発表グループ・発表内容を登録します。開始・終了時刻は上の設定から自動で入ります。</p><p class="caption">発表学年は「7年生・8年生」「7・8年生」「6〜9年生」のように入力できます。児童生徒名は専用欄へ入力し、一般来場者には表示しません。</p></div></div>
 <label class="venue-program-selector">会場<select id="programVenueSelect">${state.zones.length?state.zones.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(z=>`<option value="${esc(z.id)}" ${z.id===adminProgramVenue?'selected':''}>${esc(z.id)}｜${esc(z.name)}</option>`).join(''):'<option value="">先に会場を登録してください</option>'}</select></label>
 <div class="venue-program-editor">${selectedZone?`<div class="venue-program-admin-heading"><strong>${esc(selectedZone.name)}</strong><span>${esc(selectedZone.id)}</span></div>${venuePrograms.length?venuePrograms.map(p=>adminVenueProgramRow(p)).join(''):'<p class="muted">この会場には、まだ発表が登録されていません。</p>'}<button type="button" id="addVenueProgram" class="btn light">＋ この会場に発表を登録</button>`:'<p class="muted">「会場・配置図」で会場を登録すると、ここから発表を追加できます。</p>'}</div></div>
 ${unassigned.length?`<div class="editor-card"><h3>会場未設定の発表</h3><p class="muted">旧バージョンから引き継いだ発表などです。会場を選択すると上の会場別登録へ移ります。</p><div class="legacy-program-list">${unassigned.map(p=>adminUnassignedRow(p)).join('')}</div></div>`:''}
 <details class="editor-card other-programs"><summary>開会行事・午後など、セッション以外の全体プログラム</summary><p class="muted">午後の体育館行事は「午後（プログラムでリアクション）」を選ぶと、来場者のプログラム画面にリアクションアイコンを表示します。</p><div class="admin-program-list">${other.map(p=>adminOtherProgramRow(p)).join('')}</div><div class="row-actions"><button type="button" id="addAfternoonProgram" class="btn light">＋ 午後プログラムを追加</button><button type="button" id="addOtherProgram" class="btn light">＋ その他の全体プログラムを追加</button></div></details>`;
 bindAdminProgramEvents();
}
function adminVenueProgramRow(p){return `<div class="venue-program-admin-row" data-program="${esc(p.id)}"><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年（複数可）<input data-vpfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" placeholder="例：A班・1班" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" placeholder="発表内容を入力" value="${esc(p.title)}"></label><label class="program-presenters-field">児童生徒名（大豊学園のみ）<input data-vpfield="presenters" maxlength="300" placeholder="例：山田○○、田中○○" value="${esc(p.presenters||'')}"></label><div class="derived-time">${esc(programTimes(p).start)}〜${esc(programTimes(p).end)}</div><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button>${programDeleteCheckbox(p)}</div>`}
function adminUnassignedRow(p){return `<div class="venue-program-admin-row legacy" data-program="${esc(p.id)}"><label>会場<select data-vpfield="zoneId">${roomOptions('')}</select></label><label>セッション<select data-vpfield="session">${sessionOptions(p.session)}</select></label><label>発表学年<input data-vpfield="grade" maxlength="40" value="${esc(p.grade||'')}"></label><label>発表グループ<input data-vpfield="group" maxlength="40" value="${esc(p.group||'')}"></label><label class="program-content-field">発表内容<input data-vpfield="title" maxlength="160" value="${esc(p.title)}"></label><label>児童生徒名（大豊学園のみ）<input data-vpfield="presenters" maxlength="300" value="${esc(p.presenters||'')}"></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button>${programDeleteCheckbox(p)}</div>`}
function adminOtherProgramRow(p){return `<div class="admin-program-row whole-program-row" data-program="${esc(p.id)}"><label>区分<select data-opfield="session"><option value="afternoon" ${p.session==='afternoon'?'selected':''}>午後（リアクション対象）</option><option value="other" ${p.session!=='afternoon'?'selected':''}>その他（リアクションなし）</option></select></label><label>開始<input type="time" data-opfield="start" value="${esc(p.start)}"></label><label>終了<input type="time" data-opfield="end" value="${esc(p.end)}"></label><label>発表学年<input data-opfield="grade" maxlength="40" placeholder="例：7年生・8年生" value="${esc(p.grade||'')}"></label><label>グループ<input data-opfield="group" maxlength="40" placeholder="例：合同A班" value="${esc(p.group||'')}"></label><label>内容<input data-opfield="title" maxlength="120" value="${esc(p.title)}"></label><label>児童生徒名（大豊学園のみ）<input data-opfield="presenters" maxlength="300" value="${esc(p.presenters||'')}"></label><label>会場<select data-opfield="zoneId">${roomOptions(p.zoneId)}</select></label><button type="button" class="btn danger" data-del-program="${esc(p.id)}">削除</button>${programDeleteCheckbox(p)}</div>`}
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
 $$('[data-select-program]').forEach(c=>c.addEventListener('change',()=>{
  if(c.checked)selectedProgramIds.add(c.dataset.selectProgram);else selectedProgramIds.delete(c.dataset.selectProgram);
  updateProgramSelectionControls();
 }));
 byId('selectAllPrograms')?.addEventListener('click',()=>{selectedProgramIds=new Set(state.programs.map(p=>p.id));$$('[data-select-program]').forEach(c=>c.checked=true);updateProgramSelectionControls();});
 byId('clearProgramSelection')?.addEventListener('click',()=>{selectedProgramIds.clear();$$('[data-select-program]').forEach(c=>c.checked=false);updateProgramSelectionControls();});
 byId('deleteSelectedPrograms')?.addEventListener('click',()=>bulkDeletePrograms('selected'));
 byId('deleteAllPrograms')?.addEventListener('click',()=>bulkDeletePrograms('all'));
 updateProgramSelectionControls();
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
