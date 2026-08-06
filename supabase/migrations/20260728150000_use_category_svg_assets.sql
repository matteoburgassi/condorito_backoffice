update public.collection_categories as category
set character_asset = assets.asset_key
from (
  values
    ('serie-regular', 'colecciones-serie-regular'),
    ('condorito-gigante', 'colecciones-condorito-gigante'),
    ('ediciones-especiales', 'colecciones-ediciones-especiales'),
    ('clasicos-pepo', 'colecciones-clasicos-de-pepo'),
    ('chistes', 'colecciones-chistes'),
    ('tira-del-dia', 'colecciones-tira-del-dia')
) as assets(category_id, asset_key)
where category.id = assets.category_id
  and category.character_asset is distinct from assets.asset_key;
