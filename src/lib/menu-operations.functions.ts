import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireStaffSiteAccess } from "./staff-site-access.server";

export type StaffMenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

/**
 * Returns operational menu fields to staff without granting every authenticated
 * customer direct SELECT access to cost, barcode and KDS routing columns.
 */
export const getStaffMenuItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ site_id: z.string().uuid().optional() }).default({}).parse(value),
  )
  .handler(async ({ context, data }) => {
    const access = await requireStaffSiteAccess(context, data.site_id);
    const effectiveSiteId = data.site_id ?? access.siteId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("menu_items").select("*").order("sort_order");
    if (effectiveSiteId) query = query.eq("site_id", effectiveSiteId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as StaffMenuItem[];
  });

/**
 * Copies the Crown Court catalogue into Futures House without reusing IDs.
 * The routine is idempotent: matching target rows are updated and missing
 * rows are created, so an admin can run it again after changing the master
 * Crown Court menu.
 */
export const syncFuturesHouseMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({}).default({}).parse(value))
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sites, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id,postcode")
      .in("postcode", ["LU1 2AA", "LU3 3QB"])
      .eq("active", true);
    if (siteError) throw new Error(siteError.message);
    const sourceSite = sites?.find((site) => site.postcode === "LU1 2AA");
    const targetSite = sites?.find((site) => site.postcode === "LU3 3QB");
    if (!sourceSite || !targetSite) {
      throw new Error("Both Luton Crown Court and Futures House must be configured first");
    }

    const [sourceCategoriesResult, targetCategoriesResult, sourceItemsResult, targetItemsResult] =
      await Promise.all([
        supabaseAdmin.from("menu_categories").select("*").eq("site_id", sourceSite.id),
        supabaseAdmin.from("menu_categories").select("*").eq("site_id", targetSite.id),
        supabaseAdmin.from("menu_items").select("*").eq("site_id", sourceSite.id),
        supabaseAdmin.from("menu_items").select("*").eq("site_id", targetSite.id),
      ]);
    const firstError = [
      sourceCategoriesResult.error,
      targetCategoriesResult.error,
      sourceItemsResult.error,
      targetItemsResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const sourceCategories = sourceCategoriesResult.data ?? [];
    const targetCategories = [...(targetCategoriesResult.data ?? [])];
    const sourceItems = sourceItemsResult.data ?? [];
    const targetItems = [...(targetItemsResult.data ?? [])];
    const categoryIds = new Map<string, string>();
    let categoriesCreated = 0;
    let itemsCreated = 0;
    let modifiersCreated = 0;

    for (const source of sourceCategories) {
      let target = targetCategories.find(
        (row) => row.name.trim().toLowerCase() === source.name.trim().toLowerCase(),
      );
      const patch = {
        name: source.name,
        description: source.description,
        sort_order: source.sort_order,
        active: source.active,
      };
      if (target) {
        const { error } = await supabaseAdmin
          .from("menu_categories")
          .update(patch)
          .eq("id", target.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabaseAdmin
          .from("menu_categories")
          .insert({ ...patch, site_id: targetSite.id })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        target = data;
        targetCategories.push(data);
        categoriesCreated += 1;
      }
      categoryIds.set(source.id, target.id);
    }

    const itemIds = new Map<string, string>();
    for (const source of sourceItems) {
      const targetCategoryId = source.category_id
        ? (categoryIds.get(source.category_id) ?? null)
        : null;
      let target = targetItems.find(
        (row) =>
          row.category_id === targetCategoryId &&
          row.name.trim().toLowerCase() === source.name.trim().toLowerCase(),
      );
      const {
        id: _sourceId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        site_id: _sourceSiteId,
        category_id: _sourceCategoryId,
        ...itemFields
      } = source;
      const patch = { ...itemFields, category_id: targetCategoryId };
      if (target) {
        const { error } = await supabaseAdmin.from("menu_items").update(patch).eq("id", target.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabaseAdmin
          .from("menu_items")
          .insert({ ...patch, site_id: targetSite.id })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        target = data;
        targetItems.push(data);
        itemsCreated += 1;
      }
      itemIds.set(source.id, target.id);
    }

    const { data: allModifiers, error: modifierError } = await supabaseAdmin
      .from("menu_modifiers")
      .select("*");
    if (modifierError) throw new Error(modifierError.message);
    const sourceCategoryIds = new Set(sourceCategories.map((row) => row.id));
    const sourceItemIds = new Set(sourceItems.map((row) => row.id));
    const targetCategoryIds = new Set(targetCategories.map((row) => row.id));
    const targetItemIds = new Set(targetItems.map((row) => row.id));
    const sourceModifiers = (allModifiers ?? []).filter(
      (row) =>
        (row.category_id && sourceCategoryIds.has(row.category_id)) ||
        (row.item_id && sourceItemIds.has(row.item_id)),
    );
    const targetModifiers = (allModifiers ?? []).filter(
      (row) =>
        (row.category_id && targetCategoryIds.has(row.category_id)) ||
        (row.item_id && targetItemIds.has(row.item_id)),
    );

    for (const source of sourceModifiers) {
      const targetCategoryId = source.category_id
        ? (categoryIds.get(source.category_id) ?? null)
        : null;
      const targetItemId = source.item_id ? (itemIds.get(source.item_id) ?? null) : null;
      const target = targetModifiers.find(
        (row) =>
          row.category_id === targetCategoryId &&
          row.item_id === targetItemId &&
          row.name.trim().toLowerCase() === source.name.trim().toLowerCase() &&
          (row.group_name ?? "") === (source.group_name ?? ""),
      );
      const {
        id: _sourceId,
        created_at: _createdAt,
        category_id: _sourceCategoryId,
        item_id: _sourceItemId,
        ...modifierFields
      } = source;
      const patch = {
        ...modifierFields,
        category_id: targetCategoryId,
        item_id: targetItemId,
      };
      if (target) {
        const { error } = await supabaseAdmin
          .from("menu_modifiers")
          .update(patch)
          .eq("id", target.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("menu_modifiers").insert(patch);
        if (error) throw new Error(error.message);
        modifiersCreated += 1;
      }
    }

    return {
      categories: sourceCategories.length,
      items: sourceItems.length,
      modifiers: sourceModifiers.length,
      created: { categories: categoriesCreated, items: itemsCreated, modifiers: modifiersCreated },
    };
  });
