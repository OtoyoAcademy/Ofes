import { supabaseConfig } from './supabase-config.js';

const form = document.getElementById('handoverForm');
const email = document.getElementById('handoverEmail');
const password = document.getElementById('handoverPassword');
const appPassword = document.getElementById('handoverAppPassword');
const status = document.getElementById('handoverStatus');
const quickButton = document.getElementById('handoverQuick');
const detailedButton = document.getElementById('handoverDetailed');
const siteUrl = new URL('./', location.href).href;
const imageUrl = file => new URL(`./assets/handover/${file}.png`, import.meta.url).href;

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]
  ));
}

const style = document.createElement('style');
style.textContent = `
  #handoverViewer{position:fixed;inset:0;z-index:4000;overflow:auto;overscroll-behavior:contain;background:#e8eeea;color:#20332a;font-family:"Yu Gothic","Noto Sans CJK JP",Meiryo,sans-serif;line-height:1.55}
  #handoverViewer *{box-sizing:border-box}
  #handoverViewer .manual-toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:max(8px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 8px max(10px,env(safe-area-inset-left));background:#173f30;color:#fff}
  #handoverViewer .manual-toolbar button{font:inherit;font-weight:700;font-size:14px;min-height:44px;padding:5px 10px;border:1px solid #c8dcd0;border-radius:8px;background:white;color:#173f30;white-space:nowrap}
  #handoverViewer .manual-toolbar span{font-size:12px;text-align:center}
  #handoverViewer .manual-page{margin:12px auto;padding:10mm 12mm;width:min(100%,210mm);background:white;scroll-margin-top:72px}
  #handoverViewer.quick .manual-page{width:min(100%,420mm)}
  #handoverViewer .manual-kicker{font-size:10pt;color:#28664e;font-weight:700;letter-spacing:.08em}
  #handoverViewer h1{font-size:25pt;line-height:1.24;margin:2mm 0 3mm}
  #handoverViewer h2{font-size:14pt;line-height:1.35;margin:0 0 1.4mm}
  #handoverViewer p,#handoverViewer ol,#handoverViewer ul,#handoverViewer dl{margin:1.3mm 0 2.5mm}
  #handoverViewer ul,#handoverViewer ol{padding-left:5.5mm}
  #handoverViewer li+li{margin-top:1.4mm}
  #handoverViewer .manual-lead{font-size:11.7pt;color:#3f554a;margin-bottom:5mm}
  #handoverViewer.detail{font-size:11.5pt}
  #handoverViewer.quick{font-size:11.6pt}
  #handoverViewer .manual-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4mm;margin:4mm 0}
  #handoverViewer .manual-card{background:#f3f8f4;border:1px solid #c8dcd0;padding:4mm;border-radius:2.5mm;break-inside:avoid}
  #handoverViewer .manual-card strong{color:#245940}
  #handoverViewer .manual-figures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin:4mm 0}
  #handoverViewer figure{min-width:0;margin:3mm 0;text-align:left;break-inside:avoid}
  #handoverViewer figure img{display:block;width:100%;height:auto;max-height:94mm;object-fit:contain;object-position:left top;border:1px solid #c8dcd0;border-radius:2mm}
  #handoverViewer.detail figure img{max-height:84mm}
  #handoverViewer figcaption{font-size:9.5pt;color:#435d50;margin-top:1.3mm}
  #handoverViewer.detail section{margin:4.5mm 0;break-inside:avoid}
  #handoverViewer dt{font-weight:700;margin-top:2mm}
  #handoverViewer dd{margin:0 0 2mm;overflow-wrap:anywhere;white-space:pre-wrap}
  #handoverViewer .manual-private{background:#fff7e4;border-color:#dbc890}
  #handoverViewer .manual-footer{border-top:1px solid #c8dcd0;margin-top:5mm;padding-top:2mm;font-size:9.2pt;color:#435d50;display:flex;justify-content:space-between;flex-wrap:wrap;gap:2mm 5mm}
  #handoverViewer a{color:#1c6147;overflow-wrap:anywhere}
  #handoverViewer code{overflow-wrap:anywhere}
  #handoverViewer .manual-table{border-collapse:collapse;width:100%;table-layout:fixed}
  #handoverViewer .manual-table th,#handoverViewer .manual-table td{border:1px solid #c8dcd0;padding:2mm;vertical-align:top;text-align:left;overflow-wrap:anywhere}
  #handoverViewer .manual-table th{background:#eef5ef}
  #handoverViewer .manual-table th:first-child{width:32%}
  #handoverViewer .manual-table tr{break-inside:avoid}
  #handoverViewer .manual-toc{columns:2;column-gap:10mm}
  @media screen and (max-width:730px){
    #handoverViewer .manual-steps,#handoverViewer .manual-figures{grid-template-columns:1fr}
    #handoverViewer .manual-page{padding:17px;margin:8px auto}
    #handoverViewer h1{font-size:21pt}
    #handoverViewer .manual-toc{columns:1}
  }
  @media print {
    html.handover-print,html.handover-print body{margin:0!important;background:#fff!important;height:auto!important;overflow:visible!important}
    html.handover-print body > :not(#handoverViewer){display:none!important}
    html.handover-print #handoverViewer{position:static;inset:auto;overflow:visible;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    #handoverViewer .manual-toolbar{display:none!important}
    #handoverViewer .manual-page,#handoverViewer.quick .manual-page{margin:0;padding:0;width:auto;break-after:page}
    #handoverViewer .manual-page:last-of-type{break-after:auto}
    #handoverViewer a{text-decoration:none}
  }
`;
document.head.append(style);

