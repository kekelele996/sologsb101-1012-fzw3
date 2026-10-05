/** 响应结论 */
export type ResponseVerdict = '合格' | '不合格' | '待判定';

export const RESPONSE_VERDICTS: ResponseVerdict[] = ['合格', '不合格', '待判定'];

/** 标定：同一仪器可叠加多次标定记录 */
export interface Calibration {
  id: string;
  /** 被标定仪器 */
  instrumentId: string;
  /** 标定日期 */
  date: string;
  /** 灵敏度（V·s/m） */
  sensitivity: number;
  /** 自噪（m/s² 或 counts，按台网口径记录） */
  selfNoise: number;
  /** 脉冲响应结论 */
  responseVerdict: ResponseVerdict;
  /** 标定人 */
  operator: string;
  /** 标定机构 */
  agency: string;
  /** 备注 */
  remark: string;
  /** 复检日期（野外复检补记，补记后响应结论与统计以复检值为准） */
  recheckDate?: string;
  /** 复检灵敏度（V·s/m） */
  recheckSensitivity?: number;
  /** 复检自噪（m/s² 或 counts，按台网口径记录） */
  recheckSelfNoise?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 自动初判：灵敏度落在合理区间且自噪不高于阈值判合格。
 * 阈值按台网常规口径给出，最终以标定报告为准。
 */
export const SENSITIVITY_RANGE: Record<string, { min: number; max: number }> = {
  宽频带: { min: 800, max: 3000 },
  短周期: { min: 100, max: 800 },
  强震: { min: 0.1, max: 5 }
};

export const SELF_NOISE_LIMIT = 3.5;

export function judgeCalibration(
  type: string,
  sensitivity: number,
  selfNoise: number
): ResponseVerdict {
  if (!Number.isFinite(sensitivity) || !Number.isFinite(selfNoise)) return '待判定';
  const range = SENSITIVITY_RANGE[type] ?? { min: 0, max: Number.MAX_SAFE_INTEGER };
  if (sensitivity < range.min || sensitivity > range.max) return '不合格';
  if (selfNoise > SELF_NOISE_LIMIT) return '不合格';
  return '合格';
}

/** 灵敏度变化量（相对上一次标定），返回绝对值与百分比 */
export interface SensitivityDelta {
  /** 本次 - 上次 */
  absolute: number;
  /** 变化百分比（%） */
  percent: number;
  /** 是否有上一次标定可比 */
  comparable: boolean;
}

export function sensitivityDelta(current: number, previous: number | null): SensitivityDelta {
  if (previous === null || !Number.isFinite(previous) || previous === 0) {
    return { absolute: 0, percent: 0, comparable: false };
  }
  const absolute = Number((current - previous).toFixed(2));
  return { absolute, percent: Number(((absolute / previous) * 100).toFixed(2)), comparable: true };
}

/** 该标定是否已补记复检（日期、灵敏度、自噪三项齐全） */
export function hasRecheck(row: Calibration): boolean {
  return (
    typeof row.recheckDate === 'string' &&
    row.recheckDate.length > 0 &&
    typeof row.recheckSensitivity === 'number' &&
    Number.isFinite(row.recheckSensitivity) &&
    typeof row.recheckSelfNoise === 'number' &&
    Number.isFinite(row.recheckSelfNoise)
  );
}

/** 生效灵敏度：已补记复检取复检灵敏度，否则取初次录入值 */
export function effectiveSensitivity(row: Calibration): number {
  return hasRecheck(row) ? (row.recheckSensitivity as number) : row.sensitivity;
}

/** 生效自噪：已补记复检取复检自噪，否则取初次录入值 */
export function effectiveSelfNoise(row: Calibration): number {
  return hasRecheck(row) ? (row.recheckSelfNoise as number) : row.selfNoise;
}

/** 生效日期：已补记复检取复检日期（趋势按复检后落点），否则取标定日期 */
export function effectiveDate(row: Calibration): string {
  return hasRecheck(row) ? (row.recheckDate as string) : row.date;
}

/** 标定页筛选条件（存于 calibrationSlice） */
export interface CalibrationFilterState {
  keyword: string;
  verdicts: ResponseVerdict[];
  instrumentTypes: string[];
  /** 是否只看超期未标定仪器 */
  onlyOverdue: boolean;
}

export function createEmptyCalibrationFilter(): CalibrationFilterState {
  return {
    keyword: '',
    verdicts: [],
    instrumentTypes: [],
    onlyOverdue: false
  };
}

/** 待标定天数文案：正数为剩余天数、负数为超期天数、0 为今日到期 */
export function calibrateDueText(dueInDays: number): string {
  if (!Number.isFinite(dueInDays)) return '标定日期缺失';
  if (dueInDays === 0) return '今日到期';
  if (dueInDays > 0) return `距下次标定 ${dueInDays} 天`;
  return `已超期 ${Math.abs(dueInDays)} 天`;
}
