import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Phone, User, Send } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadLegalBundle } from "@/lib/legal";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  phone: z.string().trim().min(1, "Telefone é obrigatório").max(20, "Telefone muito longo"),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(1000, "Mensagem muito longa"),
  requestType: z
    .enum(["general_contact", "access", "correction", "deletion", "portability", "opposition", "consent_revocation", "other"])
    .default("general_contact"),
});

const Contact = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    requestType: "general_contact",
  });
  const [dpoInfo, setDpoInfo] = useState("");

  useEffect(() => {
    const loadDpo = async () => {
      try {
        const bundle = await loadLegalBundle(supabase);
        if (!bundle) return;
        const info = [bundle.dpoEmail, bundle.dpoChannel].filter(Boolean).join(" | ");
        if (info) setDpoInfo(info);
      } catch {
        // ignore
      }
    };
    void loadDpo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validar dados
      const validatedData = contactSchema.parse(formData);
      
      setLoading(true);

      // Enviar via edge function
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: validatedData,
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: data?.protocol
          ? `Entraremos em contato em breve. Protocolo: ${data.protocol}`
          : "Entraremos em contato em breve. Solicitações LGPD recebem número de protocolo.",
      });

      // Limpar formulário
      setFormData({
        name: "",
        email: "",
        phone: "",
        message: "",
        requestType: "general_contact",
      });
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao enviar mensagem",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8">
        <img src={logo} alt="ProGenia" className="h-16 hover:opacity-80 transition-opacity cursor-pointer progenia-logo" />
      </Link>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="w-fit mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <CardTitle className="text-3xl font-bold">Fale Conosco</CardTitle>
          <CardDescription>
            Envie sua mensagem que retornaremos em breve
          </CardDescription>
          {dpoInfo ? (
            <p className="text-xs text-muted-foreground">Canal DPO/LGPD: {dpoInfo}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestType">Tipo de solicitação</Label>
              <Select
                value={formData.requestType}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, requestType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_contact">Contato geral</SelectItem>
                  <SelectItem value="access">LGPD - Acesso aos dados</SelectItem>
                  <SelectItem value="correction">LGPD - Correção de dados</SelectItem>
                  <SelectItem value="deletion">LGPD - Exclusão de dados</SelectItem>
                  <SelectItem value="portability">LGPD - Portabilidade</SelectItem>
                  <SelectItem value="opposition">LGPD - Oposição</SelectItem>
                  <SelectItem value="consent_revocation">LGPD - Revogação de consentimento</SelectItem>
                  <SelectItem value="other">LGPD - Outro pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Digite sua mensagem..."
                value={formData.message}
                onChange={handleChange}
                className="min-h-[150px]"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensagem
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contact;
