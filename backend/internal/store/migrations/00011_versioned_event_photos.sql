-- +goose Up
-- Versioned photo URLs, so a replaced photo is never served from an old cached copy.
UPDATE events SET image_url = '/events/anh-trai-say-hi-dem-9-tphcm-2026.jpg?v=dc0f1f36' WHERE slug = 'anh-trai-say-hi-dem-9-tphcm-2026';
UPDATE events SET image_url = '/events/anh-trai-say-hi-ha-noi-2024.jpg?v=d59a9328' WHERE slug = 'anh-trai-say-hi-ha-noi-2024';
UPDATE events SET image_url = '/events/anh-trai-vuot-ngan-chong-gai-ocean-park-2024.jpg?v=4dd31ae3' WHERE slug = 'anh-trai-vuot-ngan-chong-gai-ocean-park-2024';
UPDATE events SET image_url = '/events/blackpink-born-pink-ha-noi-2023.jpg?v=e2af2ec4' WHERE slug = 'blackpink-born-pink-ha-noi-2023';
UPDATE events SET image_url = '/events/g-dragon-k-star-spark-2025.jpg?v=55ee63fd' WHERE slug = 'g-dragon-k-star-spark-2025';
UPDATE events SET image_url = '/events/my-tam-see-the-light-2025.jpg?v=bed0eea2' WHERE slug = 'my-tam-see-the-light-2025';
UPDATE events SET image_credit = 'Ảnh: VieON (DatVietVAC), qua Backstage.vn' WHERE slug = 'anh-trai-say-hi-ha-noi-2024';

-- +goose Down
UPDATE events SET image_url = '/events/anh-trai-say-hi-dem-9-tphcm-2026.jpg' WHERE slug = 'anh-trai-say-hi-dem-9-tphcm-2026';
UPDATE events SET image_url = '/events/anh-trai-say-hi-ha-noi-2024.jpg' WHERE slug = 'anh-trai-say-hi-ha-noi-2024';
UPDATE events SET image_url = '/events/anh-trai-vuot-ngan-chong-gai-ocean-park-2024.jpg' WHERE slug = 'anh-trai-vuot-ngan-chong-gai-ocean-park-2024';
UPDATE events SET image_url = '/events/blackpink-born-pink-ha-noi-2023.jpg' WHERE slug = 'blackpink-born-pink-ha-noi-2023';
UPDATE events SET image_url = '/events/g-dragon-k-star-spark-2025.jpg' WHERE slug = 'g-dragon-k-star-spark-2025';
UPDATE events SET image_url = '/events/my-tam-see-the-light-2025.jpg' WHERE slug = 'my-tam-see-the-light-2025';
UPDATE events SET image_credit = 'Ảnh: Oet Media, CC BY 4.0, Wikimedia Commons' WHERE slug = 'anh-trai-say-hi-ha-noi-2024';
