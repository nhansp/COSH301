-- +goose Up
-- The event photos were replaced with pictures from the shows themselves; their credits follow.
UPDATE events e
SET image_credit = c.credit
FROM (VALUES
    ('blackpink-born-pink-ha-noi-2023', 'Ảnh: @aanglerrr (aang), CC BY 4.0, Wikimedia Commons'),
    ('anh-trai-say-hi-ha-noi-2024', 'Ảnh: Oet Media, CC BY 4.0, Wikimedia Commons'),
    ('anh-trai-say-hi-dem-9-tphcm-2026', 'Ảnh: SẠP TINGGG, CC BY 3.0, Wikimedia Commons'),
    ('anh-trai-vuot-ngan-chong-gai-ocean-park-2024', 'Ảnh: HaneulPham, CC BY-SA 4.0, Wikimedia Commons'),
    ('my-tam-see-the-light-2025', 'Ảnh: USAID Vietnam, phạm vi công cộng, Wikimedia Commons')
) AS c(slug, credit)
WHERE e.slug = c.slug;

-- +goose Down
UPDATE events e
SET image_credit = c.credit
FROM (VALUES
    ('blackpink-born-pink-ha-noi-2023', 'Ảnh: @aanglerrr (aang), CC BY 4.0, Wikimedia Commons'),
    ('anh-trai-say-hi-ha-noi-2024', 'Ảnh: Nguyễn Thanh Quang, CC BY-SA 3.0, Wikimedia Commons'),
    ('anh-trai-say-hi-dem-9-tphcm-2026', 'Ảnh: Oet Media, CC BY 4.0, Wikimedia Commons'),
    ('anh-trai-vuot-ngan-chong-gai-ocean-park-2024', 'Ảnh: YeaH1 Channel, CC BY 3.0, Wikimedia Commons'),
    ('my-tam-see-the-light-2025', 'Ảnh: Quạ Con, CC BY 2.0, Wikimedia Commons')
) AS c(slug, credit)
WHERE e.slug = c.slug;
