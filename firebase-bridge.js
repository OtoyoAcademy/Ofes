/**
 * OFES Ver.1.18: Google Authentication + Firestore published content.
 * 管理者はローカル下書きを明示的に公開する。来場者は認証なしで公開データを購読する。
 * セキュリティ境界は Firebase Security Rules（クライアントのパスワードではない）。
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
        browserLocalPersistence, signInAnonymously, setPersistence} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, serverTimestamp, Timestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

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
let isLoggedIn=false, isBusy=false, publishedData=null, lastPublishTime=null, cloudLoaded=false, cloudError=false;
let latestPublicationBackup=null;
const REACTION_KEYS=['good','aha','amazing','fun','cheer'];
const REACTION_LABELS=['👍 よかった','💡 なるほど','✨ すごい','😊 楽しかった','🙌 応援したい'];
let latestStats=null, latestAllStats=[];

function status(node, text, kind='info') {
 if(!node)return;
 node.textContent=text;
 node.classList.remove('firebase-error','firebase-ok','firebase-loading','firebase-info');
 node.classList.add(`firebase-${kind}`);
}
function errorText(error) {
 switch(error?.code){
  case 'permission-denied': return '権限がありません。Firestoreのルールを確認してください。管理者ログインだけでは公開権限は付与されません。';
  case 'auth/unauthorized-domain': return 'このドメインは承認されていません。Firebase Authenticationの承認済みドメインを確認してください。';
  case 'auth/popup-blocked': return 'ログイン用ポップアップがブロックされました。';
  case 'auth/popup-closed-by-user': return 'ログイン画面が閉じられました。';
  case 'auth/cancelled-popup-request': return '別のログイン操作が進行中です。';
  case 'auth/operation-not-allowed': return 'Firebase側でGoogleログインが有効か確認してください。';
  case 'auth/network-request-failed': return '通信に失敗しました。ネットワークを確認してください。';
  case 'auth/operation-not-supported-in-this-environment': return 'GitHub Pagesのhttps://で開いてください。';
  default: return `${error?.code || error?.message || '接続エラー'}`;
 }
}
function setUiState(){
 publishButton.disabled=!isLoggedIn || isBusy || !cloudLoaded || cloudError;
 loadButton.disabled=!publishedData || isBusy;
 if(restorePublishedButton)restorePublishedButton.disabled=!isLoggedIn || isBusy || !latestPublicationBackup;
 if(cloudError){
  status(cloudStatus,'接続エラー','error');
  summary.textContent='公開データにアクセスできません。Firestoreルールとネットワークをご確認ください。';
  summary.classList.add('warning');
 }else if(!cloudLoaded){
  status(cloudStatus,'接続確認中…','loading');
  summary.textContent='Firestoreへの接続を確認中…';
  summary.classList.add('warning');
 }else if(publishedData){
  status(cloudStatus,'公開データあり','ok');
  const n=publishedData.zones?.length || 0, p=publishedData.programs?.length || 0;
  const when=lastPublishTime?`　最終公開：${lastPublishTime}`:'';
  summary.textContent=`公開中：${publishedData.year||'―'}年度／会場${n}か所／プログラム${p}件${when}`;
  summary.classList.remove('warning');
 }else{
  status(cloudStatus,'未公開（初回保存待ち）');
  summary.textContent='Firestoreにはまだ公開データがありません。既存の教室登録を確認し、最初の公開を行ってください。';
  summary.classList.add('warning');
 }
}
try{
 const app=initializeApp(firebaseConfig);
 const auth=getAuth(app);
 const db=getFirestore(app);
 const publicDoc=doc(db,'published','site');
 // 匿名利用者のUIDを再読み込み後も保つ。Google管理者も端末で認証状態を保持する。
 await setPersistence(auth,browserLocalPersistence);
 status(sdkStatus,`接続準備完了（${app.options.projectId}）`,'ok');
 status(authStatus,'ログイン状態を確認中…','loading');
 status(authMessage,'Googleログイン後、UIDと管理者権限を確認できます。');
 setUiState();


 // 来場者用: 1つの発表につき1UID=1文書、5種類を配列として保存。
 // 管理者の集計以外では他人の投票を読み取れない。
 const voteDoc=(date,programId,uid)=>doc(db,'reactionEvents',date,'programs',programId,'votes',uid);
 const selectionCacheKey='ofes-reaction-choices-v14';
 function readSelectionCache(){try{return JSON.parse(localStorage.getItem(selectionCacheKey)||'{}')}catch{return{}}}
 function cacheSelection(date,programId,uid,selected){
  try{const data=readSelectionCache();data[`${date}|${programId}|${uid}`]=selected;localStorage.setItem(selectionCacheKey,JSON.stringify(data));}catch(error){console.warn(error)}
 }
 function emitSelection(programId,selected,uid){
  window.dispatchEvent(new CustomEvent('ofes-reaction-selection',{detail:{programId,selected,uid}}));
 }
 function emitNotice(programId,message){
  window.dispatchEvent(new CustomEvent('ofes-reaction-notice',{detail:{programId,message}}));
 }
 function publishStatus(){
  if(!publishedData?.reactionDeadlineAt)return {ok:false,message:'リアクションの受付準備中です。管理者がVer.1.4で再公開してください。'};
  const end=publishedData.reactionDeadlineAt.toDate?.();
  if(!(end instanceof Date)||!Number.isFinite(end.getTime()))return {ok:false,message:'受付期限が読み取れません。'};
  if(Date.now()>=end.getTime())return {ok:false,message:'リアクションの受付は終了しました。'};
  return {ok:true};
 }
 const reactionBusy=new Set();
 window.OFESReactions={
  toggle:async(programId,key)=>{
   if(!REACTION_KEYS.includes(key)||reactionBusy.has(programId))return;
   reactionBusy.add(programId);
   emitNotice(programId,'送信しています…');
   try{
    const status=publishStatus();if(!status.ok)throw Error(status.message);
    const eventDate=publishedData.eventDate;
    if(!publishedData.programs?.some(p=>(p.reactionId||p.id)===programId))throw Error('公開されていない発表です。');
    let user=auth.currentUser;
    if(!user)user=(await signInAnonymously(auth)).user;
    const ref=voteDoc(eventDate,programId,user.uid);
    // 端末間の変更や、直前の取り消しを反映した正確な状態を取得してから変更する。
    const previous=await getDoc(ref);
    const current=previous.exists()&&Array.isArray(previous.data().selected)?previous.data().selected:[];
    const next=current.includes(key)?current.filter(x=>x!==key):[...current,key];
    if(next.length)await setDoc(ref,{selected:next,version:1,updatedAt:serverTimestamp()});
    else if(previous.exists())await deleteDoc(ref);
    cacheSelection(eventDate,programId,user.uid,next);
    emitSelection(programId,next,user.uid);
    emitNotice(programId,`保存しました。${next.length?`${next.length}種類を選択中。押し直すと取り消せます。`:'リアクションを取り消しました。'}`);
   }catch(error){
    let message=errorText(error);
    if(error?.code==='auth/admin-restricted-operation'||error?.code==='auth/operation-not-allowed')message='Firebase Authenticationの「匿名」を有効にしてください。';
    if(error?.code==='permission-denied')message='送信できません。Firestoreのリアクション用ルール・受付期限を確認してください。';
    emitNotice(programId,`送信できませんでした：${message}`);
   }finally{reactionBusy.delete(programId);}
  }
 };
 // 同じ端末での「選択済み」の表示を再現。送信時には必ずサーバーの本人文書を照会。
 async function restoreCachedReactions(){
  const uid=auth.currentUser?.uid, date=publishedData?.eventDate;if(!uid||!date)return;
  const cache=readSelectionCache();
  const seen=new Set();
  for(const p of publishedData.programs||[]){
   const reactionId=p.reactionId||p.id;if(seen.has(reactionId))continue;seen.add(reactionId);
   const key=`${date}|${reactionId}|${uid}`;
   const cached=cache[key];
   emitSelection(reactionId,Array.isArray(cached)?cached:[],uid);
   try{
    const snap=await getDoc(voteDoc(date,reactionId,uid));
    const selected=snap.exists()&&Array.isArray(snap.data().selected)?snap.data().selected:[];
    cacheSelection(date,reactionId,uid,selected);
    emitSelection(reactionId,selected,uid);
   }catch(error){console.warn('reaction sync failed',reactionId,error);}
  }
 }
 function isReactionTargetProgram(p){
  return !!p && (['s1','s2','s3','s4'].includes(p.session) || p.session==='afternoon');
 }
 function sessionText(p){
  if(['s1','s2','s3','s4'].includes(p.session)){
   const d=publishedData?.sessions?.[p.session];
   return d?.label || ({s1:'セッション①',s2:'セッション②',s3:'セッション③',s4:'セッション④'}[p.session]||p.session);
  }
  return p.session==='afternoon'?'午後':'その他';
 }
 function zoneText(p){
  return publishedData?.zones?.find(z=>z.id===p.zoneId)?.name || (p.zoneId||'会場未設定');
 }
 function gradeLabels(gradeText){
  const text=String(gradeText||'').trim();
  const nums=[...new Set((text.match(/\d+/g)||[]).map(Number).filter(n=>n>=1&&n<=9))].sort((a,b)=>a-b);
  return nums.length?nums.map(n=>`${n}年生`):[text||'全体・その他'];
 }
 function gradeOrder(label){const m=String(label).match(/^(\d+)年生$/);return m?Number(m[1]):99;}
 function reactionTargetGroups(){
  const map=new Map();
  for(const p of (publishedData?.programs||[]).filter(isReactionTargetProgram)){
   const reactionId=p.reactionId||p.id;
   if(!map.has(reactionId))map.set(reactionId,{reactionId,representative:p,occurrences:[]});
   map.get(reactionId).occurrences.push(p);
  }
  return [...map.values()].sort((a,b)=>{
   const pa=a.representative,pb=b.representative;
   const ga=gradeLabels(pa.grade)[0],gb=gradeLabels(pb.grade)[0];
   return gradeOrder(ga)-gradeOrder(gb) || ga.localeCompare(gb,'ja',{numeric:true}) || String(pa.group||'').localeCompare(String(pb.group||''),'ja',{numeric:true}) || String(pa.start||'').localeCompare(String(pb.start||'')) || String(pa.title||'').localeCompare(String(pb.title||''),'ja');
  });
 }
 function renderReactionStatsOptions(){
  const selector=el('reactionStatsProgram');if(!selector)return;
  const chosen=selector.value;
  const groups=reactionTargetGroups();
  selector.replaceChildren(new Option('発表を選んでください',''));
  for(const g of groups){
   const p=g.representative, repeat=g.occurrences.length>1?`（${g.occurrences.length}回実施）`:'';
   selector.add(new Option(`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}${repeat}`,g.reactionId));
  }
  if(groups.some(g=>g.reactionId===chosen))selector.value=chosen;
 }
 async function collectOneTarget(group){
  const p=group.representative;
  const votes=await getDocs(collection(db,'reactionEvents',publishedData.eventDate,'programs',group.reactionId,'votes'));
  const counts=Object.fromEntries(REACTION_KEYS.map(k=>[k,0]));
  for(const snap of votes.docs){const choices=snap.data().selected||[];for(const k of REACTION_KEYS){if(choices.includes(k))counts[k]++;}}
  const occurrences=[...group.occurrences].sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')));
  const schedules=occurrences.map(x=>`${sessionText(x)} ${x.start||''}〜${x.end||''}`);
  const zoneNames=[...new Set(occurrences.map(zoneText))];
  const grade=String(p.grade||'').trim()||'全体・その他';
  return {reactionId:group.reactionId,grade,gradeLabels:gradeLabels(grade),groupName:String(p.group||'').trim()||'グループ未設定',title:p.title||'発表',zoneName:zoneNames.join('／'),schedules,respondents:votes.size,counts};
 }
 const statsButton=el('reactionStatsLoad'),statsOut=el('reactionStatsResult'),statsMessage=el('reactionStatsMessage');
 statsButton.addEventListener('click',async()=>{
  const reactionId=el('reactionStatsProgram').value;
  const group=reactionTargetGroups().find(g=>g.reactionId===reactionId);
  if(!group){statsMessage.textContent='集計する発表を選択してください。';return;}
  if(!auth.currentUser?.providerData?.some(x=>x.providerId==='google.com')){
   statsMessage.textContent='管理者Googleログインが必要です。';return;
  }
  statsButton.disabled=true;statsOut.hidden=true;el('reactionStatsExport').disabled=true;
  statsMessage.textContent='Firestoreから集計しています…';
  try{
   const item=await collectOneTarget(group),p=group.representative;
   statsOut.replaceChildren();
   const heading=document.createElement('strong');heading.textContent=`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`;statsOut.append(heading);
   const schedule=document.createElement('p');schedule.textContent=`実施：${item.schedules.join('／')}　会場：${item.zoneName}`;statsOut.append(schedule);
   const total=document.createElement('p');total.textContent=`回答者数：${item.respondents}（同じ発表を複数セッションで実施した場合も合算します。1人が複数種類を選択できます）`;statsOut.append(total);
   REACTION_KEYS.forEach((key,i)=>{
    const row=document.createElement('div');row.className='reaction-stat-row';
    const label=document.createElement('span');label.textContent=REACTION_LABELS[i];
    const n=document.createElement('strong');n.textContent=`${item.counts[key]} 件`;
    row.append(label,n);statsOut.append(row);
   });
   latestStats={programTitle:`${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`,grade:item.grade,groupName:item.groupName,year:publishedData.year,eventDate:publishedData.eventDate,counts:item.counts,respondents:item.respondents,schedules:item.schedules,zoneName:item.zoneName};
   statsOut.hidden=false;el('reactionStatsExport').disabled=false;
   statsMessage.textContent='集計しました。順位付けは行っていません。';
  }catch(error){statsMessage.textContent=`集計できませんでした：${errorText(error)}`;}
  finally{statsButton.disabled=false;}
 });
 el('reactionStatsExport').addEventListener('click',()=>{
  if(!latestStats)return;
  const rows=[['対象学年',latestStats.grade],['発表グループ',latestStats.groupName],['発表',latestStats.programTitle],['年度',latestStats.year],['開催日',latestStats.eventDate],['実施時間',latestStats.schedules.join(' / ')],['会場',latestStats.zoneName],['回答者数',latestStats.respondents],...REACTION_KEYS.map((k,i)=>[REACTION_LABELS[i],latestStats.counts[k]])];
  const csv='\ufeff'+rows.map(cols=>cols.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`OFES_リアクション集計_${latestStats.eventDate}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 });

 const allButton=el('reactionStatsLoadAll'),allOut=el('reactionStatsAllResult'),allMessage=el('reactionStatsAllMessage'),pdfOverallButton=el('reactionStatsPdfOverall'),pdfGradeButton=el('reactionStatsPdfGrade');
 function statsByGrade(){
  const groups=new Map();
  for(const item of latestAllStats){
   for(const grade of item.gradeLabels||[item.grade]){if(!groups.has(grade))groups.set(grade,[]);groups.get(grade).push(item);}
  }
  return [...groups.entries()].sort((a,b)=>gradeOrder(a[0])-gradeOrder(b[0])||a[0].localeCompare(b[0],'ja',{numeric:true})).map(([grade,items])=>[grade,items.slice().sort((a,b)=>String(a.groupName).localeCompare(String(b.groupName),'ja',{numeric:true})||String(a.title).localeCompare(String(b.title),'ja'))]);
 }
 function renderAllStats(){
  if(!allOut)return;
  allOut.replaceChildren();
  for(const [grade,items] of statsByGrade()){
   const group=document.createElement('section');group.className='reaction-grade-group';
   const h=document.createElement('h4');h.textContent=grade;group.append(h);
   const wrap=document.createElement('div');wrap.className='reaction-all-table-wrap';
   const table=document.createElement('table');table.className='reaction-all-table';
   table.innerHTML='<thead><tr><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答者</th><th>👍</th><th>💡</th><th>✨</th><th>😊</th><th>🙌</th></tr></thead>';
   const tbody=document.createElement('tbody');
   for(const item of items){
    const tr=document.createElement('tr');
    const joint=item.gradeLabels?.length>1?`（${item.grade}合同）`:'';
    const values=[`${item.groupName}${joint}`,item.title,item.schedules.join('／'),item.zoneName,String(item.respondents),...REACTION_KEYS.map(k=>String(item.counts[k]))];
    values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i>=4)td.classList.add('count');tr.append(td);});
    tbody.append(tr);
   }
   table.append(tbody);wrap.append(table);group.append(wrap);allOut.append(group);
  }
 }
 allButton?.addEventListener('click',async()=>{
  if(!auth.currentUser?.providerData?.some(x=>x.providerId==='google.com')){allMessage.textContent='管理者Googleログインが必要です。';return;}
  const groups=reactionTargetGroups();
  if(!groups.length){allMessage.textContent='集計対象の発表がありません。';return;}
  allButton.disabled=true;if(pdfOverallButton)pdfOverallButton.disabled=true;if(pdfGradeButton)pdfGradeButton.disabled=true;allOut.hidden=true;latestAllStats=[];
  allMessage.textContent=`全${groups.length}発表をFirestoreから集計しています…`;
  try{
   const results=[];
   for(let i=0;i<groups.length;i++){
    const p=groups[i].representative;
    allMessage.textContent=`集計中 ${i+1}/${groups.length}：${p.grade?`${p.grade} `:''}${p.group?`${p.group} `:''}${p.title}`;
    results.push(await collectOneTarget(groups[i]));
   }
   latestAllStats=results;renderAllStats();allOut.hidden=false;if(pdfOverallButton)pdfOverallButton.disabled=false;if(pdfGradeButton)pdfGradeButton.disabled=false;
   const totalRespondents=results.reduce((sum,x)=>sum+x.respondents,0);
   allMessage.textContent=`全${results.length}発表グループを集計しました。グループごとの集計を保持しています。各発表の回答者数の合計は${totalRespondents}です。`;
  }catch(error){allMessage.textContent=`一括集計できませんでした：${errorText(error)}`;}
  finally{allButton.disabled=false;}
 });
 function htmlEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
 function openReactionPrintWindow(name,title,bodyHtml,extraCss=''){
  const w=window.open('',name,'width=1100,height=850');
  if(!w){allMessage.textContent='PDF出力画面を開けませんでした。ポップアップを許可してください。';return null;}
  const css=`@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:#172019;margin:0;font-size:9pt}h1{font-size:17pt;margin:0 0 2mm}h2{font-size:14pt;margin:0 0 2.5mm;border-left:5px solid #197a4b;padding-left:8px}.meta{margin:0 0 4mm;color:#526058;font-size:8.5pt}.message{margin:0 0 4mm;padding:3mm 4mm;border-radius:8px;background:#f1f8f2;border:1px solid #cfe0d1;font-size:9.2pt;line-height:1.55}.message strong{font-size:10.5pt;color:#176c42}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #cfd7d0;padding:2mm 1.5mm;vertical-align:top;overflow-wrap:anywhere}th{background:#edf4ee;font-size:8.2pt}th.react,td.react{text-align:center;padding-left:.7mm;padding-right:.7mm}td.num{text-align:center;font-weight:700}.joint{display:block;margin-top:1mm;color:#637168;font-size:7.2pt;line-height:1.3}.note{margin-top:3mm;font-size:8pt;color:#59655d}.printbar{position:fixed;top:10px;right:10px;z-index:5}.printbar button{padding:9px 14px;font-size:14px}.grade-page{break-after:page;page-break-after:always}.grade-page:last-of-type{break-after:auto;page-break-after:auto}${extraCss}@media print{.printbar{display:none}}`;
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${htmlEsc(title)}</title><style>${css}</style></head><body><div class="printbar"><button onclick="window.print()">印刷／PDFとして保存</button></div>${bodyHtml}</body></html>`;
  w.document.open();w.document.write(html);w.document.close();return w;
 }
 function overallStatsSorted(){
  return latestAllStats.slice().sort((a,b)=>{
   const ga=a.gradeLabels?.[0]||a.grade,gb=b.gradeLabels?.[0]||b.grade;
   return gradeOrder(ga)-gradeOrder(gb)||String(a.grade).localeCompare(String(b.grade),'ja',{numeric:true})||String(a.groupName).localeCompare(String(b.groupName),'ja',{numeric:true})||String(a.title).localeCompare(String(b.title),'ja');
  });
 }
 pdfOverallButton?.addEventListener('click',()=>{
  if(!latestAllStats.length)return;
  const rows=overallStatsSorted().map(item=>`<tr><td>${htmlEsc(item.grade)}</td><td>${htmlEsc(item.groupName)}</td><td>${htmlEsc(item.title)}</td><td>${item.schedules.map(htmlEsc).join('<br>')}</td><td>${htmlEsc(item.zoneName)}</td><td class="num">${item.respondents}</td>${REACTION_KEYS.map(k=>`<td class="num react">${item.counts[k]}</td>`).join('')}</tr>`).join('');
  const body=`<h1>OFES リアクション全体集計</h1><p class="meta">${htmlEsc(publishedData.year||'')}年度　開催日：${htmlEsc(publishedData.eventDate||'')}　全発表グループを重複なく一覧表示しています。</p><table><colgroup><col class="c-grade"><col class="c-group"><col class="c-title"><col class="c-time"><col class="c-place"><col class="c-respond"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"></colgroup><thead><tr><th>学年</th><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答</th><th class="react">👍</th><th class="react">💡</th><th class="react">✨</th><th class="react">😊</th><th class="react">🙌</th></tr></thead><tbody>${rows}</tbody></table><p class="note">※ 合同発表も全体版では1つの発表グループとして1行だけ掲載します。個人を特定する情報は掲載していません。</p>`;
  openReactionPrintWindow('OFES_REACTION_ALL','OFES リアクション全体集計',body,'col.c-grade{width:8%}col.c-group{width:8%}col.c-title{width:27%}col.c-time{width:19%}col.c-place{width:10%}col.c-respond{width:4%}col.c-react{width:4.8%}');
 });
 pdfGradeButton?.addEventListener('click',()=>{
  if(!latestAllStats.length)return;
  const sections=statsByGrade().map(([grade,items])=>`<section class="grade-page"><h1>OFES リアクションフィードバック</h1><h2>${htmlEsc(grade)}のみなさんへ</h2><div class="message"><strong>発表、おつかれさまでした！</strong><br>この表は、みなさんの発表を見た人から届いたリアクションをまとめたものです。数字の大小は順位ではありません。どんなところが伝わったのか、どんなよさや工夫があったのかを振り返り、次の学びや発表につなげていきましょう。</div><p class="meta">${htmlEsc(publishedData.year||'')}年度　開催日：${htmlEsc(publishedData.eventDate||'')}</p><table><colgroup><col class="c-group"><col class="c-title"><col class="c-time"><col class="c-place"><col class="c-respond"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"><col class="c-react"></colgroup><thead><tr><th>グループ</th><th>発表内容</th><th>実施時間</th><th>会場</th><th>回答</th><th class="react">👍</th><th class="react">💡</th><th class="react">✨</th><th class="react">😊</th><th class="react">🙌</th></tr></thead><tbody>${items.map(item=>`<tr><td>${htmlEsc(item.groupName)}${item.gradeLabels?.length>1?`<small class="joint">${htmlEsc(item.grade)}合同</small>`:''}</td><td>${htmlEsc(item.title)}</td><td>${item.schedules.map(htmlEsc).join('<br>')}</td><td>${htmlEsc(item.zoneName)}</td><td class="num">${item.respondents}</td>${REACTION_KEYS.map(k=>`<td class="num react">${item.counts[k]}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">※ 合同発表は、関係するそれぞれの学年のページに同じ集計を掲載しています。リアクションは発表グループごとの集計です。</p></section>`).join('');
  openReactionPrintWindow('OFES_REACTION_BY_GRADE','OFES 学年別リアクションフィードバック',sections,'col.c-group{width:9%}col.c-title{width:32%}col.c-time{width:24%}col.c-place{width:10%}col.c-respond{width:5%}col.c-react{width:4%}.grade-page{min-height:185mm}');
 });

 // Ver.1.11: 管理者用「全クリア」。削除前にFirestoreへ復元ポイントを作成し、成功した場合だけ削除する。
 const clearButton=el('reactionClearAll'),restoreButton=el('reactionRestoreLatest'),clearMessage=el('reactionClearMessage'),restorePointLabel=el('reactionRestorePoint');
 let latestRestorePoint=null;
 const isGoogleAdmin=()=>!!auth.currentUser?.providerData?.some(x=>x.providerId==='google.com');

 // Ver.1.17: Firestore公開前の公開データを自動保存し、直前状態へ戻せるようにする。
 const publicationBackupRef=(backupId)=>doc(db,'publicationBackups','site','points',backupId);
 const publicationBackupCol=()=>collection(db,'publicationBackups','site','points');
 async function createPublicationBackup(reason='pre-publish'){
  if(!publishedData)return null;
  if(!isGoogleAdmin())throw Error('管理者Googleログインが必要です。');
  const backupId=`pb-${Date.now()}`, createdAtClient=new Date().toISOString();
  await setDoc(publicationBackupRef(backupId),{
   schemaVersion:1,complete:true,reason,createdAt:serverTimestamp(),createdAtClient,createdByUid:auth.currentUser.uid,
   sourceYear:publishedData.year||'',sourceEventDate:publishedData.eventDate||'',
   sourceZoneCount:publishedData.zones?.length||0,sourceProgramCount:publishedData.programs?.length||0,
   data:publishedData
  });
  return {backupId,createdAtClient,sourceYear:publishedData.year||'',sourceZoneCount:publishedData.zones?.length||0,sourceProgramCount:publishedData.programs?.length||0,data:publishedData};
 }
 async function refreshPublicationBackupInfo(){
  latestPublicationBackup=null;
  if(!publicationBackupSummary||!restorePublishedButton)return;
  restorePublishedButton.disabled=true;
  if(!isGoogleAdmin()){
   publicationBackupSummary.textContent='管理者Googleログイン後に復元ポイントを確認できます。';
   if(publicationBackupMessage)publicationBackupMessage.textContent='公開前バックアップは管理者だけが読み書きできます。';
   return;
  }
  publicationBackupSummary.textContent='復元ポイントを確認中…';
  try{
   const snap=await getDocs(publicationBackupCol());
   const points=snap.docs.map(d=>({backupId:d.id,...d.data()})).filter(x=>x.complete&&x.data).sort((a,b)=>String(b.createdAtClient||'').localeCompare(String(a.createdAtClient||'')));
   latestPublicationBackup=points[0]||null;
   if(!latestPublicationBackup){
    publicationBackupSummary.textContent='復元ポイントはまだありません。2回目以降の「Firestoreへ公開」で自動作成されます。';
    if(publicationBackupMessage)publicationBackupMessage.textContent='初回公開の前には戻す元の公開データがないため、復元ポイントは作成されません。';
    return;
   }
   const when=new Date(latestPublicationBackup.createdAtClient).toLocaleString('ja-JP');
   publicationBackupSummary.textContent=`直前の復元ポイント：${when}／${latestPublicationBackup.sourceYear||'―'}年度／会場${latestPublicationBackup.sourceZoneCount||0}か所／プログラム${latestPublicationBackup.sourceProgramCount||0}件`;
   if(publicationBackupMessage)publicationBackupMessage.textContent='「直前の公開状態へ戻す」を押すと、この復元ポイントを公開データへ戻します。';
   restorePublishedButton.disabled=isBusy;
  }catch(error){
   publicationBackupSummary.textContent=`復元ポイントを確認できませんでした：${errorText(error)}`;
   if(publicationBackupMessage)publicationBackupMessage.textContent='Firestoreルールに publicationBackups の管理者権限があるか確認してください。';
  }
 }
 async function commitOps(ops){
  for(let i=0;i<ops.length;i+=450){
   const batch=writeBatch(db);
   for(const op of ops.slice(i,i+450)){
    if(op.type==='delete')batch.delete(op.ref);else batch.set(op.ref,op.data);
   }
   await batch.commit();
  }
 }
 async function currentVoteSnapshot(){
  if(!publishedData?.eventDate)throw Error('公開データがありません。');
  const programIds=[...new Set(reactionTargetGroups().map(g=>g.reactionId))];
  const votes=[];
  for(const programId of programIds){
   const snap=await getDocs(collection(db,'reactionEvents',publishedData.eventDate,'programs',programId,'votes'));
   for(const d of snap.docs)votes.push({programId,voterUid:d.id,data:d.data(),liveRef:d.ref});
  }
  return {programIds,votes};
 }
 async function createRestorePoint(){
  const {programIds,votes}=await currentVoteSnapshot();
  if(!votes.length)return null;
  const eventDate=publishedData.eventDate,backupId=`rp-${Date.now()}`,createdAtClient=new Date().toISOString();
  const ops=votes.map(v=>({type:'set',ref:doc(db,'reactionBackups',eventDate,'points',backupId,'programs',v.programId,'votes',v.voterUid),data:{selected:Array.isArray(v.data.selected)?v.data.selected:[],version:Number(v.data.version||1),originalUpdatedAt:v.data.updatedAt||null}}));
  await commitOps(ops);
  await setDoc(doc(db,'reactionBackups',eventDate,'points',backupId),{schemaVersion:1,complete:true,eventDate,programIds,voteCount:votes.length,createdAt:serverTimestamp(),createdAtClient,createdByUid:auth.currentUser.uid});
  return {backupId,eventDate,programIds,voteCount:votes.length,createdAtClient,votes};
 }
 async function refreshRestorePointInfo(){
  if(!restorePointLabel||!restoreButton)return;
  latestRestorePoint=null;
  restoreButton.disabled=true;
  if(!isGoogleAdmin()||!publishedData?.eventDate){restorePointLabel.textContent='管理者Googleログイン後に復元ポイントを確認できます。';return;}
  try{
   const snap=await getDocs(collection(db,'reactionBackups',publishedData.eventDate,'points'));
   const points=snap.docs.map(d=>({backupId:d.id,...d.data()})).filter(x=>x.complete).sort((a,b)=>String(b.createdAtClient||'').localeCompare(String(a.createdAtClient||'')));
   latestRestorePoint=points[0]||null;
   if(!latestRestorePoint){restorePointLabel.textContent='復元ポイントはまだありません。全クリアを実行すると直前に自動作成されます。';return;}
   const when=new Date(latestRestorePoint.createdAtClient).toLocaleString('ja-JP');
   restorePointLabel.textContent=`最新の復元ポイント：${when}／${latestRestorePoint.voteCount||0}件`;
   restoreButton.disabled=false;
  }catch(error){restorePointLabel.textContent=`復元ポイントを確認できませんでした：${errorText(error)}`;}
 }
 function resetStatsAfterMutation(message){
  latestStats=null;latestAllStats=[];
  if(statsOut)statsOut.hidden=true;if(allOut)allOut.hidden=true;
  if(el('reactionStatsExport'))el('reactionStatsExport').disabled=true;if(pdfOverallButton)pdfOverallButton.disabled=true;if(pdfGradeButton)pdfGradeButton.disabled=true;
  if(allMessage)allMessage.textContent=message;if(statsMessage)statsMessage.textContent='リアクションが変更されたため、必要に応じて再集計してください。';
 }
 clearButton?.addEventListener('click',async()=>{
  if(!isGoogleAdmin()){clearMessage.textContent='管理者Googleログインが必要です。';return;}
  if(!publishedData?.eventDate){clearMessage.textContent='公開データがありません。';return;}
  const ok=confirm('【リアクション全クリア】\n\n現在公開中の発表に保存されているリアクションをすべて削除します。\n削除の直前にFirestoreへ復元ポイントを自動保存し、復元ポイントの保存に成功した場合だけクリアします。\n\n続けますか？');
  if(!ok)return;
  clearButton.disabled=true;restoreButton.disabled=true;clearMessage.textContent='復元ポイントを作成しています…';
  try{
   const point=await createRestorePoint();
   if(!point){clearMessage.textContent='保存されているリアクションがないため、クリアは実行しませんでした。';await refreshRestorePointInfo();return;}
   clearMessage.textContent=`復元ポイントを保存しました（${point.voteCount}件）。続けて全クリアしています…`;
   await commitOps(point.votes.map(v=>({type:'delete',ref:v.liveRef})));
   await setDoc(publicDoc,{reactionRevision:Date.now()},{merge:true});
   resetStatsAfterMutation(`全リアクションをクリアしました。復元ポイント ${point.backupId} から戻せます。`);
   clearMessage.textContent=`全リアクションをクリアしました。クリア直前の${point.voteCount}件を復元ポイントとして保存済みです。`;
   await refreshRestorePointInfo();
  }catch(error){clearMessage.textContent=`全クリアを中止しました：${errorText(error)}。復元ポイントの保存または削除処理が完了していません。`;await refreshRestorePointInfo();}
  finally{clearButton.disabled=!isGoogleAdmin();}
 });
 restoreButton?.addEventListener('click',async()=>{
  if(!isGoogleAdmin()){clearMessage.textContent='管理者Googleログインが必要です。';return;}
  await refreshRestorePointInfo();
  const point=latestRestorePoint;if(!point)return;
  const when=new Date(point.createdAtClient).toLocaleString('ja-JP');
  if(!confirm(`最新の復元ポイント（${when}／${point.voteCount||0}件）からリアクションを復元します。\n現在のリアクションは、この復元ポイントの内容に置き換わります。\n\n復元しますか？`))return;
  clearButton.disabled=true;restoreButton.disabled=true;clearMessage.textContent='復元ポイントを読み込んでいます…';
  try{
   const programIds=Array.isArray(point.programIds)?point.programIds:[];
   const live=await currentVoteSnapshot();
   await commitOps(live.votes.map(v=>({type:'delete',ref:v.liveRef})));
   const restoreOps=[];
   let restored=0;
   for(const programId of programIds){
    const snap=await getDocs(collection(db,'reactionBackups',point.eventDate,'points',point.backupId,'programs',programId,'votes'));
    for(const d of snap.docs){
     const data=d.data();
     restoreOps.push({type:'set',ref:voteDoc(point.eventDate,programId,d.id),data:{selected:Array.isArray(data.selected)?data.selected:[],version:Number(data.version||1),updatedAt:serverTimestamp()}});
     restored++;
    }
   }
   await commitOps(restoreOps);
   await setDoc(publicDoc,{reactionRevision:Date.now()},{merge:true});
   resetStatsAfterMutation(`復元ポイントから${restored}件を復元しました。`);
   clearMessage.textContent=`復元しました：${restored}件。必要に応じて「全発表を一括集計」で確認してください。`;
  }catch(error){clearMessage.textContent=`復元できませんでした：${errorText(error)}`;}
  finally{clearButton.disabled=!isGoogleAdmin();await refreshRestorePointInfo();}
 });

 window.addEventListener('ofes-cloud-published',()=>{restoreCachedReactions();refreshRestorePointInfo();});
 onAuthStateChanged(auth,()=>{restoreCachedReactions();});

 // Firestore listener: visitors require no sign-in. Fetches once and listens for publication updates.
 onSnapshot(publicDoc, (snapshot)=>{
  publishedData=snapshot.exists()?snapshot.data():null;
  lastPublishTime=publishedData?.updatedAt?.toDate?.().toLocaleString('ja-JP')||null;
  cloudLoaded=true;cloudError=false;
  setUiState();
  renderReactionStatsOptions();
  if(isGoogleAdmin())refreshPublicationBackupInfo();
  window.dispatchEvent(new CustomEvent('ofes-cloud-published',{detail:{data:publishedData}}));
 },(error)=>{
  cloudError=true;cloudLoaded=false;setUiState();
  status(publishMessage,`公開データの取得に失敗：${errorText(error)}`,'error');
 });

 onAuthStateChanged(auth, user=>{
  const isGoogle=!!user?.providerData?.some(provider=>provider.providerId==='google.com');
  isLoggedIn=isGoogle;
  signInButton.hidden=isGoogle;
  signInButton.disabled=false;
  signOutButton.hidden=!isGoogle;
  readButton.disabled=!isGoogle;
  account.hidden=!isGoogle;
  window.dispatchEvent(new CustomEvent('ofes-reaction-uid',{detail:{uid:user?.uid||''}}));
  setUiState();
  if(clearButton)clearButton.disabled=!isGoogle;if(restoreButton&&!isGoogle)restoreButton.disabled=true;refreshRestorePointInfo();
  refreshPublicationBackupInfo();
  status(readResult,isGoogle?'Firestoreの読み取り権限を確認できます。':'管理者Googleログイン後に確認できます。');
  if(isGoogle){
   status(authStatus,'Googleログイン成功','ok');
   el('firebaseUserEmail').textContent=user.email||'メールアドレスなし';
   el('firebaseUserUid').value=user.uid;
   status(authMessage,'ログインできました。Firestoreへの書き込み可否はセキュリティルールで確認されます。','ok');
   status(publishMessage,'編集内容を公開する前に、JSONバックアップと内容の確認をおすすめします。');
  }else{
   status(authStatus,user?.isAnonymous?'来場者として匿名認証中':'管理者は未ログイン');
   el('firebaseUserEmail').textContent='';el('firebaseUserUid').value='';
   status(authMessage,'「Googleでログイン」で管理者のGoogleアカウントを選択してください。来場者の匿名認証では公開権限は付きません。');
   status(publishMessage,'管理者Googleログイン後に公開できます。');
  }
 },error=>{
  status(authStatus,'認証状態の取得に失敗','error');
  status(authMessage,errorText(error),'error');
 });

 signInButton.addEventListener('click',async()=>{
  signInButton.disabled=true;
  status(authMessage,'Googleのログイン画面を開いています…','loading');
  try{await signInWithPopup(auth,new GoogleAuthProvider());}
  catch(error){status(authMessage,errorText(error),'error');}
  finally{signInButton.disabled=false;}
 });
 signOutButton.addEventListener('click',async()=>{
  signOutButton.disabled=true;
  try{await signOut(auth);}catch(error){status(authMessage,errorText(error),'error');}
  finally{signOutButton.disabled=false;}
 });
 el('firebaseCopyUid').addEventListener('click',async()=>{
  const value=el('firebaseUserUid').value;
  if(!value)return;
  try{await navigator.clipboard.writeText(value);status(authMessage,'UIDをコピーしました。','ok');}
  catch(error){el('firebaseUserUid').focus();el('firebaseUserUid').select();status(authMessage,'UIDを選択しました。Ctrl+Cなどでコピーしてください。');}
 });
 readButton.addEventListener('click',async()=>{
  readButton.disabled=true;
  status(readResult,'Firestoreを確認中…','loading');
  try{
   const snap=await getDoc(doc(db,'ofes_connection_tests','read_probe'));
   status(readResult,snap.exists()?'読み取り成功：診断用データがあります。':'読み取り成功：診断用データはまだありません。','ok');
  }catch(error){status(readResult,`読み取り失敗：${errorText(error)}`,'error');}
  finally{readButton.disabled=!auth.currentUser;}
 });
 publishButton.addEventListener('click',async()=>{
  if(!auth.currentUser||isBusy||!cloudLoaded||cloudError)return;
  const payload=window.OFESCloud?.exportPublished?.();
  if(!payload)return status(publishMessage,'下書きが取得できません。画面を再読み込みしてください。','error');
  const before=publishedData?`現在の公開データ（会場${publishedData.zones?.length||0}か所）を上書きします。`:'初めての公開です。';
  const warning=publishedData?.zones?.length>payload.zones.length?'\n【注意】現在の公開会場数より下書きの会場数が少なくなっています。ほかの端末で教室登録を進めている場合は、公開しないでください。\n':'';
  if(!confirm(`${before}\n${warning}\n年度：${payload.year}\n会場：${payload.zones.length}か所\nプログラム：${payload.programs.length}件\n受付終了：${payload.reactionDeadline}（日本時間）\n\nこの内容を来場者向けに公開してよろしいですか？`))return;
  isBusy=true;setUiState();
  let backupPoint=null;
  try{
   // 既存公開データがある場合は、上書きの前に必ず復元ポイントを作る。保存に失敗したら公開もしない。
   if(publishedData){
    status(publishMessage,'現在の公開状態を復元ポイントへ自動保存しています…','loading');
    backupPoint=await createPublicationBackup('pre-publish');
   }
   status(publishMessage,'Firestoreへ公開しています。画面を閉じずにお待ちください…','loading');
   // Firestore Rules: only allow this path's write for the admin UID.
   const deadlineDate=new Date(`${payload.reactionDeadline}:00+09:00`);
   if(!Number.isFinite(deadlineDate.getTime()))throw Error('リアクション受付終了日時の形式が正しくありません。');
   // ファイル内の旧スキーマは変えず、公開ドキュメントにだけ timestamp を追加する。
   await setDoc(publicDoc,{...payload,programIds:[...new Set(payload.programs.map(p=>p.reactionId||p.id))],reactionDeadlineAt:Timestamp.fromDate(deadlineDate),reactionRevision:Number(publishedData?.reactionRevision||0),updatedAt:serverTimestamp(),updatedByUid:auth.currentUser.uid});
   status(publishMessage,backupPoint?`Firestoreへの公開が完了しました。公開前の復元ポイント ${backupPoint.backupId} も保存しました。`:'Firestoreへの初回公開が完了しました。別の端末でも同じ内容を閲覧できます。','ok');
  }catch(error){status(publishMessage,`公開に失敗：${errorText(error)}${publishedData?'（公開前バックアップに失敗した場合、新しい内容は公開していません）':''}`,'error');}
  finally{isBusy=false;setUiState();await refreshPublicationBackupInfo();}
 });
 restorePublishedButton?.addEventListener('click',async()=>{
  if(!isGoogleAdmin()||isBusy||!latestPublicationBackup)return;
  const point=latestPublicationBackup;
  const when=new Date(point.createdAtClient).toLocaleString('ja-JP');
  if(!confirm(`【公開データの復元】\n\n${when} に自動保存した公開状態へ戻します。\n会場：${point.sourceZoneCount||0}か所\nプログラム：${point.sourceProgramCount||0}件\n\n復元する直前の現在の公開状態も、新しい復元ポイントとして自動保存します。\n\n復元してよろしいですか？`))return;
  isBusy=true;setUiState();
  try{
   if(publishedData){
    status(publicationBackupMessage,'復元前の現在状態を安全用の復元ポイントへ保存しています…','loading');
    await createPublicationBackup('pre-restore');
   }
   status(publicationBackupMessage,'直前の公開状態へ復元しています…','loading');
   const backupSnap=await getDoc(publicationBackupRef(point.backupId));
   if(!backupSnap.exists())throw Error('復元ポイントが見つかりません。');
   const backup=backupSnap.data();
   if(!backup.complete||!backup.data)throw Error('復元ポイントのデータが不完全です。');
   await setDoc(publicDoc,{...backup.data,updatedAt:serverTimestamp(),updatedByUid:auth.currentUser.uid,restoredFromBackupId:point.backupId});
   status(publicationBackupMessage,'直前の公開状態へ復元しました。来場者画面にも反映されます。復元前の状態も保存済みです。','ok');
  }catch(error){
   status(publicationBackupMessage,`復元に失敗：${errorText(error)}`,'error');
  }finally{
   isBusy=false;setUiState();await refreshPublicationBackupInfo();
  }
 });

 loadButton.addEventListener('click',()=>{
  if(!publishedData||isBusy)return;
  if(!confirm('現在のブラウザ内の下書きが、Firestoreの公開データで上書きされます。\n\n必要な場合は先に「下書きの設定JSONを書き出す」でバックアップしてください。\n\n読み込みますか？'))return;
  try{
   window.OFESCloud?.importPublishedAsDraft?.();
   status(publishMessage,'Firestoreの公開データを編集用の下書きに読み込みました。','ok');
  }catch(e){status(publishMessage,`読み込み失敗：${e.message}`,'error');}
 });
}catch(error){
 console.error('Firebase SDK initialization failed',error);
 status(sdkStatus,'初期化エラー','error');
 status(authStatus,'利用不可','error');
 status(authMessage,errorText(error),'error');
 status(publishMessage,'Firebase SDKを読み込めませんでした。','error');
 status(cloudStatus,'利用不可','error');
}
