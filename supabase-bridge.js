/**
 * OFES Ver.1.20: Supabase Auth + Postgres/RLS + Realtime.
 * Firebase依存を外し、Supabaseの公開データ・匿名リアクション・管理者認証・復元ポイントへ移行。
 */
import { supabaseConfig } from './supabase-config.js';
const createClient = window.supabase?.createClient;

const el = (id) => document.getElementById(id);
const sdkStatus = el('firebaseSdkStatus');
const authStatus = el('firebaseAuthStatus');
const authMessage = el('firebaseAuthMessage');
const account = el('firebaseAccount');
const signInButton = el('firebaseSignIn');
const signOutButton = el('firebaseSignOut');
const readButton = el('firebaseReadTest');
const readResult = el('firebaseReadResult');
const cloudStatus = el('firebaseCloudStatus');
const summary = el('firebasePublishSummary');
const publishButton = el('firebasePublish');
const loadButton = el('firebaseLoadDraft');
const publishMessage = el('firebasePublishMessage');
const restorePublishedButton = el('firebaseRestorePrevious');
const publicationBackupSummary = el('publicationBackupSummary');
const publicationBackupMessage = el('publicationBackupMessage');
const adminEmail = el('supabaseAdminEmail');
const adminPassword = el('supabaseAdminPassword');

let supabase = null;
let isLoggedIn = false;
let isBusy = false;
let publishedData = null;
let lastPublishTime = null;
let cloudLoaded = false;
let cloudError = false;
let latestPublicationBackup = null;
let currentUser = null;
let currentIsAdmin = false;
let realtimeChannel = null;

const REACTION_KEYS = ['good','aha','amazing','fun','cheer'];
const REACTION_LABELS = ['👍 よかった','💡 なるほど','✨ すごい','😊 楽しかった','🙌 応援したい'];
let latestStats = null, latestAllStats = [];

