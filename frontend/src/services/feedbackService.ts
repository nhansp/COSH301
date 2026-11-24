/** The ten System Usability Scale items. Odd-numbered items are positive, even-numbered are negative. */
export const SUS_ITEMS: string[] = [
  'Tôi nghĩ rằng tôi sẽ muốn sử dụng hệ thống này thường xuyên.',
  'Tôi thấy hệ thống này phức tạp một cách không cần thiết.',
  'Tôi thấy hệ thống này dễ sử dụng.',
  'Tôi nghĩ rằng tôi sẽ cần sự hỗ trợ của một người có chuyên môn kỹ thuật để sử dụng hệ thống này.',
  'Tôi thấy các chức năng khác nhau của hệ thống này được tích hợp tốt.',
  'Tôi thấy hệ thống này có quá nhiều điểm không nhất quán.',
  'Tôi nghĩ rằng hầu hết mọi người sẽ học cách sử dụng hệ thống này rất nhanh.',
  'Tôi thấy hệ thống này rất rườm rà, khó dùng.',
  'Tôi cảm thấy rất tự tin khi sử dụng hệ thống này.',
  'Tôi cần học rất nhiều thứ trước khi có thể bắt đầu sử dụng hệ thống này.',
];

export const LIKERT_LABELS = ['Rất không đồng ý', 'Không đồng ý', 'Trung lập', 'Đồng ý', 'Rất đồng ý'];

export type TaskKey = 'login' | 'hold' | 'pay' | 'ticket';

/** The test tasks, in the order of docs/testing.md. */
export const TASKS: { key: TaskKey; label: string }[] = [
  { key: 'login', label: 'Đăng nhập bằng mã OTP' },
  { key: 'hold', label: 'Chọn ghế và giữ chỗ' },
  { key: 'pay', label: 'Thanh toán bằng VNPay sandbox' },
  { key: 'ticket', label: 'Xem vé đã mua' },
];

export type TesterRole = 'AUDIENCE' | 'ORGANIZER';
export type Device = 'PHONE' | 'TABLET' | 'LAPTOP';

export const ROLE_LABELS: Record<TesterRole, string> = { AUDIENCE: 'Khán giả', ORGANIZER: 'Ban tổ chức' };
export const DEVICE_LABELS: Record<Device, string> = { PHONE: 'Điện thoại', TABLET: 'Máy tính bảng', LAPTOP: 'Máy tính' };

export interface FeedbackSubmission {
  testerRole: TesterRole;
  testerName: string;
  device: Device | '';
  /** Ten answers from 1 to 5, in item order. */
  sus: number[];
  tasks: Record<TaskKey, boolean>;
  timesSec: Record<TaskKey, number | null>;
  comment: string;
}

export type SubmitResult = { kind: 'ok' } | { kind: 'invalid'; field?: string } | { kind: 'rate_limited' } | { kind: 'error' };

export async function apiSubmitFeedback(input: FeedbackSubmission): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) return { kind: 'ok' };
    if (res.status === 429) return { kind: 'rate_limited' };
    const body = await res.json().catch(() => null);
    if (res.status === 400) return { kind: 'invalid', field: body?.field };
    return { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

export interface SusStats {
  mean: number;
  median: number;
  min: number;
  max: number;
}

export interface TaskStat {
  key: TaskKey;
  done: number;
  total: number;
  rate: number;
  timedCount: number;
  meanSeconds: number | null;
}

export interface FeedbackComment {
  id: string;
  createdAt: string;
  testerRole: TesterRole;
  testerName: string;
  score: number;
  comment: string;
}

export interface FeedbackSummary {
  count: number;
  byRole: Partial<Record<TesterRole, number>>;
  /** Null until the first response arrives. */
  sus: SusStats | null;
  itemMeans: number[];
  tasks: TaskStat[];
  recent: FeedbackComment[];
}

export async function apiFetchFeedbackSummary(): Promise<FeedbackSummary> {
  const res = await fetch('/api/feedback/summary', { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export const FEEDBACK_CSV_URL = '/api/feedback/export.csv';
