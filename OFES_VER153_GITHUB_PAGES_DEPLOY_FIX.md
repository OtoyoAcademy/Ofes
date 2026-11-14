# OFES Ver.1.53 GitHub Pages 公開エラー修正の手順

## 発生したエラー
GitHub Actions の `pages-build-deployment` #34, #35 で `File name too long` のため公開が失敗しています。
これはブラウザのキャッシュではありません。GitHub への更新と GitHub Pages の公開は別です。

問題のファイルは GitHub リポジトリ直下にある `OFES_` で始まり、文字化けした非常に長い名前の `.xlsx` ファイルです。

## 必要な操作（最重要）
1. GitHub の `OtoyoAcademy/Ofes` リポジトリの Code タブに戻ります。
2. 直下のファイル一覧から、`OFES_` で始まり文字化けしている長い `.xlsx` ファイルを開きます。
3. 右上の三点メニューから `Delete file` を選び、`Commit changes` します。もし `assets/templates` に同様の異常な長いファイル名がある場合も削除します。
4. `Actions` → `pages-build-deployment` で最新実行が緑色（成功）になることを確認します。
5. OFES サイトを Ctrl+Shift+R で再読み込みし、管理画面の `Ver.1.53` を確認します。

削除対象の文字化けしたファイルは旧入力様式サンプルです。現行Excel入力様式はアプリのJavaScriptから生成するため、これらの異常なファイル名は不要です。

## このZIPについて
このZIPは従来の Ver.1.53 のうち **公開エラーの元になる壊れたファイル名の旧テンプレート2件を省いた**ものです。アプリの機能・Supabase設定は変更していません。
GitHub上に以前アップロードした同名ファイルは **ZIPの中に含めないだけでは消えません**。必ず先にGitHubで削除してください。

## 補足
他の文字化けした長いファイル名で同様のエラーが出た場合も GitHub Actions のエラー詳細にある `unable to create file ...: File name too long` のファイルを削除・短い名称に変更してください。正常なデータや設定ファイルは削除しないでください。