const paperStyle = document.createElement('style');
document.head.append(paperStyle);
const viewer = document.createElement('section');
viewer.id = 'handoverViewer';
viewer.hidden = true;
viewer.setAttribute('aria-label', 'OFES 引き継ぎマニュアル');
viewer.setAttribute('role', 'dialog');
viewer.setAttribute('aria-modal', 'true');
viewer.innerHTML = `<div class="manual-toolbar">
  <button type="button" id="handoverBack">管理画面に戻る</button>
  <span id="handoverPaperLabel"></span>
  <button type="button" id="printManual">印刷／PDF</button>
</div><div id="handoverDocument"></div>`;
document.body.append(viewer);
const backButton = document.getElementById('handoverBack');
const printButton = document.getElementById('printManual');
const manual = document.getElementById('handoverDocument');

function figure(file, alt, caption) {
  return `<figure><img src="${escapeText(imageUrl(file))}" alt="${alt}"><figcaption>${caption}</figcaption></figure>`;
}

function quickManual() {
  return `<article class="manual-page">
    <div class="manual-kicker">大豊学園｜OFES 引き継ぎマニュアル・簡易版</div>
    <h1>おおフェスアプリを準備する</h1>
    <p class="manual-lead">会場を引き継げる場合は、開催日と今年度のプログラムを更新するところから始められます。初めて共有下書きを使う場合は、詳細版の「初回設定」を確認してください。</p>
    <div class="manual-steps">
      <section class="manual-card"><h2>1　年度と日程を確認</h2><p>入口の「管理者はこちら」から管理画面を開き、「Supabase接続」で学校管理用アカウントにログインします。</p><p>「年度・時刻テスト」で年度・開催日・受付終了日時・関係者用パスコードを確認します。年度を替える場合は「年度データ」から前年度をコピーできます。</p></section>
      <section class="manual-card"><h2>2　入力して同期</h2><p>「プログラム」でセッション時間を確認し、Excel入力様式をダウンロードします。行事や発表を入力し、児童生徒名は専用列に記入します。作成したExcelまたはCSVを読み込みます。</p><p><strong>「同期済み」</strong>が出たら、別端末の管理画面でも続きから作業できます。</p></section>
      <section class="manual-card"><h2>3　公開して確認</h2><p>「本番前チェック」で確認し、「データ保存」→「Supabaseへ公開」を押します。</p><p><strong>「公開が完了しました」</strong>と出たら、別端末で一般来場者の入口からプログラムと会場案内を確認します。</p></section>
    </div>
    <div class="manual-figures">
      ${figure('admin-venue','管理画面の会場・配置図','会場の下書き｜補足情報を入力し、「この会場を保存」を押します。')}
      ${figure('data-save','管理画面のデータ保存','来場者への公開｜「同期済み」を確認してから「Supabaseへ公開」を押します。')}
    </div>
    <div class="manual-card"><strong>端末を替えるとき</strong>　編集した端末で「同期済み」を確認します。「未同期」なら、同じ端末で「共有下書きを確認」を押してください。</div>
    <div class="manual-footer"><span>アプリの入口　<a href="${escapeText(siteUrl)}">${escapeText(siteUrl)}</a></span><span>初回設定・復旧手順・接続情報は詳細版へ</span></div>
  </article>`;
}

