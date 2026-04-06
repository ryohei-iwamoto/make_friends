export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: { id: number; name: string }
        Insert: { id?: number; name: string }
        Update: { id?: number; name?: string }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          employee_id: string
          department_id: number
          name: string
          training_group_id: string | null
          bio: string | null
          photo_url: string | null
          group_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          department_id: number
          name: string
          training_group_id?: string | null
          bio?: string | null
          photo_url?: string | null
          group_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          department_id?: number
          name?: string
          training_group_id?: string | null
          bio?: string | null
          photo_url?: string | null
          group_id?: number | null
          created_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: { id: number; group_number: number; color: string; created_at: string }
        Insert: { id?: number; group_number: number; color: string; created_at?: string }
        Update: { id?: number; group_number?: number; color?: string; created_at?: string }
        Relationships: []
      }
      group_photos: {
        Row: { id: string; group_id: number; photo_url: string; taken_at: string }
        Insert: { id?: string; group_id: number; photo_url: string; taken_at?: string }
        Update: { id?: string; group_id?: number; photo_url?: string; taken_at?: string }
        Relationships: []
      }
      app_settings: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { key?: string; value?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
