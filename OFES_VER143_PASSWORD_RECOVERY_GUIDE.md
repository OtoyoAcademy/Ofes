# OFES Ver.1.43 — Supabase管理者パスワード再設定

## 実装内容
- 管理画面 → Supabase接続に「パスワード再設定メールを送信」を追加しました。
- メールアドレスを入力して送信すると、OFESの公開URLへ戻るリンクが届きます（Supabase Authの `resetPasswordForEmail` 使用）。
- リンクの先で「新しいパスワード（12文字以上）」と確認入力を行い、 `updateUser` で変更します。
- 再設定画面は管理画面の簡易ロックを通らなくても開けるため、Supabaseにログインできなくても再設定できます。
- OFESと駅伝タイマーの `school-events` Supabaseプロジェクトは引き続き共用します。データ構造・UID・RLSには変更を加えていません。

## Supabaseダッシュボードで手動設定が必要

Authentication → URL Configuration → Redirect URLs → Add URL に以下を追加してください。

```
https://otoyoacademy.github.io/Ofes/?ofes-reset-password=1
```

- 今回はSite URL (`http://localhost:3000`) を変更しません。
- 駅伝タイマーの公開URLも、必要なら別項目として登録してください。正確なURLは実際の公開先を確認してから入力してください。
- Redirect URLsが未登録のままだと、再設定メールがlocalhostに戻る可能性があります。
- 発送には学校メールの受信ができることと、Supabase Authメール送信設定が必要です。

## 設定後の試験手順
1. 旧ブラウザのログイン状態は維持する。
2. Ver.1.43のファイルをGitHub Pages公開フォルダに上書きしてCtrl+F5。
3. 管理画面→Supabase接続に管理者メールアドレスを入力し、「パスワード再設定メールを送信」を押す。
4. 学校のメールでリンクを開く。アドレスが `/Ofes/?ofes-reset-password=1` に戻ることを確認する。
5. 新パスワードを入力して変更する。
6. 別のシークレットウィンドウで新パスワードを使ってOFES管理者ログインを確認する。
7. Supabase AuthのUIDが以前と同じであることを確認する。

## 注意
- 認証用パスワードはGitHubファイルやこのチャットに貼らないでください。
- Site URL以外の影響を最小化するため、再設定メールはOFESアプリ内から送ります。Supabase管理画面の「Send password recovery」は、redirectToを指定しないため今回の用途には使用しません。
- GitHub Pages/Supabase上での本番送信テストはまだ行っていません。
- この変更のための追加SQLは不要です。
