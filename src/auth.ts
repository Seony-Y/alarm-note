import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const nativeRedirectUrl = "com.seony.harualarm://auth/callback";

export async function signInWithGoogle() {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative ? nativeRedirectUrl : window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: isNative,
      scopes:
        "openid email profile https://www.googleapis.com/auth/calendar.events",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) throw error;
  if (isNative && data.url) await Browser.open({ url: data.url });
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

export async function registerNativeAuthCallback() {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  const listener = await App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(nativeRedirectUrl)) return;
    const code = new URL(url).searchParams.get("code");
    if (code) await supabase.auth.exchangeCodeForSession(code);
    await Browser.close();
  });

  return () => listener.remove();
}