const chapters = [
  '年間の作業と管理者ログイン',
  '共有下書きの初回設定',
  '普段の編集と端末切り替え',
  '年度とプログラムの準備',
  '会場案内・安全情報・アンケート',
  '公開・来場者チェック・本番運用',
  '困ったときの確認と復旧',
  '終了後・年度保存・後任への引き継ぎ',
  '管理者用の接続・ログイン情報',
];

function detailPage(index, body) {
  return `<article class="manual-page" id="handover-chapter-${index}">
    <div class="manual-kicker">大豊学園｜OFES 引き継ぎマニュアル・詳細版</div>
    <h1>${chapters[index-1]}</h1>
    ${body}
    <div class="manual-footer"><span>OFES 引き継ぎマニュアル・担当者用</span><span>${index} / ${chapters.length}</span></div>
  </article>`;
}

function detailManual(credentials) {
  const result = value => escapeText(value || '（未記入）');
  return [
    detailPage(1, `
      <p class="manual-lead">おおフェスアプリは、行事の準備や当日の案内に使う補助ツールです。使う年度に、開催日・会場・プログラムを確認して更新します。</p>
      <section><h2>年間の流れ</h2>
      <ol><li>前年度の会場と設定を引き継ぎ、今年度の開催日・演目・児童生徒名を入力します。</li><li>管理画面で同期を確認し、テスト日時を使って当日の見え方を確認します。</li><li>公開後、別端末で来場者画面を確認します。終了後は必要に応じて年度データを保存します。</li></ol></section>
      <section><h2>管理画面を開く</h2><ol><li>学校のOFESを開き、入口の「管理者はこちら」でOFES管理画面のパスワードを入力します。</li><li>「Supabase接続」で学校管理用アカウントにログインします。管理者として認証されると、共有下書きを開けます。</li></ol>
      <p>アプリの入口　<a href="${escapeText(siteUrl)}">${escapeText(siteUrl)}</a></p></section>
      <section class="manual-card"><h2>目次</h2><ol class="manual-toc">${chapters.map((title,i)=>`<li><a href="#handover-chapter-${i+1}">${title}</a></li>`).join('')}</ol></section>
    `),
    detailPage(2, `
      <p class="manual-lead">共有下書きをまだ作っていない場合に、学校の管理者が一度だけ行う作業です。すでに「同期済み」が出る場合は、次のページの手順で編集を始められます。</p>
      <section><h2>初回導入の手順</h2>
      <ol>
        <li>端末ごとに未公開の編集がある場合は、各端末で「データ保存」→「下書きの設定JSONを書き出す」を実行し、控えを残します。</li>
        <li>既存のOFES用SupabaseのSQL Editorで <code>supabase-upgrade-v157-draft-sync.sql</code> を実行します。すでにVer.1.57の同期設定を済ませている場合は、この手順を省きます。</li>
        <li>配布ZIPを解凍し、READMEに従って、GitHubの既存の <code>index.html</code> がある場所へ更新ファイルを配置します。Pagesによる公開が成功したことを確認します。</li>
        <li>残したい下書きがある端末・ブラウザで管理者としてログインし、「この端末の下書きから共有を開始」を押します。</li>
        <li>確認画面で年度・会場数・プログラム数を確認します。「同期済み」が出たら、もう1台の管理画面でも内容を照合します。</li>
      </ol></section>
      ${figure('sync-start','共有下書きの初回設定画面','初回の表示例｜残したい下書きがある端末で共有を開始します。')}
      <section class="manual-card"><h2>複数端末に変更がある場合</h2><p>最初に共有する下書きは1つです。他端末だけにある変更は、控えと照らし合わせながら共有下書きに追記してください。</p></section>
    `),
    detailPage(3, `
      <p class="manual-lead">学校のPCで会場の補足情報を編集し、別の端末でその続きを作業できます。</p>
      <section><h2>保存して端末を替える</h2><ol>
        <li>「この会場を保存」など、編集した画面の保存ボタンを押します。プログラムの入力やExcel取込も、保存された変更が同期対象になります。</li>
        <li>管理画面上部の「同期済み」と日時を確認します。</li>
        <li>別端末でOFES管理画面を開き、Supabase管理者としてログインします。管理画面を開いたまま使っている場合は「共有下書きを確認」を押します。</li>
      </ol></section>
      ${figure('sync-done','管理画面の同期済み表示','画面上部の同期済み表示｜確認後、別端末で編集を続けられます。')}
      <section><h2>保存と公開の違い</h2>
      <table class="manual-table"><thead><tr><th>操作・表示</th><th>反映される場所</th></tr></thead><tbody>
        <tr><td>保存して「同期済み」</td><td>Supabase管理者が開く共有下書き</td></tr>
        <tr><td>「Supabaseへ公開」</td><td>一般来場者と大豊学園関係者が開く公開画面</td></tr>
        <tr><td>テスト日時・スタンプ取得</td><td>操作した端末のブラウザ。別端末はそれぞれの状態で表示</td></tr>
      </tbody></table></section>
      <section class="manual-card"><h2>編集中の欄</h2><p>入力途中の文字は、その欄を保存してから端末を替えてください。「同期済み」の日時は、最後に保存した下書きの日時です。</p></section>
    `),
    detailPage(4, `
      <p class="manual-lead">年度が替わるときは前年度の会場を流用し、演目・時間・児童生徒名を今年度の内容に差し替えます。</p>
      <section><h2>年度・開催日を設定</h2><ol>
        <li>「年度データ」の保存済み一覧から前年度を選んでコピーします。新しい年度と開催日を入力すると、共有下書きの編集対象がその年度に替わります。</li>
        <li>「年度・時刻テスト」でスローガン、関係者用パスコード、リアクション受付終了日時を確認し、設定を保存します。</li>
        <li>会場名に変更があれば「会場・配置図」で先に保存します。「プログラム」でセッション①〜④の時間を確認してから入力様式をダウンロードします。</li>
      </ol></section>
      <section><h2>Excelで演目を入れ替える</h2><ol>
        <li>会場・セッション・学年・発表グループ・発表内容を入力します。児童生徒名は専用列に入れます。</li>
        <li>セッション外の演目は開始と終了を入力します。リアクション区分は、対象・なし・有志発表から選びます。</li>
        <li>入力済みExcelまたはCSVを選びます。年度全体の入れ替えは「置き換える」、追加分だけなら「追加」を選び、「Excel／CSVを読み込む」を押します。</li>
        <li>取り込んだ件数と時間順を確認し、管理画面上部の「同期済み」を確認します。</li>
      </ol></section>
      ${figure('program-import','プログラムのExcel・CSV読み込み画面','プログラムの読み込み｜ファイル選択と読み込み方法を確認します。')}
    `),
    detailPage(5, `
      <p class="manual-lead">学校全体図には建物ごとの概要、前期棟・後期棟の図面には発表会場の詳しい場所を登録します。</p>
      <section><h2>会場と補足情報</h2><ol>
        <li>「会場・配置図」で配置図を選び、会場をタップします。新規の場合は「新規会場」から図面上の位置を指定します。</li>
        <li>会場名と補足情報を入力して「この会場を保存」を押します。学校全体図の体育館なら、開会式・合唱・午後の催しなどをまとめて案内できます。</li>
        <li>「同期済み」を確認し、来場者へ反映するときに「Supabaseへ公開」を押します。会場編集欄の「公開中の補足情報」で反映結果を確認できます。</li>
      </ol></section>
      ${figure('admin-venue','管理画面の会場・配置図','会場の登録画面｜補足情報を編集し、画面下部の「この会場を保存」を押します。')}
      <section><h2>安全情報とアンケート</h2>
      <p>安全情報を表示する場合は「会場・配置図」で公開設定を確認します。「アンケート」では公開範囲と受付期間を確認します。変更後は同期を確認し、必要なタイミングで公開します。</p></section>
    `),
    detailPage(6, `
      <p class="manual-lead">別端末で見ると、来場者が実際に受け取る公開内容を確認できます。</p>
      <section><h2>公開する</h2><ol>
        <li>「本番前チェック」で開催日・会場・プログラム・関係者用パスコードなどを確認します。</li>
        <li>「同期済み」を確認し、「データ保存」で「Supabaseへ公開」を押します。確認画面の年度・会場数・件数を読み、公開完了を確認します。</li>
        <li>別端末で一般来場者として開き、時刻・会場・補足情報を確認します。関係者入口ではパスコードで入り、児童生徒名や関係者向けアンケートの表示を確認します。</li>
      </ol></section>
      ${figure('data-save','データ保存画面の公開ボタン','データ保存｜公開完了メッセージと最終公開日時を確認します。')}
      <section><h2>当日の表示をテストする</h2>
      <ul><li>「年度・時刻テスト」で当日の開始前・開催中・終了後を確認し、テスト後は解除します。TV表示もその端末で確認します。</li><li>前期棟・後期棟の「指定なし」では過去と今後の発表を確認できます。学校全体図の補足情報は時間帯を問わず表示されます。</li><li>スタンプの試行後は「スタンプQR」で取得状況のリセットを確認します。全端末のリセットは本番前に必要な場合に実行します。</li></ul></section>
    `),
    detailPage(7, `
      <p class="manual-lead">まず管理画面の上部に出る状態と、データ保存画面の公開結果を確認します。</p>
      <section><h2>症状ごとの確認</h2>
      <table class="manual-table"><thead><tr><th>表示・症状</th><th>確認すること</th></tr></thead><tbody>
        <tr><td>未同期・通信エラー</td><td>編集した端末で通信を確認して「共有下書きを確認」を押します。「同期済み」になってから端末を替えます。</td></tr>
        <tr><td>別端末で更新されました</td><td>「共有下書きを確認」で切り替えると、手元の保存内容を「切替前のJSON」として書き出せます。控えの必要箇所を共有下書きへ追記します。</td></tr>
        <tr><td>「Supabaseへ公開」を押せない</td><td>管理者ログインと同期状況を確認します。会場や年度などに入力途中の欄がある場合は先に保存します。</td></tr>
        <tr><td>来場者に補足情報が出ない</td><td>会場編集欄で「公開中の補足情報」を確認します。「なし」なら保存、同期、公開の順に再確認します。公開中の文面が出ていれば別端末で再読み込みして、同じ図面・会場をタップします。</td></tr>
        <tr><td>更新前の画面が出る</td><td>GitHub Pagesの公開が成功したかを確認し、公開中のOFESを開き直します。管理画面のバージョン表示で更新を確認します。</td></tr>
      </tbody></table></section>
      <section class="manual-card"><h2>全体を置き換える操作</h2><p>「設定JSONを読み込む」と「公開データを編集用に読み込む」は、共有下書き全体を置き換える操作です。端末を替えるときや最新版を確認するときは「共有下書きを確認」を使います。置き換え前の控えが必要なら下書きのJSONを書き出してください。</p></section>
      <section><h2>公開内容を戻す場合</h2><p>「データ保存」の公開データ復元では、対象の日時と件数を確認してから実行します。復元後は別端末の来場者画面を開いて確認します。</p></section>
    `),
    detailPage(8, `
      <p class="manual-lead">翌年度も使う場合は、今年度の会場とプログラムを残しておくと準備を始めやすくなります。</p>
      <section><h2>行事が終わったら</h2><ul>
        <li>最後のプログラムが終わると、入口・TVにお礼の表示が出ます。プログラムと会場案内は引き続き閲覧できます。</li>
        <li>必要に応じて「リアクション集計」でPDFなどの記録を作成します。</li>
        <li>「同期済み」を確認してから、「年度データ」→「現在の年度を保存」を押し、保存済みの年度に載ったことを確認します。</li>
      </ul></section>
      <section><h2>後任に渡すもの</h2>
      <table class="manual-table"><tbody>
        <tr><th>OFESの公開URL</th><td>来場者と管理者が開く入口。配付資料のQRコードの確認に使います。</td></tr>
        <tr><th>GitHubの管理先</th><td>GitHub Pagesの公開ファイルと、更新に使うリポジトリです。</td></tr>
        <tr><th>Supabaseの管理先</th><td>共有下書き、公開データ、年度データを管理するプロジェクトです。</td></tr>
        <tr><th>引き継ぎ資料</th><td>簡易版と詳細版、必要に応じて下書きのJSONを学校の指定先に保管します。</td></tr>
      </tbody></table></section>
      <section class="manual-card"><h2>引き継ぎ時の確認</h2><p>後任の端末で管理画面を開き、Supabase管理者ログインと共有下書きの読み込みまで確認します。次年度に使う場合は、年度保存からコピーして日付とプログラムの更新に進めます。</p></section>
    `),
    detailPage(9, `
      <p class="manual-lead">管理画面とSupabaseのログイン情報を、使う画面ごとに記載します。</p>
      <section class="manual-card manual-private"><h2>担当者用</h2><dl>
        <dt>OFES入口「管理者はこちら」のパスワード</dt><dd>${result(credentials.appPassword)}</dd>
        <dt>SupabaseプロジェクトURL</dt><dd>${result(supabaseConfig.url)}</dd>
        <dt>管理画面「Supabase接続」用の学校管理メールアドレス</dt><dd>${result(credentials.email)}</dd>
        <dt>管理画面「Supabase接続」用のパスワード</dt><dd>${result(credentials.password)}</dd>
      </dl><p>ログイン情報を載せたPDFは、後任の担当者と学校で指定した保管先に限って共有してください。</p></section>
      <section><h2>Supabaseのパスワードを忘れた場合</h2><ol><li>OFES管理画面の「Supabase接続」を開き、管理者メールアドレスを入力します。</li><li>「パスワード再設定メールを送信」を押し、受信したメールの案内に従って再設定します。</li><li>ログイン後に管理者権限を確認し、新しいログイン情報で引き継ぎ資料を更新します。</li></ol></section>
      <section><h2>大豊学園関係者用パスコード</h2><p>年度ごとのパスコードは「年度・時刻テスト」で設定し、「お知らせPDF」で配付資料に入れます。</p></section>
    `),
  ].join('');
}

