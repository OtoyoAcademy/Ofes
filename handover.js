import { supabaseConfig } from './supabase-config.js';

const form = document.getElementById('handoverForm');
const email = document.getElementById('handoverEmail');
const password = document.getElementById('handoverPassword');
const appPassword = document.getElementById('handoverAppPassword');
const status = document.getElementById('handoverStatus');
const siteUrl = new URL('./', location.href).href;
const adminVenueImage = new URL('./assets/handover/admin-venue.png', import.meta.url).href;
const campusMapImage = new URL('./assets/handover/campus-map.png', import.meta.url).href;

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]
  ));
}

const printStyle = `
  *{box-sizing:border-box}
  html{color:#20332a;background:#e8eeea;font-family:"Yu Gothic","Noto Sans CJK JP",Meiryo,sans-serif}
  body{margin:0;line-height:1.6}
  .toolbar{position:sticky;top:0;display:flex;gap:12px;align-items:center;justify-content:center;padding:12px;background:#173f30;color:white}
  .toolbar button{font:inherit;font-weight:bold;padding:6px 18px;border-radius:7px;border:0;background:white;color:#173f30;cursor:pointer}
  .page{margin:12px auto;padding:10mm 12mm;background:white;width:min(100%,210mm)}
  .quick .page{width:min(100%,420mm)}
  .kicker{font-size:10pt;color:#28664e;font-weight:bold;letter-spacing:.12em}
  h1{font-size:25pt;line-height:1.24;margin:2mm 0 3mm}
  h2{font-size:15pt;line-height:1.35;margin:0 0 1.4mm}
  p,ol,ul{margin:1.2mm 0 2.3mm}
  ul,ol{padding-left:5.2mm}
  li+li{margin-top:1.1mm}
  .lead{max-width:100%;font-size:11pt;color:#3f554a;margin-bottom:4mm}
  .detail{font-size:10.5pt}
  .quick{font-size:11.5pt}
  .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4mm;margin:4mm 0}
  .card{background:#f3f8f4;border:1px solid #c8dcd0;padding:4mm;border-radius:2.5mm;break-inside:avoid}
  .steps h2 span{color:#28664e;margin-right:2mm}
  .figures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin:4mm 0}
  figure{min-width:0;margin:0;text-align:left;break-inside:avoid}
  figure img{display:block;width:100%;height:auto;max-height:100mm;object-fit:contain;object-position:left center;border:1px solid #c8dcd0;border-radius:2mm}
  figcaption{font-size:9pt;color:#435d50;margin-top:1.2mm}
  .detail figure{margin-top:3mm}
  .detail figure img{max-height:91mm}
  .detail section{margin:4mm 0;break-inside:avoid}
  .detail dt{font-weight:bold;margin-top:1.6mm}
  .detail dd{margin:0 0 2mm;overflow-wrap:anywhere;white-space:pre-wrap}
  .private{background:#fff7e4;border-color:#dbc890}
  .footer{border-top:1px solid #c8dcd0;margin-top:4mm;padding-top:2mm;font-size:9pt;color:#435d50;display:flex;justify-content:space-between;gap:5mm}
  a{color:#1c6147;overflow-wrap:anywhere}
  @media screen and (max-width:730px){.steps,.figures{grid-template-columns:1fr}.page{padding:20px}}
  @media print{
    html{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .toolbar{display:none}
    .page,.quick .page{margin:0;padding:0;width:auto;break-after:page}
    .page:last-of-type{break-after:auto}
    a{text-decoration:none}
  }
`;

function figure(src, alt, caption) {
  return `<figure><img src="${escapeText(src)}" alt="${alt}"><figcaption>${caption}</figcaption></figure>`;
}

