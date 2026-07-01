-- E1 (cont.) · Spine shared product definition + physical-lot link.
-- The goods identity (species/type/finish/certificate/dims/pieces/volume) lives on
-- the SPINE — it's the same goods no matter how many times they change hands, so it
-- belongs to the spine, not either deal. And an inventory package can BE the physical
-- lot of a spine (the Spec→Lot embodiment). Additive & idempotent.

ALTER TABLE public.spines
  ADD COLUMN IF NOT EXISTS wood_species TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS processing   TEXT,          -- finish
  ADD COLUMN IF NOT EXISTS quality      TEXT,
  ADD COLUMN IF NOT EXISTS certificate  TEXT,          -- e.g. FSC
  ADD COLUMN IF NOT EXISTS thickness    TEXT,
  ADD COLUMN IF NOT EXISTS width        TEXT,
  ADD COLUMN IF NOT EXISTS length       TEXT,
  ADD COLUMN IF NOT EXISTS pieces       TEXT,
  ADD COLUMN IF NOT EXISTS volume_m3    NUMERIC(14,4);

-- Physical lot: an inventory package becomes the physical lot of a spine.
ALTER TABLE public.inventory_packages
  ADD COLUMN IF NOT EXISTS spine_id UUID REFERENCES public.spines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_packages_spine
  ON public.inventory_packages(spine_id) WHERE spine_id IS NOT NULL;
