import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useLabImmersiveShell } from "./hooks/useLabImmersiveShell";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ConsentProvider, useConsent } from "./contexts/ConsentContext";
import { isNativeApp, isNativeMobile } from "@/lib/capacitor";
import { hasCompletedNativeLanguageOnboarding } from "@/lib/nativeLanguageOnboarding";
import { NativeLanguageOnboarding } from "@/components/onboarding/NativeLanguageOnboarding";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import AITutor from "@/components/AITutor";
import Sobre from "@/pages/Sobre";
import Contact from "@/pages/Contact";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import ModuleViewer from "@/pages/ModuleViewer";
import ModuleCapsules from "@/pages/ModuleCapsules";
import LessonViewer from "@/pages/LessonViewer";
import CapsuleViewer from "@/pages/CapsuleViewer";
import AllCapsules from "@/pages/AllCapsules";
import VirtualLabEditorUnified from "@/pages/VirtualLabEditorUnified";
import VirtualLabsAdmin from "@/pages/VirtualLabsAdmin";
import LabViewer from "@/pages/LabViewer";
import DeleteUserTest from "@/pages/DeleteUserTest";
import BlogNoticias from "@/pages/BlogNoticias";
import ContentSearch from "@/pages/ContentSearch";
import NotFound from "@/pages/NotFound";
import { CookieBanner } from "@/components/privacy/CookieBanner";
import { CookiePreferencesDialog } from "@/components/privacy/CookiePreferencesDialog";
import { CookiePreferencesButton } from "@/components/privacy/CookiePreferencesButton";
import { applyTelemetryFromConsent, initConsentAwareTelemetry } from "@/lib/telemetry";

const Landing = lazy(() => import("@/pages/Landing"));
const TherapeuticLabSmoke = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/TherapeuticLabSmoke"))
  : null;

const queryClient = new QueryClient();

const PrivacyBootstrap = () => {
  const { preferences, ready } = useConsent();

  useEffect(() => {
    if (!ready) return;
    applyTelemetryFromConsent(preferences);
  }, [preferences, ready]);

  useEffect(() => {
    initConsentAwareTelemetry();
  }, []);

  return null;
};

const AppContent = () => {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();
  const isImmersiveLabRoute = useLabImmersiveShell();
  const [languageOnboardingChecked, setLanguageOnboardingChecked] = useState(!isNativeMobile);
  const [showLanguageOnboarding, setShowLanguageOnboarding] = useState(false);

  useEffect(() => {
    if (!bootstrapped) return;

    if (!isNativeMobile || user) {
      setLanguageOnboardingChecked(true);
      setShowLanguageOnboarding(false);
      return;
    }

    let cancelled = false;
    void hasCompletedNativeLanguageOnboarding().then((done) => {
      if (cancelled) return;
      setShowLanguageOnboarding(!done);
      setLanguageOnboardingChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, user]);

  if (!bootstrapped || (isNativeMobile && !user && !languageOnboardingChecked)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (showLanguageOnboarding) {
    return <NativeLanguageOnboarding onComplete={() => setShowLanguageOnboarding(false)} />;
  }

  // Tutor de IA: oculto na landing/sobre/blog e em labs tela cheia
  const shouldShowAITutor =
    user &&
    location.pathname !== "/" &&
    location.pathname !== "/sobre" &&
    location.pathname !== "/blog" &&
    location.pathname !== "/auth" &&
    !location.pathname.startsWith("/labs/");

  return (
    <div
      className={`layout-contained flex min-h-[100dvh] flex-col bg-background text-foreground${
        isImmersiveLabRoute ? " touch-none overflow-hidden" : isNativeApp ? " touch-pan-y" : " overflow-x-hidden touch-pan-y"
      }${isNativeApp && !isImmersiveLabRoute ? " native-safe-shell" : ""}`}
      style={
        !isNativeApp && !isImmersiveLabRoute
          ? {
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }
          : undefined
      }
    >
      <main
        className={
          isImmersiveLabRoute
            ? "layout-contained flex min-h-[100dvh] w-full flex-1 flex-col overflow-hidden touch-none p-0"
            : isNativeApp
              ? "layout-contained native-shell-padding flex min-h-0 w-full flex-1 flex-col overflow-y-auto touch-pan-y pb-6 pt-2"
              : "layout-contained flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden touch-pan-y px-3 pb-6 pt-2 sm:px-4 md:px-8 md:pb-10 md:pt-4"
        }
      >
        <div className="layout-contained flex min-h-0 w-full flex-1 flex-col">
        <Routes>
          <Route path="/" element={isNativeApp
            ? <Navigate to={user ? "/dashboard" : "/auth"} replace />
            : <Suspense fallback={null}><Landing /></Suspense>
          } />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/blog" element={<BlogNoticias />} />
          {/* On native: if there is already a valid session, skip login screen. */}
          <Route path="/auth" element={
            isNativeApp && user
              ? <Navigate to="/dashboard" replace />
              : <Auth />
          } />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/module/:moduleId" element={<ModuleViewer />} />
          <Route path="/module/:moduleId/capsulas" element={<ModuleCapsules />} />
          <Route path="/lesson/:lessonId" element={<LessonViewer />} />
          <Route path="/capsula/:capsulaId" element={<CapsuleViewer />} />
          <Route path="/capsulas" element={<AllCapsules />} />
          <Route path="/search" element={<ContentSearch />} />
          <Route path="/admin/labs" element={<VirtualLabsAdmin />} />
          <Route path="/admin/labs/novo" element={<VirtualLabEditorUnified />} />
          <Route path="/admin/labs/editar/:labId" element={<VirtualLabEditorUnified />} />
          <Route path="/labs/:slug" element={<LabViewer />} />
          <Route path="/delete-user-test" element={<DeleteUserTest />} />
          {import.meta.env.DEV && TherapeuticLabSmoke ? (
            <Route
              path="/dev/lab-smoke/:type?"
              element={
                <Suspense fallback={null}>
                  <TherapeuticLabSmoke />
                </Suspense>
              }
            />
          ) : null}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </main>

      {/* Tutor de IA disponível também no mobile */}
      {shouldShowAITutor && (
        <AITutor
          mobileLeadingActions={<CookiePreferencesButton variant="icon" inlineFab />}
        />
      )}
      <CookiePreferencesButton
        shiftUpForAiTutorFab={shouldShowAITutor}
        className={shouldShowAITutor ? "hidden md:inline-flex" : undefined}
      />
      <CookieBanner />
      <CookiePreferencesDialog />
    </div>
  );
};

const AppRouter = isNativeApp ? HashRouter : BrowserRouter;

const App = () => (
  <ThemeProvider>
    <LanguageProvider>
      <ConsentProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRouter>
                <PrivacyBootstrap />
                <AppErrorBoundary>
                  <AppContent />
                </AppErrorBoundary>
              </AppRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ConsentProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
