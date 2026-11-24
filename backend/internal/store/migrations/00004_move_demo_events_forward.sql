-- +goose Up
-- The seeded concerts had all taken place, so none could be sold or priced.
-- Move each one forward by whole years so it keeps its day, month and time.
UPDATE events e
SET starts_at = e.starts_at + make_interval(years => m.years),
    ends_at   = e.ends_at + make_interval(years => m.years)
FROM (VALUES
    ('blackpink-born-pink-ha-noi-2023', 4),
    ('anh-trai-say-hi-ha-noi-2024', 2),
    ('anh-trai-vuot-ngan-chong-gai-ocean-park-2024', 2),
    ('g-dragon-k-star-spark-2025', 2),
    ('my-tam-see-the-light-2025', 1),
    ('anh-trai-say-hi-dem-9-tphcm-2026', 1)
) AS m(slug, years)
WHERE e.slug = m.slug;

-- +goose Down
UPDATE events e
SET starts_at = e.starts_at - make_interval(years => m.years),
    ends_at   = e.ends_at - make_interval(years => m.years)
FROM (VALUES
    ('blackpink-born-pink-ha-noi-2023', 4),
    ('anh-trai-say-hi-ha-noi-2024', 2),
    ('anh-trai-vuot-ngan-chong-gai-ocean-park-2024', 2),
    ('g-dragon-k-star-spark-2025', 2),
    ('my-tam-see-the-light-2025', 1),
    ('anh-trai-say-hi-dem-9-tphcm-2026', 1)
) AS m(slug, years)
WHERE e.slug = m.slug;
