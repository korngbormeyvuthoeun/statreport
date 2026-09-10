import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoSession } from '../lib/demo';
import {
  clearHistory,
  deleteSession,
  HISTORY_KEY,
  readHistory,
  saveSession,
} from '../lib/history';
import { reportText } from '../lib/export';
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
test('saving is explicit and updates a report without duplicating it', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(readHistory(storage), []);
  saveSession(storage, createDemoSession());
  saveSession(storage, createDemoSession(true));
  assert.equal(readHistory(storage).length, 1);
  assert.equal(readHistory(storage)[0].attempts.length, 2);
});
test('saved history deletion removes browser data and retains unrelated storage', () => {
  const storage = new MemoryStorage();
  storage.setItem('unrelated', 'keep');
  saveSession(storage, createDemoSession());
  assert.equal(deleteSession(storage, 'demo-session').length, 0);
  assert.equal(storage.getItem(HISTORY_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  saveSession(storage, createDemoSession());
  clearHistory(storage);
  assert.deepEqual(readHistory(storage), []);
});
test('corrupted and quota-blocked history do not silently succeed', () => {
  const storage = new MemoryStorage();
  storage.setItem(HISTORY_KEY, 'not JSON');
  assert.throws(() => readHistory(storage));
  clearHistory(storage);
  assert.deepEqual(readHistory(storage), []);
  assert.throws(() =>
    saveSession(
      {
        getItem: () => null,
        setItem: () => {
          throw Error('quota');
        },
        removeItem: () => {},
      },
      createDemoSession(),
    ),
  );
});
test('copy export includes the question, answer, rubric, feedback, and revision history', () => {
  const session = createDemoSession(true),
    text = reportText(session);
  for (const expected of [
    'QUESTION',
    'STUDENT ANSWER',
    'SUPPLIED RUBRIC',
    'SCORING',
    'REVISION COMPARISON',
    session.envelope.context.question,
    session.attempts[0].answer,
    session.attempts[1].answer,
    'Not affiliated with or endorsed by College Board',
  ])
    assert.ok(text.includes(expected));
  assert.ok(!text.includes('OPENAI_API_KEY'));
});
test('print CSS includes all report panels and hides editing, navigation, and solution controls', () => {
  const css = readFileSync(
    new URL('../app/globals.css', import.meta.url),
    'utf8',
  );
  const print = css.slice(css.indexOf('@media print'));
  assert.ok(print.includes('.print-content[hidden]'));
  assert.match(print,/display:\s*block\s*!important/);
  assert.ok(print.includes('.topbar'));
  assert.ok(print.includes('.input-panel'));
  assert.ok(print.includes('.practice-card form'));
  assert.match(print,/thead\s*\{\s*display:\s*table-header-group/);
});
