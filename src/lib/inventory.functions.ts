import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export type InventoryItem = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: "each" | "g" | "kg" | "ml" | "l" | "portion" | "pack";
  quantity_on_hand: number;
  reorder_level: number;
  par_level: number;
  cost_per_unit_cents: number;
  allergens: string[];
  active: boolean;
  low_stock: boolean;
  stock_value_cents: number;
  recipe_uses: number;
};

export type RecipeComponent = {
  id: string;
  inventory_item_id: string;
  quantity: number;
  wastage_percent: number;
};

export type RecipeMenuItem = {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  portion_note: string | null;
  barcode: string | null;
  allergens: string[];
  recipe: RecipeComponent[];
};

export type InventoryDashboard = {
  items: InventoryItem[];
  menu_items: RecipeMenuItem[];
  recent_movements: Array<{
    id: string;
    inventory_item_id: string;
    item_name: string;
    movement_type: string;
    quantity_delta: number;
    reason: string;
    created_at: string;
  }>;
  open_stocktakes: Array<{
    id: string;
    title: string;
    status: string;
    opened_at: string;
    lines: Array<{
      inventory_item_id: string;
      item_name: string;
      unit: string;
      expected_quantity: number;
      counted_quantity: number | null;
    }>;
  }>;
};

const Unit = z.enum(["each", "g", "kg", "ml", "l", "portion", "pack"]);
const ItemPayload = z.object({
  site_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(40),
  barcode: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2).max(140),
  unit: Unit,
  quantity_on_hand: z.number().min(-1_000_000).max(1_000_000).default(0),
  reorder_level: z.number().min(0).max(1_000_000).default(0),
  par_level: z.number().min(0).max(1_000_000).default(0),
  cost_per_unit_cents: z.number().min(0).max(10_000_000).default(0),
  allergens: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  active: z.boolean().default(true),
});

export const getInventoryDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ site_id: z.string().uuid() }).parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<InventoryDashboard>(context.supabase, "cafe1_inventory_dashboard", {
      _site_id: data.site_id,
    }),
  );

export const saveInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ItemPayload.parse(value))
  .handler(({ data, context }) => {
    const { site_id, ...payload } = data;
    return callOperationsRpc<InventoryItem>(context.supabase, "cafe1_save_inventory_item", {
      _site_id: site_id,
      _payload: payload,
    });
  });

export const recordStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        inventory_item_id: z.string().uuid(),
        movement_type: z.enum([
          "purchase",
          "waste",
          "transfer_in",
          "transfer_out",
          "correction",
          "staff_meal",
        ]),
        quantity_delta: z
          .number()
          .min(-1_000_000)
          .max(1_000_000)
          .refine((n) => n !== 0),
        reason: z.string().trim().min(3).max(300),
        reference_type: z.string().max(40).optional(),
        reference_id: z.string().uuid().optional(),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<{ id: string; quantity_delta: number; quantity_on_hand: number }>(
      context.supabase,
      "cafe1_record_stock_movement",
      { _payload: data },
    ),
  );

export const saveRecipeComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        menu_item_id: z.string().uuid(),
        inventory_item_id: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        wastage_percent: z.number().min(0).max(100).default(0),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<RecipeComponent & { menu_cost_cents: number }>(
      context.supabase,
      "cafe1_save_recipe_component",
      { _payload: data },
    ),
  );

export const deleteRecipeComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ component_id: z.string().uuid() }).parse(value))
  .handler(({ data, context }) =>
    callOperationsRpc<boolean>(context.supabase, "cafe1_delete_recipe_component", {
      _component_id: data.component_id,
    }),
  );

export const startStocktake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ site_id: z.string().uuid(), title: z.string().trim().min(3).max(140) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    return callOperationsRpc<string>(context.supabase, "cafe1_start_stocktake", {
      _site_id: data.site_id,
      _title: data.title,
    });
  });

export const completeStocktake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        stocktake_id: z.string().uuid(),
        counts: z
          .array(
            z.object({
              inventory_item_id: z.string().uuid(),
              counted_quantity: z.number().min(0).max(1_000_000),
              note: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(5_000),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    return callOperationsRpc<{ stocktake_id: string; absolute_variance_value_cents: number }>(
      context.supabase,
      "cafe1_complete_stocktake",
      { _stocktake_id: data.stocktake_id, _counts: data.counts },
    );
  });
