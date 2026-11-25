# Kiểm thử tải trực tiếp

Chạy k6 lên bản chạy thật, kèm hai màn hình theo dõi.
Cần: quyền SSH vào máy ảo, Docker (ảnh `grafana/k6:1.4.2`), Python 3.

```bash
export COSH301_VM=user@host   # máy ảo chạy bản thật
```

| Cửa sổ | Lệnh | Hiển thị |
|---|---|---|
| 1 | `ssh -t $COSH301_VM btop` | CPU, RAM, mạng của máy ảo |
| 2 | `python3 loadtest/seatwatch.py` | Trạng thái từng ghế khu VieVIP, cập nhật mỗi giây |
| 3 | `loadtest/run.sh flood` | k6: 200 người xem, 60 người giữ ghế khu VieVIP trong 60 giây |
| 3 | `loadtest/run.sh race` | k6: 100 tài khoản cùng giữ ghế A1, đúng 1 thành công |

Tham số truyền thêm cho k6, ví dụ `loadtest/run.sh flood DURATION=90s HOLDERS=80` hoặc `loadtest/run.sh race SEAT=B3`.
`seatwatch.py` nhận `--event <slug>` và `--zone "<tên khu>"`.

`run.sh` tạo 300 tài khoản tạm `k6-NNN@load.test` có sẵn phiên đăng nhập, chạy k6 qua địa chỉ công khai, rồi trả các ghế đang giữ và xóa toàn bộ tài khoản tạm, kể cả khi bấm Ctrl+C.
