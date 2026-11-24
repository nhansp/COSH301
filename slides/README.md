# Slide thuyết trình COSH301

HTML, CSS và JS thuần, không có bước build. Giao diện lấy token và phông (Space Grotesk, Be Vietnam Pro) từ `frontend/`, phông được chép vào `fonts/` nên chạy được khi offline.

## Chạy

```bash
python3 slides/serve.py --port 8765      # mặc định 127.0.0.1:8765
```

| Địa chỉ | Việc |
|---|---|
| `/` | Slide |
| `/presenter` | Màn hình người trình bày: slide hiện tại và kế tiếp, ghi chú, đồng hồ, thời lượng từng người |
| `/ctl` | Điều khiển từ điện thoại. Dùng `--host 0.0.0.0` nếu muốn mở từ máy khác |

Phím: `→` `←` chuyển slide, `F` toàn màn hình, `S` hiện nhãn người nói, `R` phát lại đoạn video, `P` tạm dừng, `M` bật tiếng.

## Nội dung

Mỗi phần là một file Markdown trong `content/`, thứ tự khai báo ở `content/index.json`. Một dòng `===` mở đầu một slide:

```
=== id=hold layout=default speaker=huy kicker="Dữ liệu" time=60
## Tiêu đề
- Một ý một dòng.
NOTES:
Ghi chú cho người nói.
```

- `layout`: `default`, `title`, `section`, `demo-steps`, `demo-all`.
- `tone`: `ink` (mặc định), `stage` (nền sân khấu của phần demo).
- `speaker`: `thanh`, `phuc`, `ducanh`, `huy`, `dung`, `nhan` (tên và màu ở `content/index.json`).
- `time`: số giây dự kiến, dùng cho đồng hồ trong `/presenter`.
- `|||` chia cột. `@legend` chèn chú giải ghế.
- Cú pháp đầy đủ ở đầu `js/md.js` và `js/deck.js`.

## Video demo

Một video quay liền mạch và một file mốc thời gian, cả hai nằm ở `media/demo/`:

```json
{ "video": "e2e.mp4", "duration": 103.7,
  "chapters": [ { "id": "login", "title": "...", "start": 8.0, "end": 30.0, "caption": "...", "speaker": "nhan" } ] }
```

- Slide `layout=demo-steps` tự sinh một slide cho mỗi chapter. Mỗi slide chỉ phát đoạn `[start, end)` rồi dừng ở khung cuối.
- Slide `layout=demo-all` phát toàn bộ video.
- `manifest.json` hiện là bản tạm (`"placeholder": true`). Thay bằng bản thật, không cần sửa code.
- File `*.mp4` bị `.gitignore`. Chép video vào `slides/media/demo/` bằng tay.
