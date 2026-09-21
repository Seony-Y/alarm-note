import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const nativeRedirectUrl = "com.seony.harualarm://auth/callback";

async function startGoogleOAuth(scopes: string, requestConsent = false) {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative ? nativeRedirectUrl : window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: isNative,
      scopes,
      queryParams: requestConsent
        ? {
            access_type: "offline",
            include_granted_scopes: "true",
            prompt: "consent",
          }
        : { include_granted_scopes: "true" },
    },
  });

  if (error) throw error;
  if (isNative && data.url) await Browser.open({ url: data.url });
}

export function signInWithGoogle() {
  return startGoogleOAuth("openid email profile");
}

export function connectGoogleCalendar() {
  return startGoogleOAuth(
    "openid email profile https://www.googleapis.com/auth/calendar.events.readonly",
    true,
  );
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data.subscription.unsubscribe();
}

async function handleNativeAuthUrl(url: string) {
  if (!url.startsWith(nativeRedirectUrl)) return;

  try {
    const params = new URL(url).searchParams;
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) throw new Error(oauthError);

    const code = params.get("code");
    if (!code) throw new Error("Google 인증 코드를 받지 못했습니다.");

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } finally {
    await Browser.close();
  }
}

export async function registerNativeAuthCallback() {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleNativeAuthUrl(url).catch((error) => {
      console.error("Google 인증 콜백을 처리할 수 없습니다.", error);
    });
  });

  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) await handleNativeAuthUrl(launchUrl.url);

  return () => listener.remove();
}
