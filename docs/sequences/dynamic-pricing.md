# Sơ đồ tuần tự: Đề xuất và duyệt giá động (FR-22, W-01)

Tài liệu này mô tả hai luồng của định giá động: tác vụ nền sinh đề xuất, và Ban Tổ chức duyệt hoặc từ chối đề xuất.
Công thức và quy tắc nằm ở [`docs/dynamic-pricing.md`](../dynamic-pricing.md).

## 1. Quy tắc nghiệp vụ

- Hệ thống không tự đổi giá. Tác vụ nền chỉ ghi đề xuất vào `price_suggestions`.
- Mỗi khu vực có tối đa một đề xuất `PENDING`. Lần phân tích sau làm mới đề xuất đó tại chỗ.
- Giá đề xuất luôn nằm trong `[floor_price, ceiling_price]` và làm tròn tới 10.000 VNĐ.
- Duyệt đề xuất chỉ đổi giá ghế `AVAILABLE`. Ghế `HELD` giữ nguyên giá của người đang giữ.
- Mọi lần duyệt ghi một dòng `price_changes` với `reason = 'DYNAMIC'`.
- Hai lần duyệt đồng thời cùng một đề xuất chỉ có một lần được áp dụng.

---

## 2. Sơ đồ tuần tự: Tác vụ nền phân tích và sinh đề xuất

Cùng luồng này chạy khi BTC bấm "Chạy lại phân tích ngay", chỉ khác là chỉ phân tích một sự kiện.

```mermaid
sequenceDiagram
    autonumber
    participant Worker as PricingService.Start (internal/service)
    participant Model as pricing.Evaluate (internal/pricing)
    participant DB as PostgreSQL (pgxpool)

    loop mỗi PRICING_INTERVAL_SECONDS (mặc định 300 giây)
        Worker->>DB: ListPricingEventIDs (ON_SALE, trong khung giờ mở bán)
        DB-->>Worker: danh sách sự kiện

        loop từng khu vực của từng sự kiện
            Worker->>DB: BEGIN, khóa event_zones (FOR UPDATE)
            Worker->>DB: GetZoneDemand (số ghế AVAILABLE, HELD, SOLD, ghế bị giữ hoặc bán trong cửa sổ)
            Worker->>DB: CountWaitingQueue (queue_entries WAITING)
            DB-->>Worker: số liệu đầu vào
            Worker->>Model: Evaluate(P_current, sàn, trần, S_rem, S_held, v_actual, T_rem, Q)
            Model-->>Worker: alpha, delta, P_suggested, lệch có đạt 5% không

            alt lệch từ 5% và chưa bị từ chối gần đây
                Worker->>DB: INSERT hoặc UPDATE price_suggestions (PENDING, reason, metrics)
            else lệch dưới 5%, hết ghế, ngừng bán, tắt khu vực hoặc vừa bị từ chối
                Worker->>DB: UPDATE price_suggestions SET status = EXPIRED (nếu có đề xuất mở)
            end
            Worker->>DB: COMMIT
        end
    end
```

---

## 3. Sơ đồ tuần tự: Ban Tổ chức duyệt đề xuất

```mermaid
sequenceDiagram
    autonumber
    actor BTC as Ban Tổ chức (Organizer Console)
    participant Boundary as PricingHandler (internal/httpapi)
    participant Org as OrganizerService (internal/service)
    participant Control as PricingService (internal/service)
    participant DB as PostgreSQL (pgxpool)
    participant Hub as RealtimeHub (internal/service)
    actor Buyer as Trình duyệt khán giả (SSE)

    BTC->>Boundary: POST /api/organizer/suggestions/{id}/approve (kèm Session Token)
    activate Boundary
    Boundary->>Boundary: RequireRole: ORGANIZER hoặc ADMIN, nếu không thì 403 forbidden
    Boundary->>Control: SuggestionEventID(id)
    Control->>DB: GetPriceSuggestion
    DB-->>Control: event_id
    Boundary->>Org: AuthorizeEvent(event_id, user_id)
    Org-->>Boundary: 403 not_event_organizer nếu BTC không sở hữu sự kiện

    Boundary->>Control: Approve(id, user_id)
    activate Control
    Control->>DB: BEGIN
    Control->>DB: khóa event_zones (FOR UPDATE)
    Control->>DB: khóa price_suggestions (FOR UPDATE)

    alt đề xuất không còn PENDING
        Control-->>Boundary: ErrSuggestionNotPending
        Boundary-->>BTC: 409 suggestion_not_pending
    else giá khu vực đã đổi hoặc giá đề xuất ngoài [sàn, trần]
        Control->>DB: UPDATE price_suggestions SET status = EXPIRED
        Control->>DB: COMMIT
        Control-->>Boundary: ErrSuggestionStale
        Boundary-->>BTC: 409 suggestion_stale
    else hợp lệ
        Control->>DB: UPDATE event_zones SET base_price = giá đề xuất
        Control->>DB: UPDATE event_seats SET current_price = giá đề xuất WHERE status = AVAILABLE
        Control->>DB: INSERT price_changes (reason DYNAMIC, changed_by = BTC)
        Control->>DB: UPDATE price_suggestions SET status = APPROVED, reviewed_by, reviewed_at
        Control->>DB: pg_notify(event_seats_channel, price_changed)
        Control->>DB: COMMIT
        Note over DB,Hub: PostgreSQL chỉ phát thông báo sau COMMIT
        Control-->>Boundary: ApprovalResult (giá cũ, giá mới, số ghế đổi giá)
        Boundary-->>BTC: 200 OK
    end
    deactivate Control
    deactivate Boundary

    DB-->>Hub: NOTIFY event_seats_channel (price_changed)
    Hub-->>Buyer: SSE event: update {type: price_changed, zoneId, oldPrice, newPrice}
    Buyer->>Buyer: đổi giá ghế available của khu vực, hiện "Giá vừa tăng" hoặc "Giá vừa giảm"
```

---

## 4. Sơ đồ tuần tự: Ban Tổ chức từ chối đề xuất

```mermaid
sequenceDiagram
    autonumber
    actor BTC as Ban Tổ chức (Organizer Console)
    participant Boundary as PricingHandler (internal/httpapi)
    participant Control as PricingService (internal/service)
    participant DB as PostgreSQL (pgxpool)

    BTC->>Boundary: POST /api/organizer/suggestions/{id}/reject (kèm Session Token)
    Boundary->>Boundary: kiểm tra vai trò và quyền sở hữu sự kiện như luồng duyệt
    Boundary->>Control: Reject(id, user_id)
    Control->>DB: UPDATE price_suggestions SET status = REJECTED, reviewed_by, reviewed_at WHERE status = PENDING

    alt cập nhật được một dòng
        Control-->>Boundary: nil
        Boundary-->>BTC: 200 OK (giá không đổi)
    else không còn PENDING
        Control-->>Boundary: ErrSuggestionNotPending
        Boundary-->>BTC: 409 suggestion_not_pending
    end
```

Sau khi từ chối, tác vụ nền không đưa lại đúng cặp giá hiện tại và giá đề xuất đó trong `PRICING_REJECT_COOLDOWN_MINUTES` (mặc định 60 phút).
Nếu số liệu đổi và cho ra giá đề xuất khác, đề xuất mới vẫn xuất hiện.
