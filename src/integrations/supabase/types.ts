export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          email: string
          encrypted_password: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          encrypted_password: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          encrypted_password?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calculation_presets: {
        Row: {
          created_at: string
          custo_acessorios: number
          custo_fixo_mes: number | null
          custo_kwh: number
          id: string
          imposto: number | null
          markup: number
          percentual_falhas: number
          potencia_impressora_w: number
          preset_name: string
          taxa_pagamento: number
          unidades_mes: number | null
          updated_at: string
          user_id: string
          valor_impressora: number
          vida_util_horas: number
        }
        Insert: {
          created_at?: string
          custo_acessorios?: number
          custo_fixo_mes?: number | null
          custo_kwh?: number
          id?: string
          imposto?: number | null
          markup?: number
          percentual_falhas?: number
          potencia_impressora_w?: number
          preset_name: string
          taxa_pagamento?: number
          unidades_mes?: number | null
          updated_at?: string
          user_id: string
          valor_impressora?: number
          vida_util_horas?: number
        }
        Update: {
          created_at?: string
          custo_acessorios?: number
          custo_fixo_mes?: number | null
          custo_kwh?: number
          id?: string
          imposto?: number | null
          markup?: number
          percentual_falhas?: number
          potencia_impressora_w?: number
          preset_name?: string
          taxa_pagamento?: number
          unidades_mes?: number | null
          updated_at?: string
          user_id?: string
          valor_impressora?: number
          vida_util_horas?: number
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      mining_products: {
        Row: {
          acquisition_date: string
          added_by: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_selling: boolean | null
          makerworld_checked: string | null
          makerworld_status: string | null
          makerworld_url: string | null
          name: string
          notes: string | null
          quantity: number
          source_url: string | null
          stl_url: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_date?: string
          added_by?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_selling?: boolean | null
          makerworld_checked?: string | null
          makerworld_status?: string | null
          makerworld_url?: string | null
          name: string
          notes?: string | null
          quantity?: number
          source_url?: string | null
          stl_url?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_date?: string
          added_by?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_selling?: boolean | null
          makerworld_checked?: string | null
          makerworld_status?: string | null
          makerworld_url?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          source_url?: string | null
          stl_url?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_printed: boolean
          notes: string | null
          piece_id: string
          printed_at: string | null
          printed_by: string | null
          quantity: number
          updated_at: string
          user_id: string
          variation_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_printed?: boolean
          notes?: string | null
          piece_id: string
          printed_at?: string | null
          printed_by?: string | null
          quantity?: number
          updated_at?: string
          user_id: string
          variation_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_printed?: boolean
          notes?: string | null
          piece_id?: string
          printed_at?: string | null
          printed_by?: string | null
          quantity?: number
          updated_at?: string
          user_id?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "piece_price_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_price_variations: {
        Row: {
          calculated_cost: number
          calculated_price: number
          created_at: string
          custo_kg_filamento: number
          id: string
          peso_g: number | null
          piece_id: string
          tempo_impressao_min: number | null
          updated_at: string
          user_id: string
          variation_name: string
        }
        Insert: {
          calculated_cost: number
          calculated_price: number
          created_at?: string
          custo_kg_filamento: number
          id?: string
          peso_g?: number | null
          piece_id: string
          tempo_impressao_min?: number | null
          updated_at?: string
          user_id: string
          variation_name: string
        }
        Update: {
          calculated_cost?: number
          calculated_price?: number
          created_at?: string
          custo_kg_filamento?: number
          id?: string
          peso_g?: number | null
          piece_id?: string
          tempo_impressao_min?: number | null
          updated_at?: string
          user_id?: string
          variation_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_price_variations_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          custo_acessorios: number | null
          custo_energia: number | null
          custo_material: number | null
          depth: number | null
          description: string | null
          height: number | null
          id: string
          image_url: string | null
          is_selling: boolean | null
          lucro_liquido: number | null
          makerworld_url: string | null
          material: string | null
          name: string
          notes: string | null
          peso_g: number | null
          preco_venda: number | null
          print_status: string | null
          stl_url: string | null
          tempo_impressao_min: number | null
          user_id: string
          width: number | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          custo_acessorios?: number | null
          custo_energia?: number | null
          custo_material?: number | null
          depth?: number | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_selling?: boolean | null
          lucro_liquido?: number | null
          makerworld_url?: string | null
          material?: string | null
          name: string
          notes?: string | null
          peso_g?: number | null
          preco_venda?: number | null
          print_status?: string | null
          stl_url?: string | null
          tempo_impressao_min?: number | null
          user_id: string
          width?: number | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          custo_acessorios?: number | null
          custo_energia?: number | null
          custo_material?: number | null
          depth?: number | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_selling?: boolean | null
          lucro_liquido?: number | null
          makerworld_url?: string | null
          material?: string | null
          name?: string
          notes?: string | null
          peso_g?: number | null
          preco_venda?: number | null
          print_status?: string | null
          stl_url?: string | null
          tempo_impressao_min?: number | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      print_history: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          id: string
          material_amount_used: number | null
          material_id: string | null
          notes: string | null
          piece_id: string
          printed_at: string | null
          printer_used: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          material_amount_used?: number | null
          material_id?: string | null
          notes?: string | null
          piece_id: string
          printed_at?: string | null
          printer_used?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          material_amount_used?: number | null
          material_id?: string | null
          notes?: string | null
          piece_id?: string
          printed_at?: string | null
          printer_used?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_history_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "mining_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_history_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
