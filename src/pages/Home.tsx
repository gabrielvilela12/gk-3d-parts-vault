import { Button } from "@/components/ui/button";
import { Box, Ruler, Database, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOCIgc3Ryb2tlPSJoc2woMjE3IDkxJSA2MCUgLyAwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
                <Box className="h-12 w-12 text-primary" />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              GK – Gestão de Peças 3D
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Sistema profissional de estoque e documentação técnica para suas peças impressas em 3D
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg h-12 px-8">
                <Link to="/auth">Começar agora</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg h-12 px-8">
                <Link to="/about">Conheça os criadores</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Recursos principais
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Database,
                title: "Catálogo Completo",
                description: "Organize todas as suas peças com informações detalhadas e imagens",
              },
              {
                icon: Ruler,
                title: "Medidas Precisas",
                description: "Registre largura, altura, profundidade e materiais utilizados",
              },
              {
                icon: Box,
                title: "Arquivos STL",
                description: "Armazene e acesse seus arquivos de impressão 3D facilmente",
              },
              {
                icon: Shield,
                title: "Seguro e Privado",
                description: "Seus dados protegidos com autenticação e backup automático",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl card-gradient border border-border/50 hover:border-primary/50 transition-all hover:glow-primary"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para organizar suas peças?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Crie sua conta gratuitamente e comece a documentar suas impressões 3D hoje mesmo
            </p>
            <Button asChild size="lg" className="text-lg h-12 px-8">
              <Link to="/auth">Criar conta grátis</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
