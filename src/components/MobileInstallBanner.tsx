import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_KEY = "gk-install-banner-dismissed";

type InstallOutcome = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallOutcome>;
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function MobileInstallBanner() {
  const isMobile = useIsMobile();
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isiOS =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);

    setPlatform(isiOS ? "ios" : isAndroid ? "android" : "other");
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncStandaloneState = () => setIsStandalone(isStandaloneMode());

    syncStandaloneState();

    displayMode.addEventListener("change", syncStandaloneState);

    window.addEventListener("appinstalled", syncStandaloneState);

    return () => {
      displayMode.removeEventListener("change", syncStandaloneState);

      window.removeEventListener("appinstalled", syncStandaloneState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      handleDismiss();
    }

    setDeferredPrompt(null);
  };

  const message = useMemo(() => {
    if (platform === "ios") {
      return "No iPhone, toque em Compartilhar e depois em Adicionar a Tela de Inicio para abrir o site como app.";
    }

    if (deferredPrompt) {
      return "Instale o GK para abrir direto da tela inicial, em tela cheia e sempre no layout mobile.";
    }

    return "No Android, abra o menu do navegador e toque em Instalar app ou Adicionar a tela inicial.";
  }, [deferredPrompt, platform]);

  const showBanner = isMobile && !dismissed && !isStandalone && (platform === "ios" || platform === "android");

  if (!showBanner) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 md:hidden">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Usar como app no celular</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Fechar dica de instalacao"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {deferredPrompt ? (
                <Button size="sm" onClick={handleInstall}>
                  <Download className="h-4 w-4" />
                  Instalar app
                </Button>
              ) : null}

              {platform === "ios" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Share2 className="h-3.5 w-3.5" />
                  Safari &gt; Compartilhar
                </span>
              ) : null}

              {platform === "android" && !deferredPrompt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Download className="h-3.5 w-3.5" />
                  Menu &gt; Instalar app
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
