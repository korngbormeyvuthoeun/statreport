import {
  ContextSchema,
  ReportSchema,
  RubricSchema,
  validateReport,
  validateRubric,
  type Session,
} from './domain';
export const HISTORY_KEY = 'statreport.history.v1';
export const HISTORY_PREFERENCE_KEY = 'statreport.save-history.v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function readHistory(storage: StorageLike): Session[] {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error('Saved history is not a valid list.');
  return parsed.slice(0, 20).map((s: Session) => {
    if (
      !s ||
      typeof s.id !== 'string' ||
      typeof s.demo !== 'boolean' ||
      !Array.isArray(s.attempts) ||
      !s.attempts.length
    )
      throw new Error('A saved report could not be read.');
    const context = ContextSchema.parse(s.envelope.context),
      rubric = validateRubric(RubricSchema.parse(s.envelope.rubric), context);
    if (typeof s.envelope.signature !== 'string' || s.attempts.length > 20)
      throw new Error('Invalid saved rubric.');
    s.attempts.forEach((a) => {
      if (typeof a.answer !== 'string' || !Array.isArray(a.checks))
        throw new Error('Invalid saved answer.');
      validateReport(ReportSchema.parse(a.report), rubric, a.answer);
    });
    return s;
  });
}
export function saveSession(storage: StorageLike, session: Session) {
  const history = readHistory(storage).filter((s) => s.id !== session.id);
  const next = [session, ...history].slice(0, 20);
  storage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
export function deleteSession(storage: StorageLike, id: string) {
  const next = readHistory(storage).filter((s) => s.id !== id);
  if (next.length) storage.setItem(HISTORY_KEY, JSON.stringify(next));
  else storage.removeItem(HISTORY_KEY);
  return next;
}
export function clearHistory(storage: StorageLike) {
  storage.removeItem(HISTORY_KEY);
  return [] as Session[];
}