let historyToken = null;
let returnFocus = null;
let background = [];

function clearCredentials() {
  form.reset();
  form.hidden = true;
}

function showManual(detail, credentials, trigger) {
  if (!viewer.hidden) return;
  viewer.className = detail ? 'detail' : 'quick';
  manual.innerHTML = detail ? detailManual(credentials) : quickManual();
  document.getElementById('handoverPaperLabel').textContent = detail ? 'A4縦・9ページ' : 'A3横・1枚';
  paperStyle.textContent = detail ? '@page{size:A4 portrait;margin:12mm}' : '@page{size:A3 landscape;margin:13mm}';
  document.documentElement.classList.add('handover-print');
  background = [...document.body.children].filter(el => el !== viewer && !el.inert);
  background.forEach(el => { el.inert = true; });
  returnFocus = trigger;
  viewer.hidden = false;
  viewer.scrollTop = 0;
  backButton.focus({preventScroll:true});
  historyToken = String(Date.now());
  try {
    history.pushState({...history.state, ofesHandover:historyToken}, '');
  } catch {
    historyToken = null;
  }
  status.textContent = '';
}

function closeManual(goBack = false) {
  if (viewer.hidden) return;
  const ownHistoryEntry = historyToken && history.state?.ofesHandover === historyToken;
  historyToken = null;
  viewer.hidden = true;
  manual.replaceChildren();
  document.documentElement.classList.remove('handover-print');
  paperStyle.textContent = '';
  background.forEach(el => { el.inert = false; });
  background = [];
  returnFocus?.focus({preventScroll:true});
  returnFocus = null;
  if (goBack && ownHistoryEntry) history.back();
}

backButton.addEventListener('click', () => closeManual(true));
window.addEventListener('popstate', () => closeManual());
viewer.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeManual(true);
});
manual.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#handover-chapter-"]');
  if (!link) return;
  event.preventDefault();
  document.getElementById(link.hash.slice(1))?.scrollIntoView();
});
printButton.addEventListener('click', () => {
  window.print();
});
quickButton.addEventListener('click', () => {
  clearCredentials();
  showManual(false, {}, quickButton);
});
detailedButton.addEventListener('click', () => {
  if (form.hidden) {
    const account = document.getElementById('firebaseUserEmail').textContent.trim();
    email.value = account.includes('@') ? account : document.getElementById('supabaseAdminEmail').value.trim();
    appPassword.value = DEMO_ADMIN_PASSWORD;
  }
  form.hidden = false;
  email.focus();
});
document.getElementById('handoverCancel').addEventListener('click', clearCredentials);
document.getElementById('closeAdmin').addEventListener('click', clearCredentials);
form.addEventListener('submit', event => {
  event.preventDefault();
  showManual(true, {email:email.value.trim(), password:password.value, appPassword:appPassword.value}, detailedButton);
  clearCredentials();
});
