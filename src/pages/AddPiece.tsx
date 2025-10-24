import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Save } from "lucide-react";

export default function AddPiece() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    width: "",
    height: "",
    depth: "",
    material: "",
    notes: "",
  });
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let stlUrl = "";
      let imageUrl = "";

      // Upload STL file
      if (stlFile) {
        const stlPath = `${user.id}/${Date.now()}-${stlFile.name}`;
        const { error: stlError } = await supabase.storage
          .from("stl-files")
          .upload(stlPath, stlFile);

        if (stlError) throw stlError;

        const { data: stlData } = supabase.storage.from("stl-files").getPublicUrl(stlPath);
        stlUrl = stlData.publicUrl;
      }

      // Upload image file
      if (imageFile) {
        const imagePath = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: imageError } = await supabase.storage
          .from("piece-images")
          .upload(imagePath, imageFile);

        if (imageError) throw imageError;

        const { data: imageData } = supabase.storage
          .from("piece-images")
          .getPublicUrl(imagePath);
        imageUrl = imageData.publicUrl;
      }

      // Insert piece
      const { error: insertError } = await supabase.from("pieces").insert({
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        width: formData.width ? parseFloat(formData.width) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        depth: formData.depth ? parseFloat(formData.depth) : null,
        material: formData.material,
        notes: formData.notes,
        stl_url: stlUrl,
        image_url: imageUrl,
      });

      if (insertError) throw insertError;

      toast({
        title: "Peça cadastrada!",
        description: "A peça foi adicionada ao catálogo com sucesso",
      });

      navigate("/catalog");
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar peça",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle className="text-3xl">Adicionar Nova Peça</CardTitle>
            <CardDescription>
              Preencha os dados técnicos da sua impressão 3D
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da peça *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Suporte para celular"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva a peça..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Dimensões (mm)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">Largura</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.width}
                      onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Altura</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depth">Profundidade</Label>
                    <Input
                      id="depth"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.depth}
                      onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Material */}
              <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  placeholder="Ex: PLA, ABS, PETG..."
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                />
              </div>

              {/* Files */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image">Imagem da peça</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stl">Arquivo STL</Label>
                  <Input
                    id="stl"
                    type="file"
                    accept=".stl"
                    onChange={(e) => setStlFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações Técnicas</Label>
                <Textarea
                  id="notes"
                  placeholder="Impressora usada, tolerâncias, notas de impressão..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <Save className="h-4 w-4" />
                {loading ? "Salvando..." : "Salvar no GK"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
