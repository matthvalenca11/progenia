import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { z } from "zod";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Endereço de e-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(100),
  institution: z.string().trim().max(200).optional(),
});

const signInSchema = z.object({
  email: z.string().trim().email("Endereço de e-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Sign Up State
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    email: "",
    password: "",
    institution: "",
  });

  // Sign In State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    // 1) Ouvir mudanças de auth primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard');
      }
    });

    // 2) Verificar estado atual com getUser (evita sessão local "fantasma")
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signUpSchema.parse(signUpData);
      setLoading(true);

      // Create user with Supabase Auth (no email confirmation)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            full_name: validated.fullName,
            institution: validated.institution,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Este e-mail já está registrado. Por favor, faça login.");
        } else {
          toast.error(signUpError.message);
        }
        return;
      }

      // Generate verification token
      const token = crypto.randomUUID() + '-' + Date.now();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      if (authData.user) {
        // Store verification token in profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            verification_token: token,
            verification_expires_at: expiresAt.toISOString(),
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error storing verification token:', profileError);
        }

        // Send verification email via edge function
        const { error: emailError } = await supabase.functions.invoke('send-verification-email', {
          body: { email: validated.email, token },
        });

        if (emailError) {
          console.error('Error sending verification email:', emailError);
        }

        toast.success("Conta criada!", {
          description: "Verifique seu e-mail para confirmar seu cadastro.",
        });
        
        // Sign out the user until they verify email
        await supabase.auth.signOut();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro durante o cadastro");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signInSchema.parse(signInData);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("E-mail ou senha inválidos");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("E-mail não verificado", {
            description: "Por favor, verifique seu e-mail e clique no link de confirmação antes de fazer login.",
          });
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Verificar se o email foi verificado no perfil
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', data.user.id)
          .single();

        if (profile && !profile.email_verified) {
          await supabase.auth.signOut();
          toast.error("E-mail não verificado", {
            description: "Por favor, verifique seu e-mail e clique no link de confirmação para ativar sua conta.",
          });
          return;
        }
      }

      toast.success("Bem-vindo de volta!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro durante o login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="ProGenia" className="h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Bem-vindo à ProGenia</h1>
          <p className="text-muted-foreground mt-2">
            Sua jornada para dominar a tecnologia médica começa aqui
          </p>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">E-mail</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gradient-accent text-white" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>

                <div className="text-center mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Esqueceu sua senha?
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 px-4">
                    📧 Após criar sua conta, você receberá um e-mail de verificação. Clique no link para ativar sua conta antes de fazer login.
                  </p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="João Silva"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-institution">Instituição (Opcional)</Label>
                  <Input
                    id="signup-institution"
                    type="text"
                    placeholder="Sua universidade ou hospital"
                    value={signUpData.institution}
                    onChange={(e) => setSignUpData({ ...signUpData, institution: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Deve ter pelo menos 8 caracteres
                  </p>
                </div>
                <Button type="submit" className="w-full gradient-accent text-white" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;