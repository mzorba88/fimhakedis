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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          description: string
          details: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          timestamp: string
          type: string
          user_role: string
        }
        Insert: {
          description: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string
          type: string
          user_role: string
        }
        Update: {
          description?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string
          type?: string
          user_role?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          approval_date: string | null
          approval_status: string
          approved_by: string | null
          contract_file: string | null
          contract_no: string
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          date: string
          description: string | null
          id: string
          paid_date: string | null
          payment_plan: Json | null
          payment_status: string
          project_id: string
          rejection_reason: string | null
          subcontractor: string
          total_amount: number
          updated_at: string
          vat_rate: number | null
          work_category: string
          work_item_entries: Json | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string
          approved_by?: string | null
          contract_file?: string | null
          contract_no: string
          contract_type: string
          created_at?: string
          created_by: string
          currency?: string
          date: string
          description?: string | null
          id?: string
          paid_date?: string | null
          payment_plan?: Json | null
          payment_status?: string
          project_id: string
          rejection_reason?: string | null
          subcontractor: string
          total_amount?: number
          updated_at?: string
          vat_rate?: number | null
          work_category: string
          work_item_entries?: Json | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string
          approved_by?: string | null
          contract_file?: string | null
          contract_no?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          date?: string
          description?: string | null
          id?: string
          paid_date?: string | null
          payment_plan?: Json | null
          payment_status?: string
          project_id?: string
          rejection_reason?: string | null
          subcontractor?: string
          total_amount?: number
          updated_at?: string
          vat_rate?: number | null
          work_category?: string
          work_item_entries?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      counters: {
        Row: {
          id: string
          value: number
        }
        Insert: {
          id: string
          value?: number
        }
        Update: {
          id?: string
          value?: number
        }
        Relationships: []
      }
      hakedisler: {
        Row: {
          approval_date: string | null
          approval_status: string
          approved_by: string | null
          contract_exceeded_note: string | null
          contract_id: string
          contract_no: string
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          date: string
          description: string | null
          extra_items: Json | null
          hakedis_items: Json | null
          hakedis_no: string
          id: string
          paid_amount: number | null
          paid_date: string | null
          payment_amount: number | null
          payment_status: string
          project_id: string
          rejection_reason: string | null
          subcontractor: string
          total_amount: number
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string
          approved_by?: string | null
          contract_exceeded_note?: string | null
          contract_id: string
          contract_no: string
          contract_type: string
          created_at?: string
          created_by: string
          currency?: string
          date: string
          description?: string | null
          extra_items?: Json | null
          hakedis_items?: Json | null
          hakedis_no: string
          id?: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_amount?: number | null
          payment_status?: string
          project_id: string
          rejection_reason?: string | null
          subcontractor: string
          total_amount?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string
          approved_by?: string | null
          contract_exceeded_note?: string | null
          contract_id?: string
          contract_no?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          date?: string
          description?: string | null
          extra_items?: Json | null
          hakedis_items?: Json | null
          hakedis_no?: string
          id?: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_amount?: number | null
          payment_status?: string
          project_id?: string
          rejection_reason?: string | null
          subcontractor?: string
          total_amount?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hakedisler_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hakedisler_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          location: string
          project_code: string
          project_name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location: string
          project_code: string
          project_name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          project_code?: string
          project_name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcontractors: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
