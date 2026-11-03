-- +goose Up
-- Demo data: real concerts held in Vietnam, with their published ticket tiers.
-- Each concert gets its own venue layout. Seats are a small grid per zone; floor and ceiling are ±20% of the list price.

ALTER TABLE events ADD COLUMN image_credit TEXT;

INSERT INTO users (id, email, full_name, role, status, email_verified_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'btc@cosh301.nhansp.id.vn', 'Ban Tổ chức', 'ORGANIZER', 'ACTIVE', now());


-- +goose StatementBegin
DO $$
DECLARE
    v_id UUID;
    e_id UUID;
    z_id UUID;
    z_rank INT;
    r INT;
    n INT;
    s_id UUID;
BEGIN
    -- BLACKPINK WORLD TOUR [BORN PINK] IN HANOI
    INSERT INTO venues (name, address) VALUES ('Sân vận động Quốc gia Mỹ Đình', 'Số 1 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'BLACKPINK WORLD TOUR [BORN PINK] IN HANOI', 'blackpink-born-pink-ha-noi-2023', 'BLACKPINK mang chuyến lưu diễn thế giới Born Pink đến Hà Nội với hai đêm diễn đầu tiên tại sân vận động Mỹ Đình. Hai đêm 29 và 30/7/2023 thu hút hơn 67.000 khán giả.', 'K-pop',
            '/events/blackpink-born-pink-ha-noi-2023.jpg', 'Ảnh: @aanglerrr (aang), CC BY 4.0, Wikimedia Commons', 'Hà Nội', '2023-07-29T19:30:00+07:00', '2023-07-29T22:30:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP', 'VIP (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 9800000, 7840000, 11760000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 9800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'PLATINUM', 'Platinum (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 7800000, 6240000, 9360000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 7800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1_SEAT', 'CAT 1 (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 6800000, 5440000, 8160000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 6800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1_STAND', 'CAT 1 (khu đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 5800000, 4640000, 6960000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 5800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT2', 'CAT 2 (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 5800000, 4640000, 6960000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 5800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT3', 'CAT 3 (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 3800000, 3040000, 4560000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 3800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT4', 'CAT 4 (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1800000, 1440000, 2160000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT5', 'CAT 5 (ghế ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1200000, 960000, 1440000);
    z_rank := 7;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1200000);
        END LOOP;
    END LOOP;
    -- Concert Anh Trai "Say Hi" - Hà Nội
    INSERT INTO venues (name, address) VALUES ('Sân vận động Quốc gia Mỹ Đình', 'Số 1 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'Concert Anh Trai "Say Hi" - Hà Nội', 'anh-trai-say-hi-ha-noi-2024', 'Concert của dàn nghệ sĩ chương trình Anh Trai Say Hi, tổ chức tại sân vận động Mỹ Đình vào ngày 7/12/2024. Vé có 12 hạng, giá từ 500.000 đến 10 triệu đồng, mở bán trên Ticketbox.', 'V-pop',
            '/events/anh-trai-say-hi-ha-noi-2024.jpg', 'Ảnh: Nguyễn Thanh Quang, CC BY-SA 3.0, Wikimedia Commons', 'Hà Nội', '2024-12-07T19:00:00+07:00', '2024-12-07T22:00:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'PREMIER', 'Premier Lounge (bàn ghế cocktail)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 10000000, 8000000, 12000000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 10000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SVIP', 'SVIP (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 4000000, 3200000, 4800000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 4000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIEVIP', 'VieVIP (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2600000, 2080000, 3120000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2600000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'FANZONE', 'Fanzone (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2500000, 2000000, 3000000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP', 'VIP (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2200000, 1760000, 2640000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2200000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA1', 'GA 1 (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1800000, 1440000, 2160000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA2', 'GA 2 (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1400000, 1120000, 1680000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1400000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA3', 'GA 3 (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1000000, 800000, 1200000);
    z_rank := 7;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1', 'CAT 1 (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 900000, 720000, 1080000);
    z_rank := 8;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 900000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA4', 'GA 4 (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 800000, 640000, 960000);
    z_rank := 9;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT2', 'CAT 2 (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 700000, 560000, 840000);
    z_rank := 10;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 700000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT3', 'CAT 3 (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 500000, 400000, 600000);
    z_rank := 11;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 500000);
        END LOOP;
    END LOOP;
    -- Concert Anh Trai Vượt Ngàn Chông Gai - Đêm 2
    INSERT INTO venues (name, address) VALUES ('Vinhomes Ocean Park 3 (Ocean City)', 'Vinhomes Ocean Park 3, Văn Giang, Hưng Yên') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'Concert Anh Trai Vượt Ngàn Chông Gai - Đêm 2', 'anh-trai-vuot-ngan-chong-gai-ocean-park-2024', 'Đêm concert thứ hai của chương trình Anh Trai Vượt Ngàn Chông Gai, diễn ra tối 14/12/2024 tại Vinhomes Ocean Park 3. Vé gồm 11 hạng từ 800.000 đến 8 triệu đồng và bán hết sau khoảng 40 phút mở bán.', 'V-pop',
            '/events/anh-trai-vuot-ngan-chong-gai-ocean-park-2024.jpg', 'Ảnh: YeaH1 Channel, CC BY 3.0, Wikimedia Commons', 'Hưng Yên', '2024-12-14T18:00:00+07:00', '2024-12-14T21:00:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'XVIP', 'VIP - X-VIP 1, 2 (bán combo 10 vé)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 8000000, 6400000, 9600000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 8000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'DINHNOC', 'Ngồi - Đỉnh Nóc, Kịch Trần', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 3500000, 2800000, 4200000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 3500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'BAYPHAPPHOI', 'Ngồi - Bay Phấp Phới 1, 2', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2500000, 2000000, 3000000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'TINHHOA', 'Ngồi - Tinh Hoa, Sao Sáng, Thiếu Nhi', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2000000, 1600000, 2400000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CALON', 'Đứng - Cá Lớn & Xuân Hạ Thu Đông 1-4', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1800000, 1440000, 2160000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'KAKA', 'Ngồi - KaKa, Xương Rồng, Đam Mê', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1500000, 1200000, 1800000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'MUTGUNG', 'Đứng - Mứt Gừng 1, 2', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1200000, 960000, 1440000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1200000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'NHATRE', 'Đứng - Nhà Trẻ 1, 2', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 800000, 640000, 960000);
    z_rank := 7;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'TAISINH', 'Ngồi - Tái Sinh, Nhà Hát, Ngũ Hành', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 800000, 640000, 960000);
    z_rank := 8;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 800000);
        END LOOP;
    END LOOP;
    -- VPBank K-Star Spark in Vietnam 2025 (G-Dragon, CL, DPR IAN, TEMPEST, tripleS)
    INSERT INTO venues (name, address) VALUES ('Sân vận động Quốc gia Mỹ Đình', 'Số 1 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'VPBank K-Star Spark in Vietnam 2025 (G-Dragon, CL, DPR IAN, TEMPEST, tripleS)', 'g-dragon-k-star-spark-2025', 'Đại nhạc hội K-pop với G-Dragon (BIGBANG) và CL (2NE1) cùng các nghệ sĩ trẻ, diễn ra tối 21/6/2025 tại sân vận động Mỹ Đình. Vé từ 1 đến 6,5 triệu đồng, bán hết ngay sau khi mở bán.', 'K-pop',
            '/events/g-dragon-k-star-spark-2025.jpg', 'Ảnh: aliehs, CC BY 3.0, Wikimedia Commons', 'Hà Nội', '2025-06-21T19:00:00+07:00', '2025-06-21T22:00:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SVIP', 'S-VIP', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 6500000, 5200000, 7800000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 6500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP1', 'VIP 1', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 5500000, 4400000, 6600000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 5500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP2', 'VIP 2', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 5000000, 4000000, 6000000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 5000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1_SEAT', 'CAT 1 (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 3500000, 2800000, 4200000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 3500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1_STAND', 'CAT 1 (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 3000000, 2400000, 3600000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 3000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT2', 'CAT 2', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2900000, 2320000, 3480000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2900000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT3', 'CAT 3', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2500000, 2000000, 3000000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT4', 'CAT 4', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1500000, 1200000, 1800000);
    z_rank := 7;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT5', 'CAT 5 (RV - tầm nhìn hạn chế)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1000000, 800000, 1200000);
    z_rank := 8;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1000000);
        END LOOP;
    END LOOP;
    -- Mỹ Tâm Live Concert "See The Light"
    INSERT INTO venues (name, address) VALUES ('Sân vận động Quốc gia Mỹ Đình', 'Số 1 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'Mỹ Tâm Live Concert "See The Light"', 'my-tam-see-the-light-2025', 'Live concert của Mỹ Tâm tại sân vận động Mỹ Đình tối 13/12/2025, đón khoảng 40.000 khán giả. Chương trình kéo dài gần 4 giờ với hơn 30 ca khúc.', 'V-pop',
            '/events/my-tam-see-the-light-2025.jpg', 'Ảnh: Quạ Con, CC BY 2.0, Wikimedia Commons', 'Hà Nội', '2025-12-13T19:00:00+07:00', '2025-12-13T23:00:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SEASOUL', 'Seasoul Lounge', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 12000000, 9600000, 14400000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 12000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SVIP', 'SVIP', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 4600000, 3680000, 5520000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 4600000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VVIP', 'VVIP', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 4000000, 3200000, 4800000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 4000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP', 'VIP', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 3400000, 2720000, 4080000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 3400000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'FANZONE', 'Fan Zone (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2800000, 2240000, 3360000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2800000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'DELUXE', 'Deluxe', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2000000, 1600000, 2400000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA', 'GA (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1500000, 1200000, 1800000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1500000);
        END LOOP;
    END LOOP;
    -- Concert Anh Trai "Say Hi" - Đêm 9 (TP.HCM)
    INSERT INTO venues (name, address) VALUES ('Khu đô thị Vạn Phúc City', 'Đường Nguyễn Thị Nhung, Phường Hiệp Bình Phước, TP. Thủ Đức, TP. Hồ Chí Minh') RETURNING id INTO v_id;
    INSERT INTO events (organizer_id, venue_id, name, slug, description, genre, image_url, image_credit, city, starts_at, ends_at, status, max_tickets_per_user)
    VALUES ('11111111-1111-1111-1111-111111111111', v_id, 'Concert Anh Trai "Say Hi" - Đêm 9 (TP.HCM)', 'anh-trai-say-hi-dem-9-tphcm-2026', 'Đêm concert thứ chín của Anh Trai Say Hi, tổ chức tối 18/4/2026 tại khu đô thị Vạn Phúc, TP.HCM. Cổng mở từ 12h, chương trình chính bắt đầu lúc 18h.', 'V-pop',
            '/events/anh-trai-say-hi-dem-9-tphcm-2026.jpg', 'Ảnh: Oet Media, CC BY 4.0, Wikimedia Commons', 'TP. Hồ Chí Minh', '2026-04-18T18:00:00+07:00', '2026-04-18T21:00:00+07:00', 'ON_SALE', 4)
    RETURNING id INTO e_id;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SKYLOUNGE', 'Sky Lounge (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 10000000, 8000000, 12000000);
    z_rank := 0;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 10000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'SVIP', 'SVIP A&B (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 5000000, 4000000, 6000000);
    z_rank := 1;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 5000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'VIP', 'VIP A&B (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 4000000, 3200000, 4800000);
    z_rank := 2;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 4000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'FANZONE', 'Fanzone A&B (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2500000, 2000000, 3000000);
    z_rank := 3;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT1', 'CAT 1A & 1B (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 2000000, 1600000, 2400000);
    z_rank := 4;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 2000000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT2', 'CAT 2A & 2B (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1500000, 1200000, 1800000);
    z_rank := 5;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA1', 'GA 1A & 1B (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1500000, 1200000, 1800000);
    z_rank := 6;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1500000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'CAT3', 'CAT 3A & 3B (ngồi)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1200000, 960000, 1440000);
    z_rank := 7;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1200000);
        END LOOP;
    END LOOP;
    INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES (v_id, 'GA2', 'GA 2A & 2B (đứng)', 24)
    RETURNING id INTO z_id;
    INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price) VALUES (e_id, z_id, 1000000, 800000, 1200000);
    z_rank := 8;
    FOR r IN 1..2 LOOP
        FOR n IN 1..12 LOOP
            INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
            VALUES (z_id, chr(64 + r), n::text, chr(64 + r) || n::text, n, z_rank * 3 + r)
            RETURNING id INTO s_id;
            INSERT INTO event_seats (event_id, seat_id, current_price) VALUES (e_id, s_id, 1000000);
        END LOOP;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
DELETE FROM events WHERE organizer_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM venues WHERE id NOT IN (SELECT venue_id FROM events);
DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';
ALTER TABLE events DROP COLUMN image_credit;
