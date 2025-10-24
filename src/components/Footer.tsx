export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Sistema GK – Gerenciador de Peças 3D
          </p>
          <p className="text-sm text-muted-foreground">
            Criado por <span className="text-primary font-medium">Gabriel Vilela</span> e{" "}
            <span className="text-primary font-medium">Kaique</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