function status(node, text, kind='info') {
  if (!node) return;
  node.textContent = text;
  node.classList.remove('firebase-error','firebase-ok','firebase-loading','firebase-info');
  node.classList.add(`firebase-${kind}`);
}
function errorText(error) {
  const msg = String(error?.message || error?.error_description || error || '接続エラー');
  if (/Invalid login credentials/i.test(msg)) return 'メールアドレスまたはパスワードが正しくありません。';
  if (/Email not confirmed/i.test(msg)) return 'メールアドレスが確認されていません。Supabase側でユーザーを確認済みにしてください。';
  if (/anonymous sign-ins are disabled/i.test(msg)) return 'Supabase Authenticationで匿名ログインを有効にしてください。';
  if (/row-level security|permission denied|violates row-level security/i.test(msg)) return '権限がありません。SupabaseのRLS設定と管理者UIDを確認してください。';
  if (/Failed to fetch|NetworkError|fetch/i.test(msg)) return '通信に失敗しました。ネットワークとSupabase設定を確認してください。';
  return msg;
}
function configured() {
  return /^https:\/\/[^.]+\.supabase\.co$/i.test(String(supabaseConfig.url||'')) &&
    !String(supabaseConfig.url||'').includes('YOUR_PROJECT_REF') &&
    !!supabaseConfig.publishableKey && !String(supabaseConfig.publishableKey).includes('YOUR_PUBLISHABLE_KEY');
}
function setUiState() {
  if (publishButton) publishButton.disabled = !isLoggedIn || isBusy || !cloudLoaded || cloudError;
  if (loadButton) loadButton.disabled = !publishedData || isBusy;
  if (restorePublishedButton) restorePublishedButton.disabled = !isLoggedIn || isBusy || !latestPublicationBackup;
  if (cloudError) {
    status(cloudStatus,'接続エラー','error');
    if(summary){summary.textContent='公開データにアクセスできません。Supabase設定・RLS・ネットワークをご確認ください。';summary.classList.add('warning');}
  } else if (!cloudLoaded) {
    status(cloudStatus,'接続確認中…','loading');
    if(summary){summary.textContent='Supabaseへの接続を確認中…';summary.classList.add('warning');}
  } else if (publishedData) {
    status(cloudStatus,'公開データあり','ok');
    const n=publishedData.zones?.length||0, p=publishedData.programs?.length||0;
    const when=lastPublishTime?`　最終公開：${lastPublishTime}`:'';
    if(summary){summary.textContent=`公開中：${publishedData.year||'―'}年度／会場${n}か所／プログラム${p}件${when}`;summary.classList.remove('warning');}
  } else {
    status(cloudStatus,'未公開（初回保存待ち）');
    if(summary){summary.textContent='Supabaseにはまだ公開データがありません。既存の教室登録を確認し、最初の公開を行ってください。';summary.classList.add('warning');}
  }
}
function isAdmin(){ return !!currentIsAdmin && !!currentUser; }
function jstDeadlineIso(localValue){
  const d = new Date(`${localValue}:00+09:00`);
  if(!Number.isFinite(d.getTime())) throw Error('リアクション受付終了日時の形式が正しくありません。');
  return d.toISOString();
}
async function checkAdmin(user){
  if(!user || user.is_anonymous) return false;
  const { data, error } = await supabase.rpc('is_ofes_admin');
  if(error) throw error;
  return data === true;
}
async function refreshSessionUi(userOverride=undefined){
  if(userOverride!==undefined){currentUser=userOverride;}else{const { data:{ session } } = await supabase.auth.getSession();currentUser=session?.user||null;}
  try{ currentIsAdmin = await checkAdmin(currentUser); }catch(error){ console.warn(error); currentIsAdmin=false; }
  isLoggedIn = currentIsAdmin;
  const signed = !!currentUser && !currentUser.is_anonymous;
  if(signInButton){signInButton.hidden=currentIsAdmin;signInButton.disabled=false;}
  if(signOutButton){signOutButton.hidden=!signed;signOutButton.disabled=false;}
  if(readButton)readButton.disabled=!currentIsAdmin;
  if(account)account.hidden=!signed;
  window.dispatchEvent(new CustomEvent('ofes-reaction-uid',{detail:{uid:currentUser?.id||''}}));
  setUiState();
  if(el('reactionClearAll'))el('reactionClearAll').disabled=!currentIsAdmin;
  if(el('reactionRestoreLatest')&&!currentIsAdmin)el('reactionRestoreLatest').disabled=true;
  if(signed){
    if(el('firebaseUserEmail'))el('firebaseUserEmail').textContent=currentUser.email||'メールアドレスなし';
    if(el('firebaseUserUid'))el('firebaseUserUid').value=currentUser.id||'';
    if(currentIsAdmin){
      status(authStatus,'管理者ログイン成功','ok');
      status(authMessage,'Supabase管理者として認証されました。公開・集計・復元を利用できます。','ok');
      status(publishMessage,'編集内容を公開する前に、JSONバックアップと内容の確認をおすすめします。');
    }else{
      status(authStatus,'ログイン済み（管理者未登録）','error');
      status(authMessage,'ログインは成功しましたが、ofes_admins にこのUIDが登録されていません。','error');
      status(publishMessage,'Supabaseの管理者UID登録後に公開できます。');
    }
  }else{
    if(account)account.hidden=true;
    if(el('firebaseUserEmail'))el('firebaseUserEmail').textContent='';
    if(el('firebaseUserUid'))el('firebaseUserUid').value='';
    status(authStatus,currentUser?.is_anonymous?'来場者として匿名認証中':'管理者は未ログイン');
    status(authMessage,'学校用の管理者メールアドレスとパスワードでログインしてください。来場者はログイン操作不要です。');
    status(publishMessage,'管理者ログイン後に公開できます。');
  }
  status(readResult,currentIsAdmin?'Supabaseの管理者権限を確認できます。':'管理者ログイン後に確認できます。');
  await refreshRestorePointInfo();
  await refreshPublicationBackupInfo();
}
async function fetchPublished(){
  const { data, error } = await supabase.from('ofes_site_state')
    .select('payload,updated_at,event_date,reaction_deadline_at,reaction_revision')
    .eq('id','site').maybeSingle();
  if(error) throw error;
  if(data?.payload){
    publishedData = structuredClone(data.payload);
    publishedData.reactionDeadlineAt = data.reaction_deadline_at || null;
    publishedData.reactionRevision = Number(data.reaction_revision||0);
    publishedData.eventDate = publishedData.eventDate || data.event_date || '';
    lastPublishTime = data.updated_at ? new Date(data.updated_at).toLocaleString('ja-JP') : null;
  }else{
    publishedData = null; lastPublishTime=null;
  }
  cloudLoaded=true;cloudError=false;setUiState();renderReactionStatsOptions();
  if(isAdmin())await refreshPublicationBackupInfo();
  window.dispatchEvent(new CustomEvent('ofes-cloud-published',{detail:{data:publishedData}}));
}
function subscribePublished(){
  if(realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel=supabase.channel('ofes-site-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'ofes_site_state',filter:'id=eq.site'},()=>fetchPublished().catch(console.error))
    .subscribe();
}

// -------- Reactions --------
const selectionCacheKey='ofes-reaction-choices-v20';
function readSelectionCache(){try{return JSON.parse(localStorage.getItem(selectionCacheKey)||'{}')}catch{return{}}}
function cacheSelection(date,programId,uid,selected){try{const data=readSelectionCache();data[`${date}|${programId}|${uid}`]=selected;localStorage.setItem(selectionCacheKey,JSON.stringify(data));}catch(error){console.warn(error)}}
function emitSelection(programId,selected,uid){window.dispatchEvent(new CustomEvent('ofes-reaction-selection',{detail:{programId,selected,uid}}));}
function emitNotice(programId,message){window.dispatchEvent(new CustomEvent('ofes-reaction-notice',{detail:{programId,message}}));}
function publishStatus(){
  if(!publishedData?.reactionDeadlineAt)return {ok:false,message:'リアクションの受付準備中です。管理者がSupabaseへ再公開してください。'};
  const end=new Date(publishedData.reactionDeadlineAt);
  if(!Number.isFinite(end.getTime()))return {ok:false,message:'受付期限が読み取れません。'};
  if(Date.now()>=end.getTime())return {ok:false,message:'リアクションの受付は終了しました。'};
  return {ok:true};
}
const reactionBusy=new Set();
window.OFESReactions={
  toggle:async(programId,key)=>{
    if(!REACTION_KEYS.includes(key)||reactionBusy.has(programId))return;
    reactionBusy.add(programId);emitNotice(programId,'送信しています…');
    try{
      const gate=publishStatus();if(!gate.ok)throw Error(gate.message);
      const eventDate=publishedData.eventDate;
      if(!publishedData.programs?.some(p=>(p.reactionId||p.id)===programId))throw Error('公開されていない発表です。');
      let { data:{ user } } = await supabase.auth.getUser();
      if(!user){
        const { data, error }=await supabase.auth.signInAnonymously();if(error)throw error;user=data.user;
      }
      const { data:row, error:readErr }=await supabase.from('ofes_reaction_votes')
        .select('selected').eq('event_date',eventDate).eq('program_id',programId).eq('voter_uid',user.id).maybeSingle();
      if(readErr)throw readErr;
      const current=Array.isArray(row?.selected)?row.selected:[];
      const next=current.includes(key)?current.filter(x=>x!==key):[...current,key];
      if(next.length){
        const { error }=await supabase.from('ofes_reaction_votes').upsert({event_date:eventDate,program_id:programId,voter_uid:user.id,selected:next,version:1,updated_at:new Date().toISOString()},{onConflict:'event_date,program_id,voter_uid'});if(error)throw error;
      }else{
        const { error }=await supabase.from('ofes_reaction_votes').delete().eq('event_date',eventDate).eq('program_id',programId).eq('voter_uid',user.id);if(error)throw error;
      }
      cacheSelection(eventDate,programId,user.id,next);emitSelection(programId,next,user.id);
      emitNotice(programId,next.length?`保存しました。${next.length}種類を選択中。押し直すと取り消せます。`:'リアクションを取り消しました。');
    }catch(error){emitNotice(programId,`送信できませんでした：${errorText(error)}`);}
    finally{reactionBusy.delete(programId);}
  }
};
async function restoreCachedReactions(){
  const uid=currentUser?.id,date=publishedData?.eventDate;if(!uid||!date)return;
  const ids=[...new Set((publishedData.programs||[]).map(p=>p.reactionId||p.id).filter(Boolean))];
  const cache=readSelectionCache();
  ids.forEach(id=>emitSelection(id,Array.isArray(cache[`${date}|${id}|${uid}`])?cache[`${date}|${id}|${uid}`]:[],uid));
  if(!ids.length)return;
  const { data, error }=await supabase.from('ofes_reaction_votes').select('program_id,selected').eq('event_date',date).eq('voter_uid',uid).in('program_id',ids);
  if(error){console.warn('reaction sync failed',error);return;}
  const map=new Map((data||[]).map(r=>[r.program_id,Array.isArray(r.selected)?r.selected:[]]));
  ids.forEach(id=>{const selected=map.get(id)||[];cacheSelection(date,id,uid,selected);emitSelection(id,selected,uid);});
}
function isReactionTargetProgram(p){return !!p&&(['s1','s2','s3','s4'].includes(p.session)||p.session==='afternoon');}
function sessionText(p){if(['s1','s2','s3','s4'].includes(p.session)){const d=publishedData?.sessions?.[p.session];return d?.label||({s1:'セッション①',s2:'セッション②',s3:'セッション③',s4:'セッション④'}[p.session]||p.session);}return p.session==='afternoon'?'午後':'その他';}
function zoneText(p){return publishedData?.zones?.find(z=>z.id===p.zoneId)?.name||(p.zoneId||'会場未設定');}
function gradeLabels(gradeText){const text=String(gradeText||'').trim();const nums=[...new Set((text.match(/\d+/g)||[]).map(Number).filter(n=>n>=1&&n<=9))].sort((a,b)=>a-b);return nums.length?nums.map(n=>`${n}年生`):[text||'全体・その他'];}
function gradeOrder(label){const m=String(label).match(/^(\d+)年生$/);return m?Number(m[1]):99;}
function reactionTargetGroups(){
  const map=new Map();
  for(const p of (publishedData?.programs||[]).filter(isReactionTargetProgram)){
    const reactionId=p.reactionId||p.id;if(!reactionId)continue;
    if(!map.has(reactionId))map.set(reactionId,{reactionId,representative:p,programs:[]});
    map.get(reactionId).programs.push(p);
  }
  return [...map.values()].sort((a,b)=>String(a.representative.start).localeCompare(String(b.representative.start))||String(a.representative.title).localeCompare(String(b.representative.title),'ja'));
}
function renderReactionStatsOptions(){
  const select=el('reactionStatsProgram');if(!select)return;
  const groups=reactionTargetGroups();
  select.innerHTML=groups.length?groups.map(g=>{const p=g.representative;return `<option value="${String(g.reactionId).replace(/"/g,'&quot;')}">${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}（${g.programs.length>1?`${g.programs.length}回実施`:`${sessionText(p)} ${p.start}〜${p.end}`}）</option>`}).join(''):'<option value="">集計対象の発表がありません</option>';
}
async function collectOneTarget(group){
  const { data:votes, error }=await supabase.from('ofes_reaction_votes').select('selected,voter_uid').eq('event_date',publishedData.eventDate).eq('program_id',group.reactionId);if(error)throw error;
  const counts=Object.fromEntries(REACTION_KEYS.map(k=>[k,0]));
  for(const row of votes||[])for(const key of (Array.isArray(row.selected)?row.selected:[]))if(key in counts)counts[key]++;
  const p=group.representative;
  const schedules=group.programs.slice().sort((a,b)=>String(a.start).localeCompare(String(b.start))).map(x=>`${sessionText(x)} ${x.start}〜${x.end}`);
  const zones=[...new Set(group.programs.map(zoneText))];
  return {reactionId:group.reactionId,title:p.title,grade:p.grade||'全体・その他',gradeLabels:gradeLabels(p.grade),groupName:p.group||'（グループ名なし）',counts,respondents:(votes||[]).length,schedules,zoneName:zones.join('／')};
}

// -------- Reaction stats / PDF --------
const statsButton=el('reactionStatsLoad'),statsMessage=el('reactionStatsMessage'),statsOut=el('reactionStatsResult');
statsButton?.addEventListener('click',async()=>{
  if(!isAdmin()){statsMessage.textContent='管理者ログインが必要です。';return;}
  const id=el('reactionStatsProgram')?.value,group=reactionTargetGroups().find(g=>g.reactionId===id);if(!group){statsMessage.textContent='集計対象を選択してください。';return;}
  statsButton.disabled=true;statsMessage.textContent='Supabaseから集計しています…';
  try{
    const item=await collectOneTarget(group);const p=group.representative;
    const countNodes=statsOut?.querySelectorAll?.('[data-reaction-count]')||[];countNodes.forEach(n=>n.textContent=item.counts[n.dataset.reactionCount]??0);
    const respondentNode=el('reactionRespondents');if(respondentNode)respondentNode.textContent=String(item.respondents);
    const programNode=el('reactionStatsTitle');if(programNode)programNode.textContent=`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`;
    latestStats={programTitle:`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`,grade:item.grade,groupName:item.groupName,year:publishedData.year,eventDate:publishedData.eventDate,counts:item.counts,respondents:item.respondents,schedules:item.schedules,zoneName:item.zoneName};
    statsOut.hidden=false;el('reactionStatsExport').disabled=false;statsMessage.textContent='集計しました。順位付けは行っていません。';
  }catch(error){statsMessage.textContent=`集計できませんでした：${errorText(error)}`;}finally{statsButton.disabled=false;}
});
el('reactionStatsExport')?.addEventListener('click',()=>{
  if(!latestStats)return;
  const rows=[['対象学年',latestStats.grade],['発表グループ',latestStats.groupName],['発表',latestStats.programTitle],['年度',latestStats.year],['開催日',latestStats.eventDate],['実施時間',latestStats.schedules.join(' / ')],['会場',latestStats.zoneName],['回答者数',latestStats.respondents],...REACTION_KEYS.map((k,i)=>[REACTION_LABELS[i],latestStats.counts[k]])];
  const csv='\ufeff'+rows.map(cols=>cols.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`OFES_リアクション集計_${latestStats.eventDate}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
});
const allButton=el('reactionStatsLoadAll'),allOut=el('reactionStatsAllResult'),allMessage=el('reactionStatsAllMessage'),pdfOverallButton=el('reactionStatsPdfOverall'),pdfGradeButton=el('reactionStatsPdfGrade');
function statsByGrade(){const groups=new Map();for(const item of latestAllStats){for(const grade of item.gradeLabels||[item.grade]){if(!groups.has(grade))groups.set(grade,[]);groups.get(grade).push(item);}}return [...groups.entries()].sort((a,b)=>gradeOrder(a[0])-gradeOrder(b[0])||a[0].localeCompare(b[0],'ja',{numeric:true})).map(([grade,items])=>[grade,items.slice().sort((a,b)=>String(a.groupName).localeCompare(String(b.groupName),'ja',{numeric:true})||String(a.title).localeCompare(String(b.title),'ja'))]);}
function renderAllStats(){if(!allOut)return;allOut.replaceChildren();for(const [grade,items] of statsByGrade()){const group=document.createElement('section');group.className='reaction-grade-group';const h=document.createElement('h4');h.textContent=grade;group.append(h);const wrap=document.createElement('div');wrap.className='reaction-all-table-wrap';const table=document.createElement('table');table.className='reaction-all-table';table.innerHTML='<thead><tr><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答者</th><th>👍</th><th>💡</th><th>✨</th><th>😊</th><th>🙌</th></tr></thead>';const tbody=document.createElement('tbody');for(const item of items){const tr=document.createElement('tr');const joint=item.gradeLabels?.length>1?`（${item.grade}合同）`:'';const values=[`${item.groupName}${joint}`,item.title,item.schedules.join('／'),item.zoneName,String(item.respondents),...REACTION_KEYS.map(k=>String(item.counts[k]))];values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i>=4)td.classList.add('count');tr.append(td);});tbody.append(tr);}table.append(tbody);wrap.append(table);group.append(wrap);allOut.append(group);}}
allButton?.addEventListener('click',async()=>{if(!isAdmin()){allMessage.textContent='管理者ログインが必要です。';return;}const groups=reactionTargetGroups();if(!groups.length){allMessage.textContent='集計対象の発表がありません。';return;}allButton.disabled=true;if(pdfOverallButton)pdfOverallButton.disabled=true;if(pdfGradeButton)pdfGradeButton.disabled=true;allOut.hidden=true;latestAllStats=[];allMessage.textContent=`全${groups.length}発表をSupabaseから集計しています…`;try{const results=[];for(let i=0;i<groups.length;i++){const p=groups[i].representative;allMessage.textContent=`集計中 ${i+1}/${groups.length}：${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`;results.push(await collectOneTarget(groups[i]));}latestAllStats=results;renderAllStats();allOut.hidden=false;if(pdfOverallButton)pdfOverallButton.disabled=false;if(pdfGradeButton)pdfGradeButton.disabled=false;const totalRespondents=results.reduce((sum,x)=>sum+x.respondents,0);allMessage.textContent=`全${results.length}発表グループを集計しました。グループごとの集計を保持しています。各発表の回答者数の合計は${totalRespondents}です。`;}catch(error){allMessage.textContent=`一括集計できませんでした：${errorText(error)}`;}finally{allButton.disabled=false;}});
function htmlEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function openReactionPrintWindow(name,title,bodyHtml,extraCss=''){const w=window.open('',name,'width=1100,height=850');if(!w){allMessage.textContent='PDF出力画面を開けませんでした。ポップアップを許可してください。';return null;}const css=`@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:#172019;margin:0;font-size:9pt}h1{font-size:17pt;margin:0 0 2mm}h2{font-size:14pt;margin:0 0 2.5mm;border-left:5px solid #197a4b;padding-left:8px}.meta{margin:0 0 4mm;color:#526058;font-size:8.5pt}.message{margin:0 0 4mm;padding:3mm 4mm;border-radius:8px;background:#f1f8f2;border:1px solid #cfe0d1;font-size:9.2pt;line-height:1.55}.message strong{font-size:10.5pt;color:#176c42}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #cfd7d0;padding:2mm 1.5mm;vertical-align:top;overflow-wrap:anywhere}th{background:#edf4ee;font-size:8.2pt}th.react,td.react{text-align:center;padding-left:.7mm;padding-right:.7mm}td.num{text-align:center;font-weight:700}.joint{display:block;margin-top:1mm;color:#637168;font-size:7.2pt;line-height:1.3}.note{margin-top:3mm;font-size:8pt;color:#59655d}.printbar{position:fixed;top:10px;right:10px;z-index:5}.printbar button{padding:9px 14px;font-size:14px}.grade-page{break-after:page;page-break-after:always}.grade-page:last-of-type{break-after:auto;page-break-after:auto}${extraCss}@media print{.printbar{display:none}}`;const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${htmlEsc(title)}</title><style>${css}</style></head><body><div class="printbar"><button onclick="window.print()">印刷／PDFとして保存</button></div>${bodyHtml}</body></html>`;w.document.open();w.document.write(html);w.document.close();return w;}
function overallStatsSorted(){return latestAllStats.slice().sort((a,b)=>{const ga=a.gradeLabels?.[0]||a.grade,gb=b.gradeLabels?.[0]||b.grade;return gradeOrder(ga)-gradeOrder(gb)||String(a.grade).localeCompare(String(b.grade),'ja',{numeric:true})||String(a.groupName).localeCompare(String(b.groupName),'ja',{numeric:true})||String(a.title).localeCompare(String(b.title),'ja');});}
pdfOverallButton?.addEventListener('click',()=>{if(!latestAllStats.length)return;const rows=overallStatsSorted().map(item=>`<tr><td>${htmlEsc(item.grade)}</td><td>${htmlEsc(item.groupName)}</td><td>${htmlEsc(item.title)}</td><td>${item.schedules.map(htmlEsc).join('<br>')}</td><td>${htmlEsc(item.zoneName)}</td><td class="num">${item.respondents}</td>${REACTION_KEYS.map(k=>`<td class="num react">${item.counts[k]}</td>`).join('')}</tr>`).join('');const body=`<h1>OFES リアクション全体集計</h1><p class="meta">${htmlEsc(publishedData.year||'')}年度　開催日：${htmlEsc(publishedData.eventDate||'')}　全発表グループを重複なく一覧表示しています。</p><table><colgroup><col class="c-grade"><col class="c-group"><col class="c-title"><col class="c-time"><col class="c-place"><col class="c-respond"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"></colgroup><thead><tr><th>学年</th><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答</th><th class="react">👍</th><th class="react">💡</th><th class="react">✨</th><th class="react">😊</th><th class="react">🙌</th></tr></thead><tbody>${rows}</tbody></table><p class="note">※ 合同発表も全体版では1つの発表グループとして1行だけ掲載します。個人を特定する情報は掲載していません。</p>`;openReactionPrintWindow('OFES_REACTION_ALL','OFES リアクション全体集計',body,'col.c-grade{width:8%}col.c-group{width:8%}col.c-title{width:27%}col.c-time{width:19%}col.c-place{width:10%}col.c-respond{width:4%}col.c-react{width:4.8%}');});
pdfGradeButton?.addEventListener('click',()=>{if(!latestAllStats.length)return;const sections=statsByGrade().map(([grade,items])=>`<section class="grade-page"><h1>OFES リアクションフィードバック</h1><h2>${htmlEsc(grade)}のみなさんへ</h2><div class="message"><strong>発表、おつかれさまでした！</strong><br>この表は、みなさんの発表を見た人から届いたリアクションをまとめたものです。数字の大小は順位ではありません。どんなところが伝わったのか、どんなよさや工夫があったのかを振り返り、次の学びや発表につなげていきましょう。</div><p class="meta">${htmlEsc(publishedData.year||'')}年度　開催日：${htmlEsc(publishedData.eventDate||'')}</p><table><colgroup><col class="c-group"><col class="c-title"><col class="c-time"><col class="c-place"><col class="c-respond"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"></colgroup><thead><tr><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答</th><th class="react">👍</th><th class="react">💡</th><th class="react">✨</th><th class="react">😊</th><th class="react">🙌</th></tr></thead><tbody>${items.map(item=>`<tr><td>${htmlEsc(item.groupName)}${item.gradeLabels?.length>1?`<small class="joint">${htmlEsc(item.grade)}合同</small>`:''}</td><td>${htmlEsc(item.title)}</td><td>${item.schedules.map(htmlEsc).join('<br>')}</td><td>${htmlEsc(item.zoneName)}</td><td class="num">${item.respondents}</td>${REACTION_KEYS.map(k=>`<td class="num react">${item.counts[k]}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">※ 合同発表は、関係するそれぞれの学年のページに同じ集計を掲載しています。リアクションは発表グループごとの集計です。</p></section>`).join('');openReactionPrintWindow('OFES_REACTION_BY_GRADE','OFES 学年別リアクションフィードバック',sections,'col.c-group{width:9%}col.c-title{width:32%}col.c-time{width:24%}col.c-place{width:10%}col.c-respond{width:5%}col.c-react{width:4%}.grade-page{min-height:185mm}');});

// -------- Publication backup / reaction backup --------
async function createPublicationBackup(reason='pre-publish'){
  if(!publishedData)return null;if(!isAdmin())throw Error('管理者ログインが必要です。');
  const row={reason,payload:publishedData,source_year:publishedData.year||'',source_event_date:publishedData.eventDate||null,source_zone_count:publishedData.zones?.length||0,source_program_count:publishedData.programs?.length||0,created_by:currentUser.id};
  const { data, error }=await supabase.from('ofes_publication_backups').insert(row).select('id,created_at,source_year,source_zone_count,source_program_count,payload').single();if(error)throw error;
  return {backupId:data.id,createdAtClient:data.created_at,sourceYear:data.source_year,sourceZoneCount:data.source_zone_count,sourceProgramCount:data.source_program_count,data:data.payload};
}
async function refreshPublicationBackupInfo(){
  latestPublicationBackup=null;if(!publicationBackupSummary||!restorePublishedButton)return;restorePublishedButton.disabled=true;
  if(!isAdmin()){publicationBackupSummary.textContent='管理者ログイン後に復元ポイントを確認できます。';if(publicationBackupMessage)publicationBackupMessage.textContent='公開前バックアップは管理者だけが読み書きできます。';return;}
  publicationBackupSummary.textContent='復元ポイントを確認中…';
  try{
    const { data, error }=await supabase.from('ofes_publication_backups').select('id,created_at,source_year,source_zone_count,source_program_count,payload').order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;
    latestPublicationBackup=data?{backupId:data.id,createdAtClient:data.created_at,sourceYear:data.source_year,sourceZoneCount:data.source_zone_count,sourceProgramCount:data.source_program_count,data:data.payload}:null;
    if(!latestPublicationBackup){publicationBackupSummary.textContent='復元ポイントはまだありません。2回目以降の「Supabaseへ公開」で自動作成されます。';if(publicationBackupMessage)publicationBackupMessage.textContent='初回公開の前には戻す元の公開データがないため、復元ポイントは作成されません。';return;}
    const when=new Date(latestPublicationBackup.createdAtClient).toLocaleString('ja-JP');publicationBackupSummary.textContent=`直前の復元ポイント：${when}／${latestPublicationBackup.sourceYear||'―'}年度／会場${latestPublicationBackup.sourceZoneCount||0}か所／プログラム${latestPublicationBackup.sourceProgramCount||0}件`;if(publicationBackupMessage)publicationBackupMessage.textContent='「直前の公開状態へ戻す」を押すと、この復元ポイントを公開データへ戻します。';restorePublishedButton.disabled=isBusy;
  }catch(error){publicationBackupSummary.textContent=`復元ポイントを確認できませんでした：${errorText(error)}`;if(publicationBackupMessage)publicationBackupMessage.textContent='SupabaseのRLSと管理者UIDを確認してください。';}
}
async function currentVoteSnapshot(){
  if(!publishedData?.eventDate)throw Error('公開データがありません。');
  const programIds=[...new Set(reactionTargetGroups().map(g=>g.reactionId))];if(!programIds.length)return {programIds,votes:[]};
  const { data, error }=await supabase.from('ofes_reaction_votes').select('event_date,program_id,voter_uid,selected,version,updated_at').eq('event_date',publishedData.eventDate).in('program_id',programIds);if(error)throw error;
  return {programIds,votes:data||[]};
}
async function createRestorePoint(){
  const {programIds,votes}=await currentVoteSnapshot();if(!votes.length)return null;
  const row={event_date:publishedData.eventDate,vote_count:votes.length,program_ids:programIds,payload:votes,created_by:currentUser.id};
  const { data, error }=await supabase.from('ofes_reaction_backups').insert(row).select('id,created_at,event_date,vote_count,program_ids,payload').single();if(error)throw error;
  return {backupId:data.id,eventDate:data.event_date,programIds:data.program_ids||[],voteCount:data.vote_count,createdAtClient:data.created_at,votes:data.payload||[]};
}
const clearButton=el('reactionClearAll'),restoreButton=el('reactionRestoreLatest'),clearMessage=el('reactionClearMessage'),restorePointLabel=el('reactionRestorePoint');
let latestRestorePoint=null;
async function refreshRestorePointInfo(){
  if(!restorePointLabel||!restoreButton)return;latestRestorePoint=null;restoreButton.disabled=true;
  if(!isAdmin()||!publishedData?.eventDate){restorePointLabel.textContent='管理者ログイン後に復元ポイントを確認できます。';return;}
  try{
    const { data, error }=await supabase.from('ofes_reaction_backups').select('id,created_at,event_date,vote_count,program_ids,payload').eq('event_date',publishedData.eventDate).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;
    latestRestorePoint=data?{backupId:data.id,eventDate:data.event_date,programIds:data.program_ids||[],voteCount:data.vote_count,createdAtClient:data.created_at,votes:data.payload||[]}:null;
    if(!latestRestorePoint){restorePointLabel.textContent='復元ポイントはまだありません。全クリアを実行すると直前に自動作成されます。';return;}
    restorePointLabel.textContent=`最新の復元ポイント：${new Date(latestRestorePoint.createdAtClient).toLocaleString('ja-JP')}／${latestRestorePoint.voteCount||0}件`;restoreButton.disabled=false;
  }catch(error){restorePointLabel.textContent=`復元ポイントを確認できませんでした：${errorText(error)}`;}
}
function resetStatsAfterMutation(message){latestStats=null;latestAllStats=[];if(statsOut)statsOut.hidden=true;if(allOut)allOut.hidden=true;if(el('reactionStatsExport'))el('reactionStatsExport').disabled=true;if(pdfOverallButton)pdfOverallButton.disabled=true;if(pdfGradeButton)pdfGradeButton.disabled=true;if(allMessage)allMessage.textContent=message;if(statsMessage)statsMessage.textContent='リアクションが変更されたため、必要に応じて再集計してください。';}
async function bumpReactionRevision(){const { error }=await supabase.from('ofes_site_state').update({reaction_revision:Date.now(),updated_at:new Date().toISOString()}).eq('id','site');if(error)throw error;}
clearButton?.addEventListener('click',async()=>{
  if(!isAdmin()){clearMessage.textContent='管理者ログインが必要です。';return;}if(!publishedData?.eventDate){clearMessage.textContent='公開データがありません。';return;}
  if(!confirm('【リアクション全クリア】\n\n現在公開中の発表に保存されているリアクションをすべて削除します。\n削除の直前にSupabaseへ復元ポイントを自動保存し、保存に成功した場合だけクリアします。\n\n続けますか？'))return;
  clearButton.disabled=true;restoreButton.disabled=true;clearMessage.textContent='復元ポイントを作成しています…';
  try{
    const point=await createRestorePoint();if(!point){clearMessage.textContent='保存されているリアクションがないため、クリアは実行しませんでした。';await refreshRestorePointInfo();return;}
    const { error }=await supabase.from('ofes_reaction_votes').delete().eq('event_date',point.eventDate).in('program_id',point.programIds);if(error)throw error;await bumpReactionRevision();resetStatsAfterMutation(`全リアクションをクリアしました。復元ポイント ${point.backupId} から戻せます。`);clearMessage.textContent=`全リアクションをクリアしました。クリア直前の${point.voteCount}件を復元ポイントとして保存済みです。`;await refreshRestorePointInfo();
  }catch(error){clearMessage.textContent=`全クリアを中止しました：${errorText(error)}。`;await refreshRestorePointInfo();}finally{clearButton.disabled=!isAdmin();}
});
restoreButton?.addEventListener('click',async()=>{
  if(!isAdmin()){clearMessage.textContent='管理者ログインが必要です。';return;}await refreshRestorePointInfo();const point=latestRestorePoint;if(!point)return;
  const when=new Date(point.createdAtClient).toLocaleString('ja-JP');if(!confirm(`最新の復元ポイント（${when}／${point.voteCount||0}件）からリアクションを復元します。\n現在のリアクションは、この復元ポイントの内容に置き換わります。\n\n復元しますか？`))return;
  clearButton.disabled=true;restoreButton.disabled=true;clearMessage.textContent='復元しています…';
  try{
    const live=await currentVoteSnapshot();if(live.programIds.length){const { error }=await supabase.from('ofes_reaction_votes').delete().eq('event_date',point.eventDate).in('program_id',live.programIds);if(error)throw error;}
    const rows=(point.votes||[]).map(v=>({event_date:v.event_date||point.eventDate,program_id:v.program_id,voter_uid:v.voter_uid,selected:Array.isArray(v.selected)?v.selected:[],version:Number(v.version||1),updated_at:new Date().toISOString()}));
    for(let i=0;i<rows.length;i+=200){const { error }=await supabase.from('ofes_reaction_votes').upsert(rows.slice(i,i+200),{onConflict:'event_date,program_id,voter_uid'});if(error)throw error;}
    await bumpReactionRevision();resetStatsAfterMutation(`復元ポイントから${rows.length}件を復元しました。`);clearMessage.textContent=`復元しました：${rows.length}件。必要に応じて「全発表を一括集計」で確認してください。`;
  }catch(error){clearMessage.textContent=`復元できませんでした：${errorText(error)}`;}finally{clearButton.disabled=!isAdmin();await refreshRestorePointInfo();}
});

// -------- Admin auth / publish --------
signInButton?.addEventListener('click',async()=>{
  const email=String(adminEmail?.value||'').trim(),password=String(adminPassword?.value||'');
  if(!email||!password){status(authMessage,'管理者メールアドレスとパスワードを入力してください。','error');return;}
  signInButton.disabled=true;status(authMessage,'Supabaseへログインしています…','loading');
  try{const { error }=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await refreshSessionUi();}
  catch(error){status(authMessage,errorText(error),'error');}
  finally{signInButton.disabled=false;}
});
signOutButton?.addEventListener('click',async()=>{signOutButton.disabled=true;try{await supabase.auth.signOut();await refreshSessionUi();}catch(error){status(authMessage,errorText(error),'error');}finally{signOutButton.disabled=false;}});
el('firebaseCopyUid')?.addEventListener('click',async()=>{const value=el('firebaseUserUid')?.value;if(!value)return;try{await navigator.clipboard.writeText(value);status(authMessage,'UIDをコピーしました。','ok');}catch{el('firebaseUserUid').focus();el('firebaseUserUid').select();status(authMessage,'UIDを選択しました。Ctrl+Cなどでコピーしてください。');}});
readButton?.addEventListener('click',async()=>{readButton.disabled=true;status(readResult,'Supabaseの管理者権限を確認中…','loading');try{const { data, error }=await supabase.rpc('is_ofes_admin');if(error)throw error;status(readResult,data?'読み取り成功：管理者権限が確認できました。':'読み取り成功：ただし管理者として登録されていません。',data?'ok':'error');}catch(error){status(readResult,`確認失敗：${errorText(error)}`,'error');}finally{readButton.disabled=!isAdmin();}});
publishButton?.addEventListener('click',async()=>{
  if(!isAdmin()||isBusy||!cloudLoaded||cloudError)return;const payload=window.OFESCloud?.exportPublished?.();if(!payload)return status(publishMessage,'下書きが取得できません。画面を再読み込みしてください。','error');
  const before=publishedData?`現在の公開データ（会場${publishedData.zones?.length||0}か所）を上書きします。`:'初めての公開です。';
  const warning=publishedData?.zones?.length>payload.zones.length?'\n【注意】現在の公開会場数より下書きの会場数が少なくなっています。ほかの端末で教室登録を進めている場合は、公開しないでください。\n':'';
  if(!confirm(`${before}\n${warning}\n年度：${payload.year}\n会場：${payload.zones.length}か所\nプログラム：${payload.programs.length}件\n受付終了：${payload.reactionDeadline}（日本時間）\n\nこの内容を来場者向けに公開してよろしいですか？`))return;
  isBusy=true;setUiState();let backupPoint=null;
  try{
    if(publishedData){status(publishMessage,'現在の公開状態を復元ポイントへ自動保存しています…','loading');backupPoint=await createPublicationBackup('pre-publish');}
    status(publishMessage,'Supabaseへ公開しています。画面を閉じずにお待ちください…','loading');
    const row={id:'site',payload,event_date:payload.eventDate,reaction_deadline_at:jstDeadlineIso(payload.reactionDeadline),reaction_revision:Number(publishedData?.reactionRevision||0),updated_at:new Date().toISOString(),updated_by:currentUser.id};
    const { error }=await supabase.from('ofes_site_state').upsert(row,{onConflict:'id'});if(error)throw error;
    await fetchPublished();status(publishMessage,backupPoint?`Supabaseへの公開が完了しました。公開前の復元ポイント ${backupPoint.backupId} も保存しました。`:'Supabaseへの初回公開が完了しました。別の端末でも同じ内容を閲覧できます。','ok');
  }catch(error){status(publishMessage,`公開に失敗：${errorText(error)}${publishedData?'（公開前バックアップに失敗した場合、新しい内容は公開していません）':''}`,'error');}
  finally{isBusy=false;setUiState();await refreshPublicationBackupInfo();}
});
restorePublishedButton?.addEventListener('click',async()=>{
  if(!isAdmin()||isBusy||!latestPublicationBackup)return;const point=latestPublicationBackup;const when=new Date(point.createdAtClient).toLocaleString('ja-JP');
  if(!confirm(`【公開データの復元】\n\n${when} に自動保存した公開状態へ戻します。\n会場：${point.sourceZoneCount||0}か所\nプログラム：${point.sourceProgramCount||0}件\n\n復元する直前の現在の公開状態も、新しい復元ポイントとして自動保存します。\n\n復元してよろしいですか？`))return;
  isBusy=true;setUiState();
  try{
    if(publishedData){status(publicationBackupMessage,'復元前の現在状態を安全用の復元ポイントへ保存しています…','loading');await createPublicationBackup('pre-restore');}
    status(publicationBackupMessage,'直前の公開状態へ復元しています…','loading');const payload=point.data;if(!payload)throw Error('復元ポイントのデータが不完全です。');
    const { error }=await supabase.from('ofes_site_state').upsert({id:'site',payload,event_date:payload.eventDate,reaction_deadline_at:jstDeadlineIso(payload.reactionDeadline),reaction_revision:Number(publishedData?.reactionRevision||0),updated_at:new Date().toISOString(),updated_by:currentUser.id},{onConflict:'id'});if(error)throw error;
    await fetchPublished();status(publicationBackupMessage,'直前の公開状態へ復元しました。来場者画面にも反映されます。復元前の状態も保存済みです。','ok');
  }catch(error){status(publicationBackupMessage,`復元に失敗：${errorText(error)}`,'error');}
  finally{isBusy=false;setUiState();await refreshPublicationBackupInfo();}
});
loadButton?.addEventListener('click',()=>{if(!publishedData||isBusy)return;if(!confirm('現在のブラウザ内の下書きが、Supabaseの公開データで上書きされます。\n\n必要な場合は先に「下書きの設定JSONを書き出す」でバックアップしてください。\n\n読み込みますか？'))return;try{window.OFESCloud?.importPublishedAsDraft?.();status(publishMessage,'Supabaseの公開データを編集用の下書きに読み込みました。','ok');}catch(e){status(publishMessage,`読み込み失敗：${e.message}`,'error');}});

// -------- Init --------
try{
  if(typeof createClient!=='function')throw Error('Supabase SDKを読み込めませんでした。');
  if(!configured())throw Error('supabase-config.js の Project URL / Publishable key が未設定です。');
  supabase=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  status(sdkStatus,'接続準備完了（Supabase）','ok');status(authStatus,'ログイン状態を確認中…','loading');status(authMessage,'管理者はメールアドレスとパスワードでログインします。');setUiState();
  await fetchPublished();subscribePublished();
  const { data:{ subscription } }=supabase.auth.onAuthStateChange(async(_event,session)=>{await refreshSessionUi(session?.user||null);await restoreCachedReactions();});
  window.addEventListener('beforeunload',()=>{try{subscription.unsubscribe();if(realtimeChannel)supabase.removeChannel(realtimeChannel);}catch{}});
  await refreshSessionUi();await restoreCachedReactions();
  window.addEventListener('ofes-cloud-published',()=>{restoreCachedReactions();refreshRestorePointInfo();});
}catch(error){
  console.error('Supabase initialization failed',error);cloudError=true;cloudLoaded=false;status(sdkStatus,'初期化エラー','error');status(authStatus,'利用不可','error');status(authMessage,errorText(error),'error');status(publishMessage,'Supabaseを初期化できませんでした。','error');status(cloudStatus,'利用不可','error');setUiState();
}
