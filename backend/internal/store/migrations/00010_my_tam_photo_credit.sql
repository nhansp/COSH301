-- +goose Up
-- The Mỹ Tâm event photo now comes from her own concert.
UPDATE events SET image_credit = 'Ảnh: INAX Vietnam, CC BY 3.0, Wikimedia Commons'
WHERE slug = 'my-tam-see-the-light-2025';

-- +goose Down
UPDATE events SET image_credit = 'Ảnh: USAID Vietnam, phạm vi công cộng, Wikimedia Commons'
WHERE slug = 'my-tam-see-the-light-2025';
