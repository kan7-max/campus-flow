# 2026-05-24 Beta Guide / Feedback / Deploy Pass

## 実施内容
- β配布向けの公開ページを追加:
  - `/beta-guide`
  - `/feedback`
  - `/terms`
  - `/privacy`
- 既存 `/beta-guides` は Office 埋め込みから、画像直表示（高解像度PNG）方式へ移行。
- β資料導線を `/beta-guide?view=pc|mobile` へ統一。
- 不具合報告を GitHub不要に変更（メールフォーム + 任意の外部フォーム）。
- 公開連絡先メールを `campusflow.official@gmail.com` に統一。
- `middleware.ts` で公開情報ページを認証除外に追加。
- β資料画像を `public/docs/beta` に配置（PC 2560x1440 / Mobile 1440x2560）。

## 確認
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
- `npm run build -- --no-lint` ✅
- 本番デプロイ `new-project-phi-bay.vercel.app` へ反映済み（Ready）。
