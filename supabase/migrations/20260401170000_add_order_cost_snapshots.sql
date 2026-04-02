begin;

alter table public.orders
  add column if not exists platform_order_id text;

alter table public.orders
  add column if not exists source_product_name text;

alter table public.orders
  add column if not exists snapshot_unit_cost numeric;

alter table public.orders
  add column if not exists snapshot_unit_price numeric;

create index if not exists idx_orders_user_platform_order_id
  on public.orders(user_id, platform_order_id);

update public.orders
set platform_order_id = substring(coalesce(notes, '') from '^[0-9]+')
where platform_order_id is null;

update public.orders as orders
set
  source_product_name = coalesce(orders.source_product_name, pieces.name),
  snapshot_unit_cost = coalesce(
    orders.snapshot_unit_cost,
    coalesce(
      (
        select ppv.calculated_cost
        from public.piece_price_variations as ppv
        where ppv.id = orders.variation_id
      ),
      case
        when
          coalesce(pieces.custo_material, 0) +
          coalesce(pieces.custo_energia, 0) +
          coalesce(pieces.custo_acessorios, 0) > 0
          then
            coalesce(pieces.custo_material, 0) +
            coalesce(pieces.custo_energia, 0) +
            coalesce(pieces.custo_acessorios, 0)
        else pieces.cost
      end
    )
  ),
  snapshot_unit_price = coalesce(
    orders.snapshot_unit_price,
    coalesce(
      (
        select ppv.calculated_price
        from public.piece_price_variations as ppv
        where ppv.id = orders.variation_id
      ),
      pieces.preco_venda
    )
  )
from public.pieces
where pieces.id = orders.piece_id;

commit;
