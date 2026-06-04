import { LoginCard } from "@/components/layout/login-card";
import { isSupabaseEnabled } from "@/lib/env";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveOauthErrorMessage(raw: string | undefined) {
  if (!raw) {
    return null;
  }

  if (raw === "supabase_disabled") {
    return "Supabase設定が未完了のためGoogleログインを開始できません。";
  }

  if (raw === "supabase_apikey_missing") {
    return "Supabase APIキー設定が見つかりません。Vercel環境変数を確認してください。";
  }

  if (raw === "redirect_not_allowed") {
    return "認証リダイレクトURLが許可されていません。SupabaseのRedirect URLsを確認してください。";
  }

  if (raw === "provider_disabled") {
    return "SupabaseでGoogle Providerが無効です。Authentication > Providersで有効化してください。";
  }

  if (raw === "oauth_client_invalid") {
    return "Google OAuthクライアント設定が無効です。Client ID / Secretを確認してください。";
  }

  if (raw === "oauth_state_mismatch") {
    return "ログイン状態の検証に失敗しました。別タブを閉じ、再読み込みして再試行してください。";
  }

  if (raw === "oauth_code_invalid") {
    return "Google認証コードが期限切れです。再度ログインしてください。";
  }

  if (raw === "oauth_code_missing") {
    return "Googleログイン後の認証コードを受け取れませんでした。Google/Supabaseのリダイレクト設定を確認してください。";
  }

  if (raw === "oauth_provider_error") {
    return "Google側でログイン処理が中断されました。Google OAuth設定と承認済みURIを確認してください。";
  }

  if (raw === "oauth_callback_failed") {
    return "Googleログインの完了処理に失敗しました。設定を確認して再試行してください。";
  }

  if (raw === "oauth_hash_missing") {
    return "Googleログイン情報の受け取りに失敗しました。ブラウザを更新して再度ログインしてください。";
  }

  if (raw === "oauth_hash_restore_failed") {
    return "Googleログインのセッション復元に失敗しました。もう一度ログインしてください。";
  }

  if (raw === "oauth_network_failed") {
    return "Googleログイン通信に失敗しました。ネットワーク接続とCSP/拡張機能設定を確認してください。";
  }

  if (raw === "oauth_start_rate_limited") {
    return "短時間にログイン開始が繰り返されました。数秒待ってから再試行してください。";
  }

  if (raw === "oauth_start_exception") {
    return "Googleログイン初期化中に予期しないエラーが発生しました。";
  }

  if (raw === "oauth_url_missing") {
    return "GoogleログインURLを取得できませんでした。設定を確認して再試行してください。";
  }

  return `Googleログインの開始に失敗しました。ページを再読み込みして再試行してください。（code: ${raw}）`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectParam = params.redirectTo;
  const redirectTo = typeof redirectParam === "string" ? redirectParam : "/dashboard";
  const oauthErrorParam = params.oauth_error;
  const oauthError = typeof oauthErrorParam === "string" ? oauthErrorParam : undefined;
  const oauthReasonParam = params.oauth_reason;
  const oauthReason =
    typeof oauthReasonParam === "string"
      ? (() => {
          try {
            return decodeURIComponent(oauthReasonParam);
          } catch {
            return oauthReasonParam;
          }
        })()
      : null;
  const initialErrorBase = resolveOauthErrorMessage(oauthError);
  const initialError =
    initialErrorBase && oauthReason ? `${initialErrorBase}\n詳細: ${oauthReason}` : initialErrorBase;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginCard redirectTo={redirectTo} isSupabaseEnabled={isSupabaseEnabled} initialError={initialError} />
    </main>
  );
}
