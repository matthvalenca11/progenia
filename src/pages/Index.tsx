import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 text-foreground">
            Projeto Placeholder
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Este é um projeto inicial. Conecte ao GitHub e faça upload dos seus arquivos para substituir este conteúdo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="p-6">
            <div className="w-12 h-12 bg-primary rounded-lg mb-4 flex items-center justify-center">
              <span className="text-2xl text-primary-foreground">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Conecte ao GitHub</h3>
            <p className="text-muted-foreground">
              Clique no botão GitHub no topo e conecte seu repositório
            </p>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 bg-primary rounded-lg mb-4 flex items-center justify-center">
              <span className="text-2xl text-primary-foreground">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Faça Upload</h3>
            <p className="text-muted-foreground">
              Envie seus arquivos do projeto via GitHub
            </p>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 bg-primary rounded-lg mb-4 flex items-center justify-center">
              <span className="text-2xl text-primary-foreground">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Sincronize</h3>
            <p className="text-muted-foreground">
              As mudanças no GitHub sincronizam automaticamente aqui
            </p>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Button size="lg" className="mr-4">
            Começar
          </Button>
          <Button size="lg" variant="outline">
            Saiba Mais
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
