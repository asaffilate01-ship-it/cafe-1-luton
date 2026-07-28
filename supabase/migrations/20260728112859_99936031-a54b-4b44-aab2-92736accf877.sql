ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS needs_cooking boolean NOT NULL DEFAULT false;

UPDATE public.menu_items SET needs_cooking = true
WHERE category_id IN (
  'bb0e54a7-67e0-4523-a4a3-c219b4e8e541','1eed4c19-5bd2-4d64-87eb-38e3f80be195','bcb84db7-3b14-4057-bcc5-906188651e4c',
  '73e39c86-3ac6-49e4-bc95-f24be853ce0a','a1c6682a-c5c8-4ca2-a318-81f6ff2fb94b','d80789fe-6388-4656-939a-1ed0656b457b',
  'dbb077d5-d8b7-4eed-9295-88a4df7c96f0','d10f716f-b831-40e1-81b9-06280d6d861d','849ff04f-3a75-41dd-a45f-3a2ff7478d1e',
  'ce280865-4a3e-4154-b7a4-f9d4cc8ee64c','1cf0d551-c9d3-460e-a511-b4c081b1063a','cc71d993-d978-49f1-84b5-5c178bd95a78',
  '3352db78-80ce-4edb-bcde-dd96cb704904','60167829-5f42-49a0-b9cd-1f5e511e12fd','85d716c3-e460-48ab-9b73-6c0b35907468',
  'fdec3603-602a-4114-96f9-b6872ea4883c','6e48d752-5b45-4696-8821-ce6919771c1c'
);