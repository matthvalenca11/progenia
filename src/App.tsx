import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ConsentProvider, useConsent } from "./contexts/ConsentContext";
import { isNativeApp } from "@/lib/capacitor";
import AITutor from "@/components/AITutor";
import Landing from "@/pages/Landing";
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
  const { user } = useAuth();
  const location = useLocation();
  const isImmersiveLabRoute =
    location.pathname.startsWith("/labs/") ||
    location.pathname.startsWith("/admin/labs/novo") ||
    location.pathname.startsWith("/admin/labs/editar/");

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
      className={`flex min-h-[100dvh] flex-col bg-background text-foreground overflow-x-clip${
        isNativeApp && !isImmersiveLabRoute ? " native-safe-shell" : ""
      }`}
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
            ? "flex min-h-[100dvh] w-full flex-1 flex-col overflow-x-clip p-0"
            : isNativeApp
              ? "native-shell-padding flex-1 flex flex-col overflow-y-auto overflow-x-clip pb-6 pt-2 md:px-8 md:pb-10 md:pt-4"
              : "flex-1 flex flex-col overflow-y-auto overflow-x-clip px-3 pb-6 pt-2 sm:px-4 md:px-8 md:pb-10 md:pt-4"
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/blog" element={<BlogNoticias />} />
          <Route path="/auth" element={<Auth />} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Tutor de IA disponível também no mobile */}
      {shouldShowAITutor && (
        <AITutor />
      )}
      <CookiePreferencesButton shiftUpForAiTutorFab={shouldShowAITutor} />
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
                <AppContent />
              </AppRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ConsentProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
