import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Megaphone, MessageSquareText, Pickaxe, ExternalLink } from "lucide-react";

const gpts = [
  {
    name: "Precificação de Produtos",
    description: "Calcule preços ideais para seus produtos com base em custos e margem de lucro.",
    url: "https://chatgpt.com/g/g-6990868786e4819180fd385f4e9e5d16-precificacao-produtos",
    icon: DollarSign,
  },
  {
    name: "Criador de Anúncio",
    description: "Gere textos persuasivos para anúncios dos seus produtos.",
    url: "https://chatgpt.com/g/g-69908c8d62788191bdf2d7cf34d118cf-criador-de-anuncio",
    icon: Megaphone,
  },
  {
    name: "Responder Comentários",
    description: "Crie respostas profissionais para comentários de clientes.",
    url: "https://chatgpt.com/g/g-69908ddcd5608191a88527d97d03db60-responder-comentarios",
    icon: MessageSquareText,
  },
  {
    name: "Minerador",
    description: "Encontre produtos tendência e oportunidades de mercado.",
    url: "https://chatgpt.com/g/g-699093b077c481919000940f9971d55b-minerador",
    icon: Pickaxe,
  },
];

export default function GptLinks() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">GPTs</h1>
        <p className="text-muted-foreground mt-1">Assistentes de IA customizados para o seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {gpts.map((gpt) => {
          const Icon = gpt.icon;
          return (
            <Card key={gpt.name} className="card-gradient border-border/50 flex flex-col">
              <CardHeader className="items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mb-2">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-lg">{gpt.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 items-center text-center">
                <p className="text-sm text-muted-foreground mb-6 flex-1">{gpt.description}</p>
                <Button asChild className="w-full gap-2">
                  <a href={gpt.url} target="_blank" rel="noopener noreferrer">
                    Abrir GPT
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
