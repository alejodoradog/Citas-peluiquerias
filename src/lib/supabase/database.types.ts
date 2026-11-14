
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
            "appointment_events": {
                  Row: {
                    "actor": Database["public"]['Enums']["event_actor"],"actor_user_id": string | null,"appointment_id": string,"barbershop_id": string,"created_at": string,"id": number,"new_barber_id": string | null,"new_ends_at": string | null,"new_starts_at": string | null,"new_status": Database["public"]['Enums']["appointment_status"] | null,"old_barber_id": string | null,"old_ends_at": string | null,"old_starts_at": string | null,"old_status": Database["public"]['Enums']["appointment_status"] | null,"service_id": string | null,"type": Database["public"]['Enums']["appointment_event_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": Database["public"]['Enums']["event_actor"],"actor_user_id"?: string | null,"appointment_id": string,"barbershop_id": string,"created_at"?: string,"id"?: never,"new_barber_id"?: string | null,"new_ends_at"?: string | null,"new_starts_at"?: string | null,"new_status"?: Database["public"]['Enums']["appointment_status"] | null,"old_barber_id"?: string | null,"old_ends_at"?: string | null,"old_starts_at"?: string | null,"old_status"?: Database["public"]['Enums']["appointment_status"] | null,"service_id"?: string | null,"type": Database["public"]['Enums']["appointment_event_type"]
                  }
                  Update: {
                    "actor"?: Database["public"]['Enums']["event_actor"],"actor_user_id"?: string | null,"appointment_id"?: string,"barbershop_id"?: string,"created_at"?: string,"id"?: never,"new_barber_id"?: string | null,"new_ends_at"?: string | null,"new_starts_at"?: string | null,"new_status"?: Database["public"]['Enums']["appointment_status"] | null,"old_barber_id"?: string | null,"old_ends_at"?: string | null,"old_starts_at"?: string | null,"old_status"?: Database["public"]['Enums']["appointment_status"] | null,"service_id"?: string | null,"type"?: Database["public"]['Enums']["appointment_event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_events_actor_user_id_fkey"
      columns: ["actor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_events_barbershop_id_appointment_id_fkey"
      columns: ["barbershop_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["barbershop_id","id"]
    }
                  ]
                },"appointment_services": {
                  Row: {
                    "appointment_id": string,"barbershop_id": string,"created_at": string,"duration_minutes": number,"position": number,"price_cop": number,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"barbershop_id"?: string,"created_at"?: string,"duration_minutes": number,"position": number,"price_cop": number,"service_id": string
                  }
                  Update: {
                    "appointment_id"?: string,"barbershop_id"?: string,"created_at"?: string,"duration_minutes"?: number,"position"?: number,"price_cop"?: number,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_services_barbershop_id_appointment_id_fkey"
      columns: ["barbershop_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["barbershop_id","id"]
    },{
      foreignKeyName: "appointment_services_barbershop_id_service_id_fkey"
      columns: ["barbershop_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["barbershop_id","id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "barber_id": string,"barbershop_id": string,"created_at": string,"customer_id": string,"deposit_received": boolean,"ends_at": string,"id": string,"manage_token_hash": string | null,"price_cop": number,"source": Database["public"]['Enums']["appointment_source"],"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"barbershop_id"?: string,"created_at"?: string,"customer_id": string,"deposit_received"?: boolean,"ends_at": string,"id"?: string,"manage_token_hash"?: string | null,"price_cop": number,"source": Database["public"]['Enums']["appointment_source"],"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "barber_id"?: string,"barbershop_id"?: string,"created_at"?: string,"customer_id"?: string,"deposit_received"?: boolean,"ends_at"?: string,"id"?: string,"manage_token_hash"?: string | null,"price_cop"?: number,"source"?: Database["public"]['Enums']["appointment_source"],"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
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
    }
                  ]
                },"barber_schedules": {
                  Row: {
                    "barber_id": string,"barbershop_id": string,"created_at": string,"end_time": string,"id": string,"start_time": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"barbershop_id"?: string,"created_at"?: string,"end_time": string,"id"?: string,"start_time": string,"updated_at"?: string,"weekday": number
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
                    "barber_id": string,"barbershop_id"?: string,"created_at"?: string,"service_id": string
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
                    "active": boolean,"barbershop_id": string,"created_at": string,"deactivated_at": string | null,"display_name": string,"email": string | null,"email_notifications": boolean,"id": string,"is_owner": boolean,"link_active": boolean,"link_issued_at": string | null,"link_token_hash": string,"photo_path": string | null,"sort_order": number,"updated_at": string,"uses_barbershop_hours": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barbershop_id"?: string,"created_at"?: string,"deactivated_at"?: string | null,"display_name": string,"email"?: string | null,"email_notifications"?: boolean,"id"?: string,"is_owner"?: boolean,"link_active"?: boolean,"link_issued_at"?: string | null,"link_token_hash": string,"photo_path"?: string | null,"sort_order"?: number,"updated_at"?: string,"uses_barbershop_hours"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"barbershop_id"?: string,"created_at"?: string,"deactivated_at"?: string | null,"display_name"?: string,"email"?: string | null,"email_notifications"?: boolean,"id"?: string,"is_owner"?: boolean,"link_active"?: boolean,"link_issued_at"?: string | null,"link_token_hash"?: string,"photo_path"?: string | null,"sort_order"?: number,"updated_at"?: string,"uses_barbershop_hours"?: boolean
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
                    "barbershop_id"?: string,"created_at"?: string,"end_time": string,"id"?: string,"start_time": string,"updated_at"?: string,"weekday": number
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
                },"barbershop_slug_changes": {
                  Row: {
                    "barbershop_id": string,"changed_at": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"changed_at"?: string,"id"?: never
                  }
                  Update: {
                    "barbershop_id"?: string,"changed_at"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbershop_slug_changes_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"barbershop_slug_history": {
                  Row: {
                    "barbershop_id": string,"retired_at": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"retired_at"?: string,"slug": string
                  }
                  Update: {
                    "barbershop_id"?: string,"retired_at"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbershop_slug_history_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    }
                  ]
                },"barbershops": {
                  Row: {
                    "address": string | null,"cancellation_notice_hours": number,"cover_photo_path": string | null,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"deposit_account": string | null,"deposit_method": Database["public"]['Enums']["payment_method"] | null,"expires_on": string,"id": string,"latitude": number | null,"locality": string | null,"logo_path": string | null,"longitude": number | null,"min_booking_notice_minutes": number,"name": string,"plan": string | null,"setup_completed_at": string | null,"slug": string,"subscription_status": Database["public"]['Enums']["subscription_status"],"trial_ends_on": string,"updated_at": string,"whatsapp_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"cancellation_notice_hours"?: number,"cover_photo_path"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"deposit_account"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"expires_on": string,"id"?: string,"latitude"?: number | null,"locality"?: string | null,"logo_path"?: string | null,"longitude"?: number | null,"min_booking_notice_minutes"?: number,"name": string,"plan"?: string | null,"setup_completed_at"?: string | null,"slug": string,"subscription_status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_on": string,"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"cancellation_notice_hours"?: number,"cover_photo_path"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"deposit_account"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"expires_on"?: string,"id"?: string,"latitude"?: number | null,"locality"?: string | null,"logo_path"?: string | null,"longitude"?: number | null,"min_booking_notice_minutes"?: number,"name"?: string,"plan"?: string | null,"setup_completed_at"?: string | null,"slug"?: string,"subscription_status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_on"?: string,"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbershops_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"customers": {
                  Row: {
                    "anonymized_at": string | null,"barbershop_id": string,"created_at": string,"email": string | null,"full_name": string,"id": string,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"barbershop_id"?: string,"created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "anonymized_at"?: string | null,"barbershop_id"?: string,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
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
                    "barbershop_id"?: string,"created_at"?: string,"holiday_date": string
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
                },"memberships": {
                  Row: {
                    "barbershop_id": string,"created_at": string,"role": Database["public"]['Enums']["membership_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbershop_id": string,"created_at"?: string,"role": Database["public"]['Enums']["membership_role"],"user_id": string
                  }
                  Update: {
                    "barbershop_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["membership_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "appointment_id": string | null,"attempts": number,"barbershop_id": string,"created_at": string,"dedupe_key": string,"id": string,"last_error": string | null,"scheduled_for": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"type": Database["public"]['Enums']["notification_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"attempts"?: number,"barbershop_id": string,"created_at"?: string,"dedupe_key": string,"id"?: string,"last_error"?: string | null,"scheduled_for": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"type": Database["public"]['Enums']["notification_type"],"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"attempts"?: number,"barbershop_id"?: string,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"last_error"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"type"?: Database["public"]['Enums']["notification_type"],"updated_at"?: string
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
                },"plans": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"included_barbers": number,"monthly_price_cop": number,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"included_barbers": number,"monthly_price_cop": number,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"included_barbers"?: number,"monthly_price_cop"?: number,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"full_name": string,"id": string,"is_super_admin": boolean,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"full_name": string,"id": string,"is_super_admin"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"is_super_admin"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"barbershop_id": string,"created_at": string,"duration_minutes": number,"id": string,"name": string,"price_cop": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barbershop_id"?: string,"created_at"?: string,"duration_minutes": number,"id"?: string,"name": string,"price_cop": number,"updated_at"?: string
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
                    "amount_cop": number,"barbershop_id": string,"covers_from": string,"covers_until": string,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"plan": string,"reference": string,"registered_by": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cop": number,"barbershop_id": string,"covers_from": string,"covers_until": string,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"paid_on": string,"plan": string,"reference": string,"registered_by": string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_cop"?: number,"barbershop_id"?: string,"covers_from"?: string,"covers_until"?: string,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"paid_on"?: string,"plan"?: string,"reference"?: string,"registered_by"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_payments_barbershop_id_fkey"
      columns: ["barbershop_id"]
isOneToOne: false
      referencedRelation: "barbershops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_payments_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "subscription_payments_registered_by_fkey"
      columns: ["registered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_payments_voided_by_fkey"
      columns: ["voided_by"]
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
                    "barber_id"?: string | null,"barbershop_id"?: string,"created_at"?: string,"ends_at": string,"id"?: string,"reason"?: string | null,"starts_at": string,"updated_at"?: string
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
            "anonymize_customer":
{ Args: { "p_barbershop_id": string,"p_customer_id": string }; Returns: undefined
                           },
"barber_agenda":
{ Args: { "p_from": string,"p_to": string,"p_token_hash": string }; Returns: Json
                           },
"barber_appointment":
{ Args: { "p_appointment_id": string,"p_token_hash": string }; Returns: {
              "created_at": string,"customer_name": string,"ends_at": string,"id": string,"no_shows": number,"service_minutes": (number)[],"service_names": (string)[],"source": Database["public"]['Enums']["appointment_source"],"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"visits": number,"writable": boolean
            }[]
                           },
"barbershop_accepts_bookings":
{ Args: { "p_barbershop_id": string }; Returns: boolean
                           },
"book_appointment":
{ Args: { "p_barber_id"?: string,"p_barbershop_id": string,"p_customer_email": string,"p_customer_name": string,"p_customer_phone"?: string,"p_manage_token_hash": string,"p_service_ids": (string)[],"p_starts_at": string }; Returns: {
              "appointment_id": string,"barber_id": string
            }[]
                           },
"book_appointment_from_app":
{ Args: { "p_barber_id"?: string,"p_barbershop_id": string,"p_client_ip_hash"?: string,"p_customer_email": string,"p_customer_name": string,"p_customer_phone"?: string,"p_manage_token_hash": string,"p_service_ids": (string)[],"p_starts_at": string }; Returns: {
              "appointment_id": string,"barber_id": string
            }[]
                           },
"booking_busy_ranges":
{ Args: { "p_barbershop_id": string,"p_from": string,"p_until": string }; Returns: {
              "barber_id": string,"ends_at": string,"starts_at": string
            }[]
                           },
"cancel_appointment_by_token":
{ Args: { "p_token_hash": string }; Returns: undefined
                           },
"change_appointment_services":
{ Args: { "p_appointment_id": string,"p_service_ids": (string)[] }; Returns: undefined
                           },
"change_appointment_services_checked":
{ Args: { "p_appointment_id": string,"p_service_ids": (string)[] }; Returns: undefined
                           },
"complete_barbershop_setup":
{ Args: { "p_barbers": Json,"p_barbershop_id": string,"p_hours": Json,"p_services": Json }; Returns: undefined
                           },
"create_appointment":
{ Args: { "p_barber_id": string,"p_barbershop_id": string,"p_customer_id": string,"p_manage_token_hash"?: string,"p_service_ids": (string)[],"p_source"?: Database["public"]['Enums']["appointment_source"],"p_starts_at": string }; Returns: string
                           },
"create_barbershop":
{ Args: { "p_name": string,"p_request_id"?: string,"p_slug": string,"p_whatsapp_phone"?: string }; Returns: string
                           },
"create_manual_appointment":
{ Args: { "p_barber_id": string,"p_barbershop_id": string,"p_customer_email"?: string,"p_customer_id"?: string,"p_customer_name"?: string,"p_customer_phone"?: string,"p_service_ids": (string)[],"p_starts_at": string }; Returns: string
                           },
"create_time_block":
{ Args: { "p_barber_id": string,"p_barbershop_id": string,"p_ends_at": string,"p_reason"?: string,"p_starts_at": string }; Returns: string
                           },
"create_time_block_by_barber":
{ Args: { "p_ends_at": string,"p_reason"?: string,"p_starts_at": string,"p_token_hash": string }; Returns: string
                           },
"delete_barbershop":
{ Args: { "p_barbershop_id": string }; Returns: undefined
                           },
"delete_time_block":
{ Args: { "p_block_id": string }; Returns: undefined
                           },
"delete_time_block_by_barber":
{ Args: { "p_block_id": string,"p_token_hash": string }; Returns: undefined
                           },
"extend_trial":
{ Args: { "p_barbershop_id": string,"p_until": string }; Returns: undefined
                           },
"list_customers":
{ Args: { "p_barbershop_id": string,"p_filter"?: string,"p_limit"?: number,"p_search"?: string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string,"last_visit_at": string,"next_appointment_at": string,"no_shows": number,"phone": string,"visits": number
            }[]
                           },
"managed_appointment":
{ Args: { "p_token_hash": string }; Returns: {
              "barber_id": string,"barber_name": string,"barbershop_id": string,"cancellation_notice_hours": number,"changeable": boolean,"customer_first_name": string,"ends_at": string,"price_cop": number,"service_names": (string)[],"slug": string,"starts_at": string
            }[]
                           },
"mark_appointment_by_barber":
{ Args: { "p_appointment_id": string,"p_status": Database["public"]['Enums']["appointment_status"],"p_token_hash": string }; Returns: undefined
                           },
"platform_barbershops":
{ Args: { "p_search"?: string }; Returns: {
              "created_at": string,"expires_on": string,"id": string,"locality": string,"name": string,"owner_email": string,"owner_name": string,"owner_phone": string,"phase": string,"plan": string,"slug": string,"subscription_status": Database["public"]['Enums']["subscription_status"],"trial_ends_on": string
            }[]
                           },
"reactivate_barbershop":
{ Args: { "p_barbershop_id": string }; Returns: undefined
                           },
"register_subscription_payment":
{ Args: { "p_barbershop_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_paid_on"?: string,"p_plan": string,"p_reference": string }; Returns: {
              "amount_cop": number,
"barbershop_id": string,
"covers_from": string,
"covers_until": string,
"created_at": string,
"id": string,
"method": Database["public"]['Enums']["payment_method"],
"paid_on": string,
"plan": string,
"reference": string,
"registered_by": string,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "subscription_payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"reschedule_appointment":
{ Args: { "p_appointment_id": string,"p_barber_id": string,"p_starts_at": string }; Returns: undefined
                           },
"reschedule_appointment_by_token":
{ Args: { "p_starts_at": string,"p_token_hash": string }; Returns: undefined
                           },
"reserve_image_upload":
{ Args: { "p_path": string }; Returns: undefined
                           },
"set_appointment_status":
{ Args: { "p_appointment_id": string,"p_status": Database["public"]['Enums']["appointment_status"] }; Returns: undefined
                           },
"set_barber_schedule":
{ Args: { "p_barber_id": string,"p_shifts"?: Json,"p_uses_barbershop_hours": boolean }; Returns: undefined
                           },
"set_barber_services":
{ Args: { "p_barber_id": string,"p_service_ids": (string)[] }; Returns: undefined
                           },
"set_barbershop_hours":
{ Args: { "p_barbershop_id": string,"p_shifts": Json }; Returns: undefined
                           },
"set_holiday_openings":
{ Args: { "p_barbershop_id": string,"p_dates": (string)[],"p_from": string,"p_until": string }; Returns: undefined
                           },
"set_service_barbers":
{ Args: { "p_barber_ids": (string)[],"p_service_id": string }; Returns: undefined
                           },
"suspend_barbershop":
{ Args: { "p_barbershop_id": string }; Returns: undefined
                           },
"void_subscription_payment":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: {
              "amount_cop": number,
"barbershop_id": string,
"covers_from": string,
"covers_until": string,
"created_at": string,
"id": string,
"method": Database["public"]['Enums']["payment_method"],
"paid_on": string,
"plan": string,
"reference": string,
"registered_by": string,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "subscription_payments"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "appointment_event_type": "status_changed"|"rescheduled"|"service_added"|"service_removed","appointment_source": "web"|"manual","appointment_status": "confirmed"|"attended"|"no_show"|"cancelled_by_customer"|"cancelled_by_barbershop","event_actor": "staff"|"customer"|"barber"|"system","membership_role": "owner","notification_status": "pending"|"sent"|"failed"|"cancelled","notification_type": "appointment_confirmed"|"appointment_reminder"|"appointment_cancelled"|"appointment_rescheduled"|"barber_new_booking"|"barber_booking_cancelled"|"subscription_expiring"|"subscription_expired"|"subscription_suspended"|"subscription_payment_registered","payment_method": "bank_transfer"|"nequi"|"daviplata"|"bre_b","subscription_status": "trial"|"active"|"suspended"
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
            "appointment_event_type": ["status_changed", "rescheduled", "service_added", "service_removed"],"appointment_source": ["web", "manual"],"appointment_status": ["confirmed", "attended", "no_show", "cancelled_by_customer", "cancelled_by_barbershop"],"event_actor": ["staff", "customer", "barber", "system"],"membership_role": ["owner"],"notification_status": ["pending", "sent", "failed", "cancelled"],"notification_type": ["appointment_confirmed", "appointment_reminder", "appointment_cancelled", "appointment_rescheduled", "barber_new_booking", "barber_booking_cancelled", "subscription_expiring", "subscription_expired", "subscription_suspended", "subscription_payment_registered"],"payment_method": ["bank_transfer", "nequi", "daviplata", "bre_b"],"subscription_status": ["trial", "active", "suspended"]
          }
        }
} as const
