#!/usr/bin/env python3
"""Live terminal view of one zone's seats on production, refreshed every second.

    COSH301_VM=user@host python3 loadtest/seatwatch.py [--event SLUG] [--zone NAME]

Green: available, amber: held, grey: sold. Below the grid: holds in the last
minute (a sparkline over the last 60 seconds), the zone price and any price
suggestion waiting for the organizer.
"""
import argparse
import os
import re
import subprocess
import sys
import time

GREEN, AMBER, GREY, RESET = '\033[42;30m', '\033[43;30m', '\033[100;37m', '\033[0m'
SPARK = ' ▁▂▃▄▅▆▇█'


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def remote_loop(slug, zone):
    query = f"""
WITH e AS (SELECT id FROM events WHERE slug = {sql_str(slug)}),
     z AS (SELECT vz.id FROM venue_zones vz JOIN event_zones ez ON ez.zone_id = vz.id JOIN e ON ez.event_id = e.id
           WHERE vz.name = {sql_str(zone)})
SELECT 'S', s.row_label, s.seat_number, s.seat_label, es.status::text
FROM event_seats es JOIN seats s ON s.id = es.seat_id JOIN e ON es.event_id = e.id
WHERE s.zone_id = (SELECT id FROM z)
UNION ALL
SELECT 'Z', ez.base_price::text,
       COALESCE((SELECT ps.suggested_price::text FROM price_suggestions ps
                 WHERE ps.event_id = e.id AND ps.zone_id = ez.zone_id AND ps.status = 'PENDING'
                 ORDER BY ps.created_at DESC LIMIT 1), ''),
       (SELECT count(*)::text FROM seat_holds h JOIN seats s2 ON s2.id = h.seat_id
        WHERE h.event_id = e.id AND s2.zone_id = ez.zone_id AND h.created_at > now() - interval '1 minute'),
       ''
FROM event_zones ez JOIN e ON ez.event_id = e.id WHERE ez.zone_id = (SELECT id FROM z);
"""
    return ('while true; do\npsql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F"|" <<\'SQL\'\n'
            + query + '\nSQL\necho @@\nsleep 1\ndone\n')


def money(v):
    return f"{int(v):,}".replace(",", ".") + " đ" if v else "—"


def natural(label):
    return [int(p) if p.isdigit() else p for p in re.split(r'(\d+)', label)]


def render(slug, zone, rows, history):
    seats = [r for r in rows if r[0] == 'S']
    info = next((r for r in rows if r[0] == 'Z'), None)
    by_row = {}
    for _, row, num, label, status in seats:
        by_row.setdefault(row or label[:1], []).append((num or label, status))
    counts = {k: sum(1 for s in seats if s[4] == k) for k in ('AVAILABLE', 'HELD', 'SOLD')}
    out = ['\033[H\033[2J', f"\033[1m{zone}\033[0m · {slug} · {time.strftime('%H:%M:%S')}\n"]
    for row in sorted(by_row, key=natural):
        cells = []
        for num, status in sorted(by_row[row], key=lambda x: natural(x[0])):
            color = GREEN if status == 'AVAILABLE' else AMBER if status == 'HELD' else GREY
            cells.append(f"{color} {num:>2} {RESET}")
        out.append(f" {row:>2}  " + ' '.join(cells))
    out.append('')
    out.append(f" {GREEN}   {RESET} Còn trống {counts['AVAILABLE']:>3}   {AMBER}   {RESET} Đang giữ {counts['HELD']:>3}   "
               f"{GREY}   {RESET} Đã bán {counts['SOLD']:>3}")
    if info:
        _, price, suggested, holds_1m, _ = info
        peak = max(history) or 1
        spark = ''.join(SPARK[round(v / peak * (len(SPARK) - 1))] for v in history)
        out.append(f"\n Lượt giữ trong 1 phút qua: \033[1m{holds_1m}\033[0m")
        out.append(f" Đang giữ, 60 giây qua:    {spark}")
        line = f"\n Giá hiện tại: \033[1m{money(price)}\033[0m"
        if suggested:
            pct = (int(suggested) - int(price)) / int(price) * 100
            line += f"   Đề xuất chờ duyệt: \033[1m{money(suggested)}\033[0m ({pct:+.0f}%)"
        out.append(line)
    sys.stdout.write('\n'.join(out) + '\n')
    sys.stdout.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--event', default='anh-trai-say-hi-ha-noi-2024')
    ap.add_argument('--zone', default='VieVIP (ngồi)')
    a = ap.parse_args()
    vm = os.environ.get('COSH301_VM')
    if not vm:
        sys.exit('set COSH301_VM=user@host of the production VM')
    proc = subprocess.Popen(
        ['ssh', '-o', 'BatchMode=yes', vm, 'cd ~/COSH301 && docker compose exec -T db sh -s'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
    proc.stdin.write(remote_loop(a.event, a.zone))
    proc.stdin.close()
    rows, history = [], [0] * 60
    try:
        for line in proc.stdout:
            line = line.rstrip('\n')
            if line != '@@':
                rows.append(line.split('|'))
                continue
            history = history[1:] + [sum(1 for r in rows if r[0] == 'S' and r[4] == 'HELD')]
            render(a.event, a.zone, rows, history)
            rows = []
    except KeyboardInterrupt:
        pass
    finally:
        proc.terminate()


if __name__ == '__main__':
    main()