function quickManual() {
  return `<article class="page">
    <div class="kicker">大豊学園｜OFES 引き継ぎマニュアル・簡易版</div>
    <h1>おおフェスアプリを準備する</h1>
    <p class="lead">おおフェスアプリは、学校で使える年に活用する補助ツールです。既存の会場を使う場合は、開催日・演目・児童生徒名をその年の情報に更新するところから始められます。</p>
    <div class="steps">
      <section class="card"><h2><span>1</span>開催日を設定</h2><p>入口の「管理者はこちら」から管理画面を開きます。「年度・時刻テスト」で年度、開催日、リアクション受付終了、関係者用パスコードを確認します。</p><p>新しい年度を作る場合は「年度データ」から保存済みの前年度をコピーできます。</p></section>
      <section class="card"><h2><span>2</span>発表を入力</h2><p>「プログラム」でセッション①〜④の時間を確認し、会場名・セッション時間入りのExcelをダウンロードします。演目・学年・グループ・会場と、専用列に児童生徒名を入力します。</p><p>完成したExcel、または既存のCSVを「Excel／CSVを読み込む」で下書きに反映します。</p></section>
      <section class="card"><h2><span>3</span>公開して確認</h2><p>「本番前チェック」を確認し、「Supabase接続」で学校管理用アカウントにログインします。「データ保存」→「Supabaseへ公開」を押し、完了表示を確認します。</p><p>管理画面上部の「同期済み」で保存を確認し、別端末でプログラムと会場案内を見ます。</p></section>
    </div>
    <div class="figures">
      ${figure(adminVenueImage,'管理画面の会場・配置図','操作画面例｜「会場・配置図」で会場や補足情報を変更して保存します。')}
      ${figure(campusMapImage,'来場者画面の学校全体図','表示画面例｜別端末で学校全体図を開き、前期棟・後期棟・体育館をタップします。')}
    </div>
    <div class="footer"><span>アプリの入口　<a href="${escapeText(siteUrl)}">${escapeText(siteUrl)}</a></span><span>ログイン情報と詳しい手順は詳細版へ</span></div>
  </article>`;
}

function detailManual(credentials) {
  const result = value => escapeText(value || '（未記入）');
  return `<article class="page">
    <div class="kicker">大豊学園｜OFES 引き継ぎマニュアル・詳細版</div>
    <h1>年度の準備と公開</h1>
    <p class="lead">アプリを使う年度に、会場とスケジュールを確認して更新します。</p>
    <section><h2>1　年度と開催日</h2>
      <ol><li>学校のOFESを開き、「管理者はこちら」でOFES管理画面のパスワードを入力します。</li>
      <li>「Supabase接続」で学校管理用アカウントにログインします。保存済みの前年度を使う場合は「年度データ」で「前年度をコピー」を選び、年度と開催日を指定します。</li>
      <li>「年度・時刻テスト」で開催日、関係者用パスコード、リアクション受付終了を確認します。</li></ol></section>
    <section><h2>2　プログラムを登録</h2>
      <ol><li>「プログラム」でセッション①〜④の共通の時間を設定します。会場を変える場合は先に「会場・配置図」で会場を保存します。</li>
      <li>会場名・セッション時間入りExcelをダウンロードします。演目、学年、グループ、会場、児童生徒名を記入します。セッション外の演目は開始・終了、必要に応じてリアクション区分も指定します。既存のCSVも読み込めます。</li>
      <li>「Excel／CSVを読み込む」で取り込みます。年度全体を入れ替えるときは「置き換える」、追記するときは「追加」を選びます。</li></ol>
      <div class="card">児童生徒名は専用の欄に入力してください。「大豊学園関係者」の入口を使った利用者に表示されます。</div>
    </section>
    <section><h2>3　別端末で確認</h2>
      <ol><li>「本番前チェック」を見てから、「データ保存」→「Supabaseへ公開」を押します。</li>
      <li>公開完了後に別端末で開き、一般入口のプログラムと会場、関係者入口の発表者名などを確認します。</li></ol></section>
    <div class="footer"><span>OFES 引き継ぎマニュアル</span><span>1 / 3</span></div>
  </article>
  <article class="page">
    <div class="kicker">大豊学園｜OFES 引き継ぎマニュアル・詳細版</div>
    <h1>会場・当日の確認</h1>
    <section><h2>会場案内を編集する</h2><p>「会場・配置図」で図面を選び、会場をタップします。学校全体図の「補足情報」には建物ごとの概要を入力し、「この会場を保存」を押します。詳しい発表は前期棟・後期棟の各会場に登録します。修正後は「データ保存」から公開します。</p>
      ${figure(adminVenueImage,'実際の管理画面の会場・配置図','会場の編集画面例｜「補足情報」と「この会場を保存」の位置を確認できます。')}</section>
    <section><h2>補足情報が表示されないとき</h2><p>会場編集欄の「公開中の補足情報」と入力欄を見比べてください。公開中の情報が古い場合は、編集したブラウザで保存し、公開完了を確認します。別端末で開き直し、同じ図面の会場をタップします。</p></section>
    <section><h2>テスト・当日の運用</h2>
      <ul><li>「年度・時刻テスト」で当日の時刻を指定し、会場案内とTV表示を確認します。確認後はテスト日時を解除します。</li>
      <li>学校全体図の概要は時間帯に関係なく確認できます。前期棟・後期棟の「指定なし」には全時間帯の発表が並びます。</li>
      <li>スタンプを試行した場合は「スタンプQR」でリセットを確認します。全端末の取得状況のリセットは本番開始前に必要な場合だけ行ってください。</li></ul></section>
    <div class="footer"><span>OFES 引き継ぎマニュアル</span><span>2 / 3</span></div>
  </article>
  <article class="page">
    <div class="kicker">大豊学園｜OFES 引き継ぎマニュアル・詳細版</div>
    <h1>終了後の運用と引き継ぎ</h1>
    <section><h2>終了後に確認できること</h2><p>当日のプログラムと会場案内は終了後も閲覧できます。入口とTVに来場のお礼を表示します。年度を残す場合は「年度データ」から「現在の年度を保存」を選びます。</p></section>
    <section><h2>学校で管理する場所</h2>
      <p>GitHub Pagesで画面を公開し、会場やプログラムなどの公開データはSupabaseで管理します。アプリを使い続ける場合は、学校管理のアカウントで両方を引き継ぎます。編集中の設定は管理者用の共有下書きに保存されます。必要に応じて「データ保存」でJSONも書き出します。</p>
      <p>アプリの入口　<a href="${escapeText(siteUrl)}">${escapeText(siteUrl)}</a></p></section>
    <section class="card private"><h2>管理者用の接続・ログイン情報</h2>
      <dl>
        <dt>OFES入口「管理者はこちら」</dt><dd>${result(credentials.appPassword)}</dd>
        <dt>SupabaseプロジェクトURL</dt><dd>${result(supabaseConfig.url)}</dd>
        <dt>管理画面「Supabase接続」用の学校管理メールアドレス</dt><dd>${result(credentials.email)}</dd>
        <dt>管理画面「Supabase接続」用のパスワード</dt><dd>${result(credentials.password)}</dd>
      </dl>
      <p>ログイン情報を記載したPDFは、後任の担当者と学校で指定した保管先に限って共有します。Supabaseのパスワードを忘れた場合は、「Supabase接続」から再設定メールを送信できます。</p>
    </section>
    <div class="footer"><span>OFES 引き継ぎマニュアル・担当者用</span><span>3 / 3</span></div>
  </article>`;
}

