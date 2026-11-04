
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "appointments": {
                  Row: {
                    "barber_id": string,"barbershop_id": string,"created_at": string,"customer_id": string,"deposit_received": boolean,"ends_at": string,"id": string,"manage_token_hash": string | null,"price_cop": number,"service_id": string,"source": Database["public"]['Enums']["appointment_source"],"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"barbershop_id": string,"created_at"?: string,"customer_id": string,"deposit_received"?: boolean,"ends_at": string,"id"?: string,"manage_token_hash"?: string | null,"price_cop": number,"service_id": string,"source": Database["public"]['Enums']["appointment_source"],"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "barber_id"?: string,"barbershop_id"?: string,"created_at"?: string,"customer_id"?: string,"deposit_received"?: boolean,"ends_at"?: string,"id"?: string,"manage_token_hash"?: string | null,"price_cop"?: number,"service_id"?: string,"source"?: Database["public"]['Enums']["appointment_source"],"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_barbershop_id_barber_id_fkey"
      columns: ["barbershop_id","barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "appointments_barbershop_id_customer_id_fkey"
      columns: ["barbershop_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "appointments_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_barbershop_id_service_id_fkey"
      columns: ["barbershop_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["barbershop_id","id"]
    }
                  ]
                },"barber_schedules": {
                  Row: {
                    "barber_id": string,"barbershop_id": string,"created_at": string,"end_time": string,"id": string,"start_time": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"barbershop_id": string,"created_at"?: string,"end_time": string,"id"?: string,"start_time": string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "barber_id"?: string,"barbershop_id"?: string,"created_at"?: string,"end_time"?: string,"id"?: string,"start_time"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_schedules_barbershop_id_barber_id_fkey"
      columns: ["barbershop_id","barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["barbershop_id","id"]
    }
                  ]
                },"barber_services": {
                  Row: {
                    "barber_id": string,"barbershop_id": string,"created_at": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"barbershop_id": string,"created_at"?: string,"service_id": string
                  }
                  Update: {
                    "barber_id"?: string,"barbershop_id"?: string,"created_at"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_services_barbershop_id_barber_id_fkey"
      columns: ["barbershop_id","barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "barber_services_barbershop_id_service_id_fkey"
      columns: ["barbershop_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["barbershop_id","id"]
    }
                  ]
                },"barbers": {
                  Row: {
                    "active": boolean,"barbershop_id": string,"created_at": string,"display_name": string,"id": string,"link_active": boolean,"link_token_hash": string,"phone": string | null,"photo_path": string | null,"sort_order": number,"updated_at": string,"whatsapp_notifications": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barbershop_id": string,"created_at"?: string,"display_name": string,"id"?: string,"link_active"?: boolean,"link_token_hash": string,"phone"?: string | null,"photo_path"?: string | null,"sort_order"?: number,"updated_at"?: string,"whatsapp_notifications"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"barbershop_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"link_active"?: boolean,"link_token_hash"?: string,"phone"?: string | null,"photo_path"?: string | null,"sort_order"?: number,"updated_at"?: string,"whatsapp_notifications"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbers_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"barbershop_hours": {
                  Row: {
                    "barbershop_id": string,"created_at": string,"end_time": string,"id": string,"start_time": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"created_at"?: string,"end_time": string,"id"?: string,"start_time": string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "barbershop_id"?: string,"created_at"?: string,"end_time"?: string,"id"?: string,"start_time"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbershop_hours_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"barbershops": {
                  Row: {
                    "address": string | null,"cancellation_notice_hours": number,"cover_photo_path": string | null,"created_at": string,"deposit_account": string | null,"deposit_method": Database["public"]['Enums']["payment_method"] | null,"expires_on": string,"id": string,"latitude": number | null,"logo_path": string | null,"longitude": number | null,"min_booking_notice_minutes": number,"name": string,"plan": Database["public"]['Enums']["subscription_plan"] | null,"slug": string,"subscription_status": Database["public"]['Enums']["subscription_status"],"updated_at": string,"whatsapp_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"cancellation_notice_hours"?: number,"cover_photo_path"?: string | null,"created_at"?: string,"deposit_account"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"expires_on": string,"id"?: string,"latitude"?: number | null,"logo_path"?: string | null,"longitude"?: number | null,"min_booking_notice_minutes"?: number,"name": string,"plan"?: Database["public"]['Enums']["subscription_plan"] | null,"slug": string,"subscription_status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"cancellation_notice_hours"?: number,"cover_photo_path"?: string | null,"created_at"?: string,"deposit_account"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"expires_on"?: string,"id"?: string,"latitude"?: number | null,"logo_path"?: string | null,"longitude"?: number | null,"min_booking_notice_minutes"?: number,"name"?: string,"plan"?: Database["public"]['Enums']["subscription_plan"] | null,"slug"?: string,"subscription_status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "barbershop_id": string,"created_at": string,"full_name": string,"id": string,"notes": string | null,"phone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"created_at"?: string,"full_name": string,"id"?: string,"notes"?: string | null,"phone": string,"updated_at"?: string
                  }
                  Update: {
                    "barbershop_id"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"holiday_openings": {
                  Row: {
                    "barbershop_id": string,"created_at": string,"holiday_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"created_at"?: string,"holiday_date": string
                  }
                  Update: {
                    "barbershop_id"?: string,"created_at"?: string,"holiday_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "holiday_openings_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "appointment_id": string | null,"attempts": number,"barbershop_id": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"dedupe_key": string,"id": string,"last_error": string | null,"scheduled_for": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"type": Database["public"]['Enums']["notification_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"attempts"?: number,"barbershop_id": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"dedupe_key": string,"id"?: string,"last_error"?: string | null,"scheduled_for": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"type": Database["public"]['Enums']["notification_type"],"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"attempts"?: number,"barbershop_id"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"dedupe_key"?: string,"id"?: string,"last_error"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"type"?: Database["public"]['Enums']["notification_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_barbershop_id_appointment_id_fkey"
      columns: ["barbershop_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "notifications_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"barbershop_id": string | null,"created_at": string,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barbershop_id"?: string | null,"created_at"?: string,"full_name": string,"id": string,"phone"?: string | null,"role": Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"barbershop_id"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"barbershop_id": string,"created_at": string,"duration_minutes": number,"id": string,"name": string,"price_cop": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barbershop_id": string,"created_at"?: string,"duration_minutes": number,"id"?: string,"name": string,"price_cop": number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"barbershop_id"?: string,"created_at"?: string,"duration_minutes"?: number,"id"?: string,"name"?: string,"price_cop"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_payments": {
                  Row: {
                    "amount_cop": number,"barbershop_id": string,"billing_period": Database["public"]['Enums']["billing_period"],"covers_from": string,"covers_until": string,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"plan": Database["public"]['Enums']["subscription_plan"],"reference": string,"registered_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cop": number,"barbershop_id": string,"billing_period": Database["public"]['Enums']["billing_period"],"covers_from": string,"covers_until": string,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"plan": Database["public"]['Enums']["subscription_plan"],"reference": string,"registered_by": string
                  }
                  Update: {
                    "amount_cop"?: number,"barbershop_id"?: string,"billing_period"?: Database["public"]['Enums']["billing_period"],"covers_from"?: string,"covers_until"?: string,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"paid_on"?: string,"plan"?: Database["public"]['Enums']["subscription_plan"],"reference"?: string,"registered_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_payments_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_payments_registered_by_fkey"
      columns: ["registered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"time_blocks": {
                  Row: {
                    "barber_id": string | null,"barbershop_id": string,"created_at": string,"ends_at": string,"id": string,"reason": string | null,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id"?: string | null,"barbershop_id": string,"created_at"?: string,"ends_at": string,"id"?: string,"reason"?: string | null,"starts_at": string,"updated_at"?: string
                  }
                  Update: {
                    "barber_id"?: string | null,"barbershop_id"?: string,"created_at"?: string,"ends_at"?: string,"id"?: string,"reason"?: string | null,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_blocks_barbershop_id_barber_id_fkey"
      columns: ["barbershop_id","barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "time_blocks_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "appointment_source": "web"|"manual","appointment_status": "confirmed"|"attended"|"no_show"|"cancelled_by_customer"|"cancelled_by_barbershop","billing_period": "monthly"|"quarterly"|"annual","notification_channel": "whatsapp"|"email","notification_status": "pending"|"sent"|"failed"|"cancelled","notification_type": "appointment_confirmed"|"appointment_reminder"|"appointment_cancelled"|"appointment_rescheduled"|"barber_new_booking"|"barber_booking_cancelled"|"subscription_expiring"|"subscription_expired"|"subscription_suspended"|"subscription_payment_registered","payment_method": "bank_transfer"|"nequi"|"daviplata"|"bre_b","subscription_plan": "basic"|"pro","subscription_status": "trial"|"active"|"suspended","user_role": "owner"|"super_admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "appointment_source": ["web", "manual"],"appointment_status": ["confirmed", "attended", "no_show", "cancelled_by_customer", "cancelled_by_barbershop"],"billing_period": ["monthly", "quarterly", "annual"],"notification_channel": ["whatsapp", "email"],"notification_status": ["pending", "sent", "failed", "cancelled"],"notification_type": ["appointment_confirmed", "appointment_reminder", "appointment_cancelled", "appointment_rescheduled", "barber_new_booking", "barber_booking_cancelled", "subscription_expiring", "subscription_expired", "subscription_suspended", "subscription_payment_registered"],"payment_method": ["bank_transfer", "nequi", "daviplata", "bre_b"],"subscription_plan": ["basic", "pro"],"subscription_status": ["trial", "active", "suspended"],"user_role": ["owner", "super_admin"]
          }
        }
} as const
