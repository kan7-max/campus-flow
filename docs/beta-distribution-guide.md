# Campus Flow β配布ガイド（Web / PWA）

## 目的
- App Store / Google Play 前に、Web URL + PWA でβテスター配布する。
- GitHubアカウント不要で不具合・感想を回収する。

## 配布URL
- β案内: `/beta-guide`
- AI入力: `/ai`
- 今日やること: `/today`
- 課題一覧: `/assignments`
- 不具合報告: `/feedback`

## 連絡先
- 公開連絡先メール: `campusflow.official@gmail.com`

## 配布時の説明（短文）
- Campus Flowは「時間割アプリ」ではなく「AI課題整理アプリ」。
- WebClass / LMS文章を貼ると課題候補をAI抽出。
- 保存前に候補を手動確認してから保存。
- 保存後は `/today` で今日やることを確認。

## 3分で開始
1. ログイン: アプリを開いてGoogleでログインします。
2. 授業を追加: `/courses` の「授業を追加」で授業名、曜日、時限を入れて「授業を保存」を押します。
3. 今日やることを確認: 「今日やること」で保存済みの課題と次の作業を確認します。

## FAQ（初見ユーザー向け）
- 曜日/時限が分からない: まず分かる曜日と開始・終了時刻で「授業を保存」し、あとから授業編集で直してください。
- 時間割画像/PDFから作成に失敗した: `/courses` の「授業を追加」に戻り、授業名、曜日、時限を手入力して「授業を保存」を押してください。
- 保存に失敗した: 入力欄の下に出る赤い案内を直して、同じ画面で「授業を保存」または「選択候補を保存」をもう一度押してください。
- AI抽出結果が違う: 保存前の抽出プレビューで課題名・授業名・締切を修正してから「選択候補を保存」を押してください。

## PWA案内（短縮）
- iPhone: Safariで開く → 共有 → ホーム画面に追加
- Android: Chromeで開く → メニュー → ホーム画面に追加

## GitHub不要の報告導線
- `/feedback` ページからメール送信フォームを利用。
- 必要に応じて外部フォーム（`BETA_FEEDBACK_FORM_URL`）へ誘導。
- 個人情報や課題本文全文の送信は必須にしない。

## 資料画像
- 配置先: `public/docs/beta`
- PC向け: `beta-guide-pc-01.png` ... `beta-guide-pc-05.png`
- スマホ向け: `beta-guide-mobile-01.png` ... `beta-guide-mobile-05.png`
- 採用PPTX（PC向け）: `public/beta-guides/Campus_Flow_new_user_guide_one_glance_wide.pptx`
- 採用PPTX（スマホ向け）: `public/beta-guides/Campus_Flow_new_user_guide_one_glance_vertical.pptx`

## 注意
- 課題保存本体の成否と外部連携の失敗を分離する既存方針を維持する。
- APIキーや service role key を画面表示しない。
