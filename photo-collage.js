(()=>{
'use strict';
const $=id=>document.getElementById(id);
const REACTIONS=[['good','👍','よかった'],['learned','💡','なるほど'],['wow','✨','すごい'],['fun','😊','楽しかった'],['support','🙌','応援したい']];
const MAX_PHOTOS=40;
let photos=[];
let seed=133;
let reactionSummary=null;
let renderBusy=false;
let lastProgramKey='';

function appData(){
  try{return window.OFESCloud?.exportArchive?.()||null;}catch{return null;}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function timeNum(t){const [h,m]=String(t||'00:00').split(':').map(Number);return (h||0)*60+(m||0);}
function orderedPrograms(data){
  return [...(data?.programs||[])].sort((a,b)=>timeNum(a.start)-timeNum(b.start)||String(a.title||'').localeCompare(String(b.title||''),'ja'));
}
function programGroups(){
  const data=appData();if(!data)return [];
  const ps=orderedPrograms(data),out=[];
  const afternoon=ps.filter(p=>p.session==='afternoon');
  if(afternoon.length)out.push({key:'group:afternoon',label:`午後の有志発表（まとめ・${afternoon.length}件）`,title:'午後の有志発表',ids:afternoon.map(p=>p.id),programs:afternoon});
  const choir=ps.filter(p=>/合唱/.test(`${p.title||''} ${p.group||''}`));
  if(choir.length>1)out.push({key:'group:choir',label:`合唱（まとめ・${choir.length}件）`,title:'合唱',ids:choir.map(p=>p.id),programs:choir});
  for(const p of ps){
    const prefix=[p.grade,p.group].filter(Boolean).join(' ');
    out.push({key:`program:${p.id}`,label:`${p.start||''} ${prefix?prefix+' ':''}${p.title||'発表'}`.trim(),title:p.title||'発表',ids:[p.id],programs:[p]});
  }
  return out;
}
function selectedGroup(){const key=$('photoProgramSelect')?.value;return programGroups().find(g=>g.key===key)||null;}
function reactionIdsForGroup(group){return [...new Set((group?.programs||[]).filter(p=>['s1','s2','s3','s4','afternoon'].includes(p.session)).map(p=>p.reactionId||p.id).filter(Boolean))];}
function renderProgramOptions(force=false){
  const sel=$('photoProgramSelect');if(!sel)return;
  const groups=programGroups();const current=force?'':sel.value;
  sel.innerHTML=groups.length?groups.map(g=>`<option value="${esc(g.key)}">${esc(g.label)}</option>`).join(''):'<option value="">プログラムがありません</option>';
  if(current&&groups.some(g=>g.key===current))sel.value=current;
  else if(groups.length)sel.value=groups[0].key;
  if(force||!$('photoSheetTitle')?.value){const g=selectedGroup();if($('photoSheetTitle'))$('photoSheetTitle').value=g?.title||'';}
  lastProgramKey=sel.value;
}
async function refreshReactions(){
  const status=$('photoReactionStatus'),group=selectedGroup();reactionSummary=null;
  if(!group){if(status)status.textContent='プログラムを選択してください。';renderPreview();return null;}
  const ids=reactionIdsForGroup(group);
  if(!$('photoShowReactions')?.checked){if(status)status.textContent='リアクション表示はオフです。';renderPreview();return null;}
  if(!ids.length){if(status)status.textContent='このプログラムにはリアクション対象の発表がありません。';renderPreview();return null;}
  if(!window.OFESPhotoReactions?.collect){if(status)status.textContent='Supabaseの集計機能を準備しています。管理者ログイン後にもう一度お試しください。';renderPreview();return null;}
  try{
    if(status)status.textContent='Supabaseからリアクションを集計しています…';
    reactionSummary=await window.OFESPhotoReactions.collect(ids);
    if(status)status.textContent=`リアクションを取得しました（対象${reactionSummary.targetCount||ids.length}発表）。`;
    await renderPreview();return reactionSummary;
  }catch(err){
    if(status)status.textContent=`リアクションを取得できませんでした：${err?.message||err}`;
    reactionSummary=null;await renderPreview();return null;
  }
}

function revokePhoto(p){try{URL.revokeObjectURL(p.printUrl);}catch{}try{URL.revokeObjectURL(p.thumbUrl);}catch{}}
function resetPhotos(){photos.forEach(revokePhoto);photos=[];seed++;renderThumbs();renderPreview();const s=$('photoLoadStatus');if(s)s.textContent='写真をリセットしました。Supabase上のデータは変更していません。';}
function canvasToBlob(canvas,type='image/jpeg',quality=.88){return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('画像変換に失敗しました。')),type,quality));}
async function decodeFile(file){
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw new Error(`${file.name} を読み込めませんでした。JPEG/PNG/WebP等に変換してからお試しください。`);}
  const expected=Math.min(MAX_PHOTOS,photos.length+1);
  const maxEdge=expected>24?1500:expected>12?1850:2300;
  const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
  const printBlob=await canvasToBlob(c,'image/jpeg',.9);
  const tw=Math.min(360,w),ts=tw/w,th=Math.max(1,Math.round(h*ts));const tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tctx=tc.getContext('2d',{alpha:false});tctx.fillStyle='#fff';tctx.fillRect(0,0,tw,th);tctx.drawImage(c,0,0,tw,th);
  const thumbBlob=await canvasToBlob(tc,'image/jpeg',.8);try{bitmap.close();}catch{}
  return {id:`photo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:file.name,printUrl:URL.createObjectURL(printBlob),thumbUrl:URL.createObjectURL(thumbBlob),width:w,height:h,main:false};
}
async function addFiles(fileList){
  const files=[...(fileList||[])].filter(f=>f.type?.startsWith('image/')||/\.(jpe?g|png|webp|gif)$/i.test(f.name||''));
  if(!files.length){const s=$('photoLoadStatus');if(s)s.textContent='画像ファイルが見つかりませんでした。';return;}
  const room=MAX_PHOTOS-photos.length;if(room<=0){alert(`写真は最大${MAX_PHOTOS}枚です。`);return;}
  const target=files.slice(0,room),status=$('photoLoadStatus');let ok=0,errors=[];
  for(let i=0;i<target.length;i++){
    if(status)status.textContent=`写真を準備しています… ${i+1}/${target.length}`;
    try{photos.push(await decodeFile(target[i]));ok++;renderThumbs(false);}catch(err){errors.push(err.message||String(err));}
  }
  if(files.length>room)errors.push(`上限${MAX_PHOTOS}枚のため、${files.length-room}枚は追加していません。`);
  if(status)status.textContent=`${ok}枚追加しました。現在${photos.length}枚です。${errors.length?' '+errors[0]:''}`;
  seed++;renderThumbs();await renderPreview();
}
function renderThumbs(updatePreview=true){
  const grid=$('photoThumbGrid'),badge=$('photoCountBadge');if(badge)badge.textContent=`${photos.length}枚`;
  if(!grid)return;
  grid.innerHTML=photos.length?photos.map((p,i)=>`<article class="photo-thumb-card ${p.main?'is-main':''}" data-photo-id="${p.id}"><div class="photo-thumb-image"><img src="${p.thumbUrl}" alt="${esc(p.name)}"><span class="photo-index">${i+1}</span></div><div class="photo-thumb-actions"><button type="button" class="photo-main-btn ${p.main?'active':''}" data-photo-main="${p.id}" aria-pressed="${p.main}">☆ メイン</button><button type="button" class="photo-remove-btn" data-photo-remove="${p.id}">外す</button></div><small title="${esc(p.name)}">${esc(p.name)}</small></article>`).join(''):'<p class="muted photo-empty">写真を選ぶと、ここにサムネイルが表示されます。</p>';
  if(updatePreview)renderPreview();
}
function toggleMain(id){const p=photos.find(x=>x.id===id);if(!p)return;if(!p.main&&photos.filter(x=>x.main).length>=3){alert('メイン写真は最大3枚まで指定できます。');return;}p.main=!p.main;seed++;renderThumbs();}
function removePhoto(id){const i=photos.findIndex(x=>x.id===id);if(i<0)return;revokePhoto(photos[i]);photos.splice(i,1);seed++;renderThumbs();}

function rngFactory(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function shuffle(arr,rng){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function splitGrid(n,x,y,w,h,gap=12){
  if(n<=0)return[];const aspect=w/h;let cols=Math.max(1,Math.ceil(Math.sqrt(n*aspect)));let rows=Math.ceil(n/cols);while((rows-1)*cols>=n)rows--;
  const cellW=(w-gap*(cols-1))/cols,cellH=(h-gap*(rows-1))/rows;const out=[];
  for(let i=0;i<n;i++){const r=Math.floor(i/cols),c=i%cols;const countLast=r===rows-1?n-r*cols:cols;const rowW=countLast*cellW+(countLast-1)*gap;const offset=r===rows-1?(w-rowW)/2:0;out.push({x:x+offset+c*(cellW+gap),y:y+r*(cellH+gap),w:cellW,h:cellH,rot:0});}
  return out;
}
function layoutRects(n,preset,W,H,rng){
  const gap=Math.max(10,Math.round(W*.005));if(n<=0)return[];
  const autoChoices=n<=5?['hero-left','hero-right','hero-top','magazine']:n<=12?['hero-left','hero-right','magazine','mosaic','scrapbook']:n<=24?['mosaic','scrapbook','dense','hero-left','hero-top']:['dense','mosaic','scrapbook','hero-left'];
  if(preset==='auto')preset=autoChoices[Math.floor(rng()*autoChoices.length)];
  const heroFrac=n>24?.28:n>16?.32:.40;
  let rects=[];
  if(preset==='hero-left'||preset==='hero-right'){
    const hw=W*heroFrac,restW=W-hw-gap;const hero={x:preset==='hero-left'?0:W-hw,y:0,w:hw,h:H,rot:0};
    const gx=preset==='hero-left'?hw+gap:0;rects=[hero,...splitGrid(n-1,gx,0,restW,H,gap)];
  }else if(preset==='hero-top'){
    const hh=H*(n>20?.30:n>12?.36:.44);rects=[{x:0,y:0,w:W,h:hh,rot:0},...splitGrid(n-1,0,hh+gap,W,H-hh-gap,gap)];
  }else if(preset==='magazine'){
    if(n===1)rects=[{x:0,y:0,w:W,h:H,rot:0}];
    else{const topH=H*(n>16?.42:.56),leftW=W*.58;rects=[{x:0,y:0,w:leftW-gap/2,h:topH,rot:0},{x:leftW+gap/2,y:0,w:W-leftW-gap/2,h:topH,rot:0},...splitGrid(n-2,0,topH+gap,W,H-topH-gap,gap)];}
  }else if(preset==='mosaic'){
    if(n<4)return layoutRects(n,'magazine',W,H,rng);
    const leftW=W*(n>18?.34:.42),topH=H*(n>18?.45:.56);const first={x:0,y:0,w:leftW,h:topH,rot:0};
    const second={x:leftW+gap,y:0,w:W-leftW-gap,h:topH*.62,rot:0};
    const rightLowerN=Math.min(Math.max(1,Math.floor((n-2)*.28)),n-2),bottomN=n-2-rightLowerN;
    rects=[first,second,...splitGrid(rightLowerN,leftW+gap,topH*.62+gap,W-leftW-gap,topH-topH*.62-gap,gap),...splitGrid(bottomN,0,topH+gap,W,H-topH-gap,gap)];
  }else if(preset==='scrapbook'){
    const base=layoutRects(n,n>18?'dense':'mosaic',W,H,rng);rects=base.map((r,i)=>({...r,x:r.x+gap*.25,y:r.y+gap*.25,w:Math.max(20,r.w-gap*.5),h:Math.max(20,r.h-gap*.5),rot:(rng()-.5)*(i<3?8:5)}));
  }else{
    rects=splitGrid(n,0,0,W,H,gap);
    if(preset==='dense'&&n>=8&&n<=24){ // 少しだけ大小差を付ける
      const bump=Math.min(W,H)*.018;rects=rects.map((r,i)=>i%7===0?{...r,x:Math.max(0,r.x-bump/2),y:Math.max(0,r.y-bump/2),w:Math.min(W-r.x+bump/2,r.w+bump),h:Math.min(H-r.y+bump/2,r.h+bump)}:r);
    }
  }
  return rects.slice(0,n);
}
function photoOrder(rng){const main=photos.filter(p=>p.main),rest=photos.filter(p=>!p.main);return [...main,...shuffle(rest,rng)];}
function loadImg(url){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('写真を描画できませんでした。'));img.src=url;});}
function roundedRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
function drawCover(ctx,img,x,y,w,h){const ir=img.width/img.height,rr=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;if(ir>rr){sw=img.height*rr;sx=(img.width-sw)/2;}else{sh=img.width/rr;sy=(img.height-sh)/2;}ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
function fitText(ctx,text,maxWidth,start,min=28){let s=start;while(s>min){ctx.font=`800 ${s}px "Noto Sans JP","Yu Gothic",sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;s-=2;}return s;}
function topReactionText(sum){if(!sum?.counts)return'';const max=Math.max(...REACTIONS.map(([k])=>Number(sum.counts[k]||0)));if(max<=0)return'';const names=REACTIONS.filter(([k])=>Number(sum.counts[k]||0)===max).map(([,e,n])=>`${e} ${n}`);return `多く届いたリアクション：${names.join('・')}`;}
async function drawCollage(canvas,full=false){
  if(renderBusy&&!full)return;renderBusy=true;
  try{
    const W=full?3508:1400,H=full?2480:990;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,W,H);const scale=W/3508;
    const margin=full?110:44,titleY=full?95:38,titleH=full?245:98;
    const title=($('photoSheetTitle')?.value||selectedGroup()?.title||'OFES 写真記録').trim();const data=appData();
    ctx.fillStyle='#1c5c3c';ctx.font=`800 ${full?40:16}px "Noto Sans JP","Yu Gothic",sans-serif`;ctx.fillText(`OFES ${data?.year||''}年度`,margin,titleY);
    ctx.fillStyle='#172019';const fs=fitText(ctx,title,W-margin*2,full?82:33,full?46:19);ctx.font=`900 ${fs}px "Noto Sans JP","Yu Gothic",sans-serif`;ctx.fillText(title,margin,titleY+(full?92:37));
    ctx.strokeStyle='#2f7b56';ctx.lineWidth=full?7:3;ctx.beginPath();ctx.moveTo(margin,titleY+(full?145:58));ctx.lineTo(W-margin,titleY+(full?145:58));ctx.stroke();
    const showR=$('photoShowReactions')?.checked&&reactionSummary;const reactionH=showR?(full?230:92):(full?90:36);
    const contentX=margin,contentY=titleY+titleH,contentW=W-margin*2,contentH=H-contentY-reactionH-(full?70:28);
    if(!photos.length){ctx.fillStyle='#fff';roundedRect(ctx,contentX,contentY,contentW,contentH,full?28:12);ctx.fill();ctx.strokeStyle='#cfd9d0';ctx.lineWidth=full?4:2;ctx.stroke();ctx.fillStyle='#6a746d';ctx.textAlign='center';ctx.font=`700 ${full?50:20}px sans-serif`;ctx.fillText('写真を選ぶと、ここにプレビューが表示されます。',W/2,contentY+contentH/2);ctx.textAlign='left';return;}
    const rng=rngFactory(seed),order=photoOrder(rng),preset=$('photoLayoutPreset')?.value||'auto',rects=layoutRects(order.length,preset,contentW,contentH,rng);
    for(let i=0;i<order.length;i++){
      const p=order[i],r=rects[i];if(!r)continue;let img;try{img=await loadImg(p.printUrl);}catch{continue;}
      const x=contentX+r.x,y=contentY+r.y,w=r.w,h=r.h,rot=(r.rot||0)*Math.PI/180;
      ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(rot);const bx=-w/2,by=-h/2;
      ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=full?18:7;ctx.shadowOffsetY=full?7:3;ctx.fillStyle='#fff';roundedRect(ctx,bx-(full?12:5),by-(full?12:5),w+(full?24:10),h+(full?24:10),full?18:8);ctx.fill();ctx.shadowColor='transparent';
      roundedRect(ctx,bx,by,w,h,full?12:5);ctx.clip();drawCover(ctx,img,bx,by,w,h);ctx.restore();
      if(p.main){ctx.save();ctx.fillStyle='#1f754f';ctx.beginPath();ctx.arc(x+w-(full?30:12),y+(full?30:12),full?24:10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${full?28:11}px sans-serif`;ctx.fillText('★',x+w-(full?30:12),y+(full?31:12));ctx.restore();}
    }
    if(showR){
      const y=H-reactionH+(full?25:10);ctx.fillStyle='#fff';roundedRect(ctx,margin,y,W-margin*2,reactionH-(full?40:16),full?24:10);ctx.fill();ctx.strokeStyle='#d3ddd5';ctx.lineWidth=full?3:1;ctx.stroke();
      ctx.fillStyle='#345946';ctx.font=`800 ${full?32:13}px "Noto Sans JP","Yu Gothic",sans-serif`;ctx.fillText('みんなのリアクション',margin+(full?36:14),y+(full?58:23));
      let x=margin+(full?430:172);const step=(W-margin*2-(full?500:200))/REACTIONS.length;
      for(const [k,e] of REACTIONS){ctx.font=`700 ${full?44:18}px sans-serif`;ctx.fillText(e,x,y+(full?60:24));ctx.font=`900 ${full?38:15}px sans-serif`;ctx.fillStyle='#172019';ctx.fillText(String(reactionSummary.counts?.[k]||0),x+(full?58:23),y+(full?60:24));ctx.fillStyle='#345946';x+=step;}
      if($('photoShowTopReaction')?.checked){const txt=topReactionText(reactionSummary);if(txt){ctx.fillStyle='#6b746e';ctx.font=`700 ${full?27:11}px "Noto Sans JP","Yu Gothic",sans-serif`;ctx.fillText(txt,margin+(full?36:14),y+(full?125:50));}}
    }
  }finally{renderBusy=false;}
}
async function renderPreview(){const c=$('photoCollagePreview');if(!c)return;try{await drawCollage(c,false);}catch(err){const s=$('photoOutputStatus');if(s)s.textContent=`プレビューを作成できませんでした：${err?.message||err}`;}}
async function printPdf(){
  if(photos.length<1){alert('先に写真を選んでください。');return;}
  const btn=$('photoPrintPdf'),status=$('photoOutputStatus');btn.disabled=true;try{
    if($('photoShowReactions')?.checked)await refreshReactions();
    if(status)status.textContent='A4横の高解像度データを作成しています…';const c=document.createElement('canvas');await drawCollage(c,true);const dataUrl=c.toDataURL('image/jpeg',.95);
    const title=($('photoSheetTitle')?.value||'OFES 写真記録').trim();const w=window.open('','OFES_PHOTO_PDF','width=1200,height=900');if(!w)throw new Error('印刷画面を開けませんでした。ポップアップを許可してください。');
    w.document.open();w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#ddd;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",sans-serif}.sheet{width:297mm;height:210mm;margin:0 auto;background:#fff}.sheet img{display:block;width:297mm;height:210mm;object-fit:contain}.bar{position:fixed;z-index:10;right:14px;top:14px;display:flex;gap:8px}.bar button{padding:11px 16px;font-size:15px;border:1px solid #aaa;border-radius:9px;background:#fff;font-weight:800}@media print{html,body{background:#fff}.bar{display:none}.sheet{margin:0}}</style></head><body><div class="bar"><button onclick="window.print()">印刷／PDFとして保存</button></div><div class="sheet"><img src="${dataUrl}" alt="${esc(title)}"></div></body></html>`);w.document.close();
    if(status)status.textContent='印刷画面を開きました。用紙サイズA4・横向きで「PDFとして保存」を選んでください。';
    setTimeout(()=>{if(confirm('印刷画面を開きました。次の用紙作成のため、この画面の写真をリセットしますか？'))resetPhotos();},250);
  }catch(err){if(status)status.textContent=`PDFを作成できませんでした：${err?.message||err}`;alert(err?.message||err);}finally{btn.disabled=false;}
}

function bind(){
  renderProgramOptions(true);renderThumbs(false);renderPreview();
  $('photoProgramSelect')?.addEventListener('change',()=>{const g=selectedGroup();if($('photoSheetTitle'))$('photoSheetTitle').value=g?.title||'';reactionSummary=null;lastProgramKey=$('photoProgramSelect').value;refreshReactions();});
  $('photoSheetTitle')?.addEventListener('input',()=>renderPreview());
  $('photoShowReactions')?.addEventListener('change',()=>{if($('photoShowReactions').checked)refreshReactions();else{reactionSummary=null;renderPreview();}});
  $('photoShowTopReaction')?.addEventListener('change',()=>renderPreview());
  $('photoRefreshReactions')?.addEventListener('click',refreshReactions);
  $('photoPickerSd')?.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
  $('photoPickerBatch')?.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
  $('photoResetAll')?.addEventListener('click',()=>{if(photos.length&&!confirm('今回読み込んだ写真をすべてリセットしますか？\n写真はSupabaseには保存されていません。'))return;resetPhotos();});
  $('photoResetAfter')?.addEventListener('click',()=>{if(photos.length&&!confirm('今回読み込んだ写真をすべてリセットしますか？'))return;resetPhotos();});
  $('photoLayoutPreset')?.addEventListener('change',()=>{seed++;renderPreview();});
  $('photoShuffleLayout')?.addEventListener('click',()=>{seed+=17;renderPreview();});
  $('photoPreviewRefresh')?.addEventListener('click',renderPreview);
  $('photoPrintPdf')?.addEventListener('click',printPdf);
  $('photoThumbGrid')?.addEventListener('click',e=>{const m=e.target.closest('[data-photo-main]'),r=e.target.closest('[data-photo-remove]');if(m)toggleMain(m.dataset.photoMain);if(r)removePhoto(r.dataset.photoRemove);});
  const dz=$('photoDropZone');if(dz){for(const ev of ['dragenter','dragover'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');});for(const ev of ['dragleave','drop'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');});dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));}
  const nav=document.querySelector('#adminNav [data-admin="photos"]');nav?.addEventListener('click',()=>{renderProgramOptions(false);if(lastProgramKey!==$('photoProgramSelect')?.value){lastProgramKey=$('photoProgramSelect')?.value;reactionSummary=null;}renderPreview();});
  window.addEventListener('beforeunload',()=>photos.forEach(revokePhoto));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
