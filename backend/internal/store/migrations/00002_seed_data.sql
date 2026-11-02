-- +goose Up
-- Seed basic venue, zones, seats and an active event for testing Sprint 2

DO $$
DECLARE
    org_id UUID := '11111111-1111-1111-1111-111111111111';
    v_id UUID := '22222222-2222-2222-2222-222222222222';
    z_vip UUID := '33333333-3333-3333-3333-333333333331';
    z_ga  UUID := '33333333-3333-3333-3333-333333333332';
    e_id  UUID := '44444444-4444-4444-4444-444444444444';
    r_idx INT;
    s_idx INT;
    new_seat_id UUID;
BEGIN
    -- 1. Create an organizer user
    INSERT INTO users (id, phone, email, full_name, role, status, email_verified_at)
    VALUES (org_id, '+84900000001', 'organizer@eventticketing.vn', 'Ban Tổ Chức Mẫu', 'ORGANIZER', 'ACTIVE', now())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create sample venue
    INSERT INTO venues (id, name, address, timezone)
    VALUES (v_id, 'Trung tâm Hội nghị Quốc gia', 'Số 57 Phạm Hùng, Mễ Trì, Nam Từ Liêm, Hà Nội', 'Asia/Ho_Chi_Minh')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Create venue zones
    INSERT INTO venue_zones (id, venue_id, code, name, floor, capacity)
    VALUES 
        (z_vip, v_id, 'VIP', 'Khu Vực VIP', 'Tầng 1', 20),
        (z_ga,  v_id, 'GA',  'Khu Vực Tiêu Chuẩn', 'Tầng 1', 30)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Create sample seats for VIP (Rows A, B, 10 seats each)
    FOR r_idx IN 1..2 LOOP
        FOR s_idx IN 1..10 LOOP
            new_seat_id := gen_random_uuid();
            INSERT INTO seats (id, zone_id, row_label, seat_number, seat_label, x_position, y_position, is_active)
            VALUES (
                new_seat_id, 
                z_vip, 
                CASE WHEN r_idx = 1 THEN 'A' ELSE 'B' END, 
                s_idx::text, 
                CASE WHEN r_idx = 1 THEN 'A' ELSE 'B' END || '-' || s_idx::text,
                s_idx * 40,
                r_idx * 50,
                TRUE
            ) ON CONFLICT (zone_id, seat_label) DO NOTHING;
        END LOOP;
    END LOOP;

    -- 5. Create sample seats for GA (Rows C, D, E, 10 seats each)
    FOR r_idx IN 3..5 LOOP
        FOR s_idx IN 1..10 LOOP
            new_seat_id := gen_random_uuid();
            INSERT INTO seats (id, zone_id, row_label, seat_number, seat_label, x_position, y_position, is_active)
            VALUES (
                new_seat_id, 
                z_ga, 
                CHR(64 + r_idx), 
                s_idx::text, 
                CHR(64 + r_idx) || '-' || s_idx::text,
                s_idx * 40,
                r_idx * 50,
                TRUE
            ) ON CONFLICT (zone_id, seat_label) DO NOTHING;
        END LOOP;
    END LOOP;

    -- 6. Create sample event
    INSERT INTO events (
        id, organizer_id, venue_id, name, slug, description, genre, city, image_url,
        starts_at, ends_at, sales_starts_at, sales_ends_at, status, max_tickets_per_user
    ) VALUES (
        e_id, org_id, v_id,
        'Hòa Nhạc Mùa Thu 2026 - Bản Giao Hưởng Đất Trời',
        'hoa-nhac-mua-thu-2026',
        'Đêm nhạc đặc sắc hội tụ các nghệ sĩ hàng đầu Việt Nam, mang đến không gian âm nhạc sống động và đầy cảm xúc.',
        'Classical & Symphony',
        'Hà Nội',
        'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
        now() + interval '14 days',
        now() + interval '14 days 3 hours',
        now() - interval '1 day',
        now() + interval '13 days',
        'ON_SALE',
        4
    ) ON CONFLICT (id) DO NOTHING;

    -- 7. Configure event zones pricing
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price, is_dynamic_pricing_enabled)
    VALUES 
        (e_id, z_vip, 1500000, 1000000, 2500000, TRUE),
        (e_id, z_ga,   500000,  300000,  800000, FALSE)
    ON CONFLICT (event_id, zone_id) DO NOTHING;

    -- 8. Generate event_seats for this event
    INSERT INTO event_seats (event_id, seat_id, status, current_price)
    SELECT 
        e_id, 
        s.id, 
        'AVAILABLE',
        CASE WHEN s.zone_id = z_vip THEN 1500000 ELSE 500000 END
    FROM seats s
    WHERE s.zone_id IN (z_vip, z_ga)
    ON CONFLICT (event_id, seat_id) DO NOTHING;
END $$;

-- +goose Down
DELETE FROM event_seats WHERE event_id = '44444444-4444-4444-4444-444444444444';
DELETE FROM event_zones WHERE event_id = '44444444-4444-4444-4444-444444444444';
DELETE FROM events WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM seats WHERE zone_id IN ('33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332');
DELETE FROM venue_zones WHERE venue_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM venues WHERE id = '22222222-2222-2222-2222-222222222222';
DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';
