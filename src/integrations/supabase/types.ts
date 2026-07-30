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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_payments: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          id: string
          method: string
          note: string | null
          recorded_by: string | null
          reference: string | null
          settled_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          recorded_by?: string | null
          reference?: string | null
          settled_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          recorded_by?: string | null
          reference?: string | null
          settled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          access_code: string
          active: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          credit_limit_cents: number | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          access_code: string
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_limit_cents?: number | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_limit_cents?: number | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bank_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          body_md: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body_md?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body_md?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          active: boolean
          body: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string
          closed: boolean
          day_of_week: number
          id: string
          open_time: string
        }
        Insert: {
          close_time?: string
          closed?: boolean
          day_of_week: number
          id?: string
          open_time?: string
        }
        Update: {
          close_time?: string
          closed?: boolean
          day_of_week?: number
          id?: string
          open_time?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          accepting_orders: boolean
          allow_preorder_when_closed: boolean
          closed_message: string | null
          delivery_close_time: string
          delivery_fee_cents: number
          delivery_minutes: number
          delivery_open_time: string
          delivery_origin_postcode: string
          delivery_radius_m: number
          free_delivery_threshold_cents: number | null
          id: string
          min_order_cents: number
          name: string
          prep_minutes: number
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          allow_preorder_when_closed?: boolean
          closed_message?: string | null
          delivery_close_time?: string
          delivery_fee_cents?: number
          delivery_minutes?: number
          delivery_open_time?: string
          delivery_origin_postcode?: string
          delivery_radius_m?: number
          free_delivery_threshold_cents?: number | null
          id?: string
          min_order_cents?: number
          name?: string
          prep_minutes?: number
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          allow_preorder_when_closed?: boolean
          closed_message?: string | null
          delivery_close_time?: string
          delivery_fee_cents?: number
          delivery_minutes?: number
          delivery_open_time?: string
          delivery_origin_postcode?: string
          delivery_radius_m?: number
          free_delivery_threshold_cents?: number | null
          id?: string
          min_order_cents?: number
          name?: string
          prep_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      code_attempts: {
        Row: {
          created_at: string
          id: string
          ident: string
          kind: string
          ok: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          ident: string
          kind: string
          ok?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          ident?: string
          kind?: string
          ok?: boolean
        }
        Relationships: []
      }
      customer_discounts: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          label: string | null
          percent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          label?: string | null
          percent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          label?: string | null
          percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          order_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          order_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          order_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          group_label: string | null
          id: string
          image_url: string | null
          is_veg: boolean
          loyalty_drink: boolean
          name: string
          needs_cooking: boolean
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          group_label?: string | null
          id?: string
          image_url?: string | null
          is_veg?: boolean
          loyalty_drink?: boolean
          name: string
          needs_cooking?: boolean
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          group_label?: string | null
          id?: string
          image_url?: string | null
          is_veg?: boolean
          loyalty_drink?: boolean
          name?: string
          needs_cooking?: boolean
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifiers: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          group_name: string | null
          group_type: string
          id: string
          item_id: string | null
          name: string
          price_cents: number
          required: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          group_name?: string | null
          group_type?: string
          id?: string
          item_id?: string | null
          name: string
          price_cents?: number
          required?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          group_name?: string | null
          group_type?: string
          id?: string
          item_id?: string | null
          name?: string
          price_cents?: number
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifiers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          notes: string | null
          order_id: string
          qty: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          notes?: string | null
          order_id: string
          qty: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          notes?: string | null
          order_id?: string
          qty?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_name: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          deliveroo_order_id: string | null
          delivery_fee_cents: number
          delivery_notes: string | null
          discount_cents: number
          driver_id: string | null
          guest_token: string
          id: string
          loyalty_awarded: boolean
          loyalty_stamps_pending: number
          order_number: number
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          points_earned: number
          pos_terminal: string | null
          postcode: string | null
          promo_code: string | null
          promo_discount_cents: number
          ready_at: string | null
          schedule_mode: string
          scheduled_for: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          sumup_checkout_id: string | null
          sumup_order_ref: string | null
          sumup_reference: string | null
          sumup_transaction_id: string | null
          table_number: string | null
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
          voucher_cents: number
          voucher_holder_id: string | null
        }
        Insert: {
          account_id?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          deliveroo_order_id?: string | null
          delivery_fee_cents?: number
          delivery_notes?: string | null
          discount_cents?: number
          driver_id?: string | null
          guest_token?: string
          id?: string
          loyalty_awarded?: boolean
          loyalty_stamps_pending?: number
          order_number?: number
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          points_earned?: number
          pos_terminal?: string | null
          postcode?: string | null
          promo_code?: string | null
          promo_discount_cents?: number
          ready_at?: string | null
          schedule_mode?: string
          scheduled_for?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          sumup_checkout_id?: string | null
          sumup_order_ref?: string | null
          sumup_reference?: string | null
          sumup_transaction_id?: string | null
          table_number?: string | null
          total_cents?: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          voucher_cents?: number
          voucher_holder_id?: string | null
        }
        Update: {
          account_id?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          deliveroo_order_id?: string | null
          delivery_fee_cents?: number
          delivery_notes?: string | null
          discount_cents?: number
          driver_id?: string | null
          guest_token?: string
          id?: string
          loyalty_awarded?: boolean
          loyalty_stamps_pending?: number
          order_number?: number
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          points_earned?: number
          pos_terminal?: string | null
          postcode?: string | null
          promo_code?: string | null
          promo_discount_cents?: number
          ready_at?: string | null
          schedule_mode?: string
          scheduled_for?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          sumup_checkout_id?: string | null
          sumup_order_ref?: string | null
          sumup_reference?: string | null
          sumup_transaction_id?: string | null
          table_number?: string | null
          total_cents?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          voucher_cents?: number
          voucher_holder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_holder_id_fkey"
            columns: ["voucher_holder_id"]
            isOneToOne: false
            referencedRelation: "voucher_holders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_devices: {
        Row: {
          active: boolean
          created_at: string
          device_ref: string
          id: string
          name: string
          side: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_ref: string
          id?: string
          name: string
          side: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_ref?: string
          id?: string
          name?: string
          side?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          drink_stamps: number
          email: string | null
          free_drinks_available: number
          free_drinks_redeemed: number
          full_name: string | null
          id: string
          lifetime_points: number
          loyalty_points: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          drink_stamps?: number
          email?: string | null
          free_drinks_available?: number
          free_drinks_redeemed?: number
          full_name?: string | null
          id: string
          lifetime_points?: number
          loyalty_points?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          drink_stamps?: number
          email?: string | null
          free_drinks_available?: number
          free_drinks_redeemed?: number
          full_name?: string | null
          id?: string
          lifetime_points?: number
          loyalty_points?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          active: boolean
          badge: string | null
          bg_color: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          active?: boolean
          badge?: string | null
          bg_color?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          active?: boolean
          badge?: string | null
          bg_color?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          applies_to: string
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          expires_at: string | null
          first_order_only: boolean
          id: string
          max_uses: number | null
          min_subtotal_cents: number
          starts_at: string | null
          uses: number
        }
        Insert: {
          active?: boolean
          applies_to?: string
          code: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          max_uses?: number | null
          min_subtotal_cents?: number
          starts_at?: string | null
          uses?: number
        }
        Update: {
          active?: boolean
          applies_to?: string
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          max_uses?: number | null
          min_subtotal_cents?: number
          starts_at?: string | null
          uses?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          for_date: string
          holder_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          for_date?: string
          holder_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          for_date?: string
          holder_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_allocations_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "voucher_holders"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_holders: {
        Row: {
          active: boolean
          code: string
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      voucher_redemptions: {
        Row: {
          allocation_id: string | null
          amount_cents: number
          created_at: string
          for_date: string
          holder_id: string
          id: string
          order_id: string | null
        }
        Insert: {
          allocation_id?: string | null
          amount_cents: number
          created_at?: string
          for_date?: string
          holder_id: string
          id?: string
          order_id?: string | null
        }
        Update: {
          allocation_id?: string | null
          amount_cents?: number
          created_at?: string
          for_date?: string
          holder_id?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "voucher_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "voucher_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_promo_use: { Args: { _code: string }; Returns: boolean }
      get_customer_discount: {
        Args: { _email: string }
        Returns: {
          label: string
          percent: number
        }[]
      }
      get_voucher_balance: {
        Args: { _email: string; _phone: string }
        Returns: {
          allocated_cents: number
          holder_id: string
          holder_name: string
          remaining_cents: number
          used_cents: number
        }[]
      }
      get_voucher_balance_by_code: {
        Args: { _code: string }
        Returns: {
          allocated_cents: number
          code: string
          holder_id: string
          holder_name: string
          remaining_cents: number
          used_cents: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_use: { Args: { _code: string }; Returns: undefined }
      redeem_voucher: {
        Args: { _amount_cents: number; _holder_id: string; _order_id: string }
        Returns: number
      }
      validate_promo_code: {
        Args: {
          _code: string
          _email?: string
          _order_type: string
          _subtotal_cents: number
        }
        Returns: {
          code: string
          discount_cents: number
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          message: string
          valid: boolean
        }[]
      }
      verify_account_code: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "driver" | "customer"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
      order_type: "delivery" | "collection" | "dine_in"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "on_account"
      promo_discount_type: "percent" | "fixed_amount" | "free_delivery"
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
      app_role: ["admin", "staff", "driver", "customer"],
      order_status: [
        "pending_payment",
        "paid",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
      ],
      order_type: ["delivery", "collection", "dine_in"],
      payment_status: ["pending", "paid", "failed", "refunded", "on_account"],
      promo_discount_type: ["percent", "fixed_amount", "free_delivery"],
    },
  },
} as const
