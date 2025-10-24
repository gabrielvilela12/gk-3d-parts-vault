import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Box, Github, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
              <Box className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Sobre o GK</h1>
          <p className="text-xl text-muted-foreground">
            Sistema de Gestão de Peças 3D
          </p>
        </div>

        {/* Mission */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle>Nossa Missão</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              O GK foi desenvolvido para resolver um problema real: a dificuldade de organizar
              e documentar peças impressas em 3D. Com este sistema, makers e entusiastas podem
              manter um catálogo completo de suas criações, incluindo especificações técnicas,
              medidas precisas e arquivos STL para futuras reimpressões.
            </p>
          </CardContent>
        </Card>

        {/* Creators */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="card-gradient border-border/50 hover:border-primary/50 transition-all hover:glow-primary">
            <CardHeader>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <span className="text-3xl font-bold text-primary">G</span>
              </div>
              <CardTitle>Gabriel Vilela</CardTitle>
              <CardDescription>Co-criador e Desenvolvedor</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Entusiasta de impressão 3D e desenvolvimento de software, focado em criar
                soluções práticas para makers.
              </p>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50 hover:border-primary/50 transition-all hover:glow-primary">
            <CardHeader>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <span className="text-3xl font-bold text-primary">K</span>
              </div>
              <CardTitle>Kaique</CardTitle>
              <CardDescription>Co-criador e Designer</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Especialista em design de interfaces e experiência do usuário, com paixão
                por tecnologia e impressão 3D.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle>Tecnologias Utilizadas</CardTitle>
            <CardDescription>Stack moderna e confiável</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                "React + Vite",
                "TypeScript",
                "Tailwind CSS",
                "Supabase Database",
                "Supabase Auth",
                "Supabase Storage",
              ].map((tech) => (
                <div
                  key={tech}
                  className="p-3 rounded-lg bg-muted/30 text-center font-medium"
                >
                  {tech}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="gap-2">
            <Link to="/catalog">
              <Box className="h-5 w-5" />
              Explorar Catálogo
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
