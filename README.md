# OFES Ver.1.21 — Supabase移行版

Firebase / Firestore 依存を外し、学校用GitHub Pages + Supabase で動作するようにした移行版です。

公開URL（学校用）:
https://otoyoacademy.github.io/Ofes/

## この版で置き換わるもの

- Firestore 公開データ → Supabase PostgreSQL `ofes_site_state`
- Firebase Google管理者認証 → Supabase Auth メールアドレス＋パスワード
- Firebase 匿名認証 → Supabase Anonymous Sign-In
- Firestore Security Rules → PostgreSQL Row Level Security (RLS)
- 公開前復元ポイント → `ofes_publication_backups`
- リアクション → `ofes_reaction_votes`
- リアクション全クリア前の復元ポイント → `ofes_reaction_backups`

会場案内・プログラム・スタンプラリー・リアクションUI・集計PDF・保護者向けPDFなどの画面側はVer.1.19を引き継いでいます。

## 重要：このZIPをすぐGitHubへ上書きしないでください

`supabase-config.js` はまだプレースホルダーです。
先にSupabaseプロジェクトを作成し、SQL設定と管理者登録を終えてから、Project URL / Publishable key を入力してください。

## 移行手順

### 1. 現在のFirebase版を残す

- 個人Firebase `ofes-dev` は削除しない。
- 現在GitHub Pagesで動いている版を、Supabase版の確認が終わるまで予備として残す。
- OFES管理画面から最新の設定JSONを保存しておく。

### 2. Supabaseプロジェクトを作成

Supabase DashboardでFreeプロジェクトを1つ作成します。
プロジェクト名の例: `ofes-school`

データベースパスワードは安全な場所へ保管してください。
地域を選択できる場合は、日本に近いリージョンを選びます。

### 3. DB / RLSを一括設定

Supabase Dashboard → SQL Editor で `supabase-setup.sql` の内容をすべて実行します。

作成される主なテーブル:

- `ofes_site_state`
- `ofes_publication_backups`
- `ofes_reaction_votes`
- `ofes_reaction_backups`
- `ofes_admins`

### 4. Authenticationを設定

Authentication の設定で次を確認します。

- Email / Password: 使用
- Anonymous Sign-In: 有効

管理者の一般公開サインアップは不要です。
管理者ユーザーはDashboardから1名作成し、学校用メールアドレスと強いパスワードを設定してください。

作成した管理者ユーザーのUUIDをコピーします。

`register-admin.sql.template` の
`PASTE_ADMIN_USER_UUID_HERE`
をUUIDへ置き換え、SQL Editorで実行します。

### 5. Supabaseの接続情報を取得

Project URL と Publishable key を取得します。

`supabase-config.js` を開いて次を置き換えます。

```js
export const supabaseConfig = {
  url: 'https://xxxxxxxx.supabase.co',
  publishableKey: 'sb_publishable_xxxxxxxx'
};
```

旧形式の `anon` public key しか表示されない場合は、それを `publishableKey` に設定しても構いません。

**secret key / service_role key は絶対にGitHubへ置かないでください。**

### 6. GitHub PagesへVer.1.21をアップロード

`OFES_Ver1.20_Supabase` フォルダの「中身」を、学校GitHub `OtoyoAcademy / Ofes` のルートへ上書きします。

Firebase用の以下のファイルはVer.1.21には不要です。

- `firebase-config.js`
- `firebase-bridge.js`
- `firestore.rules`

### 7. 管理者ログインを確認

学校版URLを開きます。

管理者 → Supabase接続 → 管理者メールアドレス＋パスワード

次が確認できれば成功です。

- SDK: 接続準備完了
- 管理者認証: 管理者ログイン成功
- Supabase公開: 未公開または公開データあり

### 8. 既存JSONを読み込んでSupabaseへ公開

管理者 → データ保存 → 設定JSONを読み込む

会場・プログラムが戻ったことを確認してから、
「Supabaseへ公開」
を押します。

これでFirebaseの公開データを直接コピーしなくても、設定JSONから学校用Supabaseへ移行できます。

### 9. 本番前テスト

最低限、次を確認してください。

1. 通常ブラウザでプログラム・会場案内が表示される
2. シークレットウィンドウでも同じデータが表示される
3. 管理者で変更→Supabaseへ公開→別端末へ反映
4. リアクションを押す／取り消す
5. リアクション一括集計
6. 全体PDF・学年別PDF
7. リアクション全クリア→復元
8. 公開データの自動バックアップ→直前状態へ復元
9. スタンプラリー
10. 保護者向けPDFのQRコードが学校URLを開く

## Firebase側のデータについて

Ver.1.21はFirebaseへアクセスしません。
ただし、移行完了が確認できるまではFirebaseプロジェクトを削除しないでください。

本番前のリアクションはテストデータのため、Ver.1.21ではFirebase上のリアクション履歴を自動移行しません。
会場・プログラム・年度設定は設定JSONから移行します。

## Supabase Free運用メモ

OFESは年1回の利用なので、Freeプロジェクトが長期間低活動で一時停止される可能性があります。
行事の1〜2週間前にSupabase Dashboardを開き、プロジェクトが稼働中か確認し、複数端末で本番テストしてください。

## ファイル構成

- `index.html` — アプリ本体
- `app.js` — OFES画面・管理機能
- `style.css` — デザイン
- `supabase-bridge.js` — Supabaseとの通信・認証・リアクション・復元
- `supabase-config.js` — Project URL / Publishable key
- `supabase-setup.sql` — DB・RLS初期設定
- `register-admin.sql.template` — 管理者UID登録テンプレート
- `manifest.webmanifest` — ホーム画面アプリ設定
- `assets/` — ロゴ、アイコン、学校用URLのQRコード



## Ver.1.21 修正

- JSON読み込み後に、ファイル名・会場件数・プログラム件数を「データ保存」画面へ常時表示します。
- JSONを読み込んだデータを編集用下書きとして明示的に切り替え、ブラウザ保存後に管理画面・来場者画面へ再描画します。
- ファイル入力欄は同じJSONを再選択できるよう読み込み後にリセットしますが、読み込み結果は画面に残ります。