function manualHtml(detail, credentials = {}) {
  const mode = detail ? 'detail' : 'quick';
  const paper = detail ? 'A4 portrait' : 'A3 landscape';
  const label = detail ? '詳細版' : '簡易版';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>OFES 引き継ぎマニュアル ${label}</title>
    <style>@page{size:${paper};margin:${detail ? '12mm' : '13mm'}}${printStyle}</style>
    </head><body class="${mode}"><div class="toolbar"><button id="printManual" type="button">印刷／PDFに保存</button><span>${paper === 'A3 landscape' ? 'A3横・1枚' : 'A4縦・3ページ'}</span></div>
    ${detail ? detailManual(credentials) : quickManual()}</body></html>`;
}

function openManual(detail, credentials) {
  const preview = window.open('', '_blank');
  if (!preview) {
    status.textContent = '印刷用画面を開けませんでした。ポップアップを許可して、もう一度開いてください。';
    return false;
  }
  preview.opener = null;
  preview.document.open();
  preview.document.write(manualHtml(detail, credentials));
  preview.document.close();
  preview.document.getElementById('printManual').addEventListener('click', () => preview.print());
  status.textContent = '';
  return true;
}

function clearCredentials() {
  form.reset();
  form.hidden = true;
}

document.getElementById('handoverQuick').addEventListener('click', () => {
  clearCredentials();
  openManual(false);
});
document.getElementById('handoverDetailed').addEventListener('click', () => {
  if (form.hidden) {
    const account = document.getElementById('firebaseUserEmail').textContent.trim();
    email.value = account.includes('@') ? account : document.getElementById('supabaseAdminEmail').value.trim();
    appPassword.value = DEMO_ADMIN_PASSWORD;
  }
  status.textContent = '';
  form.hidden = false;
  email.focus();
});
document.getElementById('handoverCancel').addEventListener('click', clearCredentials);
document.getElementById('closeAdmin').addEventListener('click', clearCredentials);
form.addEventListener('submit', event => {
  event.preventDefault();
  if (openManual(true, { email:email.value.trim(), password:password.value, appPassword:appPassword.value })) {
    clearCredentials();
  }
});
