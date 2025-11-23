import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
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
import LessonViewer from "@/pages/LessonViewer";
import CapsuleViewer from "@/pages/CapsuleViewer";
import VirtualLabEditor from "@/pages/VirtualLabEditor";
import VirtualLabsAdmin from "@/pages/VirtualLabsAdmin";
import DeleteUserTest from "@/pages/DeleteUserTest";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Não mostrar o tutor na landing/sobre
  const shouldShowAITutor =
    user && location.pathname !== "/" && location.pathname !== "/sobre";

  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden"
      style={{
        // safe area do iOS (notch e barra inferior)
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Conteúdo principal rolável, com padding global para mobile */}
      <main className="flex-1 flex flex-col overflow-y-auto px-4 pb-8 pt-2 md:px-8 md:pb-10 md:pt-4">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/module/:moduleId" element={<ModuleViewer />} />
          <Route path="/lesson/:lessonId" element={<LessonViewer />} />
          <Route path="/capsula/:capsulaId" element={<CapsuleViewer />} />
          <Route path="/admin/labs" element={<VirtualLabsAdmin />} />
          <Route path="/admin/labs/novo" element={<VirtualLabEditor />} />
          <Route path="/admin/labs/editar/:labId" element={<VirtualLabEditor />} />
          <Route path="/delete-user-test" element={<DeleteUserTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Tutor de IA: só em telas médias pra cima, pra não matar o mobile */}
      {shouldShowAITutor && (
        <div className="hidden md:block">
          {/* Se o AITutor já tiver posição própria, ele continua controlando.
             Se você quiser forçar posição flutuante:
             <div className="fixed bottom-4 right-4 z-40">
               <AITutor />
             </div>
          */}
          <AITutor />
        </div>
      )}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
