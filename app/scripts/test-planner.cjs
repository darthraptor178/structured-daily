const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  module._compile(output, filename)
}

const { planDayLocally } = require('../src/planner.ts')

const compact = (tasks) => tasks.map(({ title, date, startMin, durationMin, conflict }) => ({ title, date, startMin, durationMin, conflict: Boolean(conflict) }))

assert.deepEqual(compact(planDayLocally(
  '1h making ppt then 1h reviewing paper then 6-8 pm presentation',
  '2026-07-16', 540, [],
)), [
  { title: 'making ppt', date: '2026-07-16', startMin: 540, durationMin: 60, conflict: false },
  { title: 'reviewing paper', date: '2026-07-16', startMin: 600, durationMin: 60, conflict: false },
  { title: 'presentation', date: '2026-07-16', startMin: 1080, durationMin: 120, conflict: false },
])

assert.deepEqual(compact(planDayLocally(
  '1. Write report 30m\n2. Call Mukta 45 min\n3. Gym 1h',
  '2026-07-16', 600, [],
)).map(({ title, startMin, durationMin }) => ({ title, startMin, durationMin })), [
  { title: 'Write report', startMin: 600, durationMin: 30 },
  { title: 'Call Mukta', startMin: 630, durationMin: 45 },
  { title: 'Gym', startMin: 675, durationMin: 60 },
])

assert.equal(planDayLocally('Tomorrow study 1h', '2026-07-16', 540, [])[0].date, '2026-07-17')
assert.equal(planDayLocally('Lunch at 12:30 pm for 30 min', '2026-07-16', 540, [])[0].startMin, 750)
assert.equal(planDayLocally('6-8 presentation', '2026-07-16', 540, [])[0].startMin, 1080)

const existing = [{ date: '2026-07-16', startMin: 540, durationMin: 60 }]
assert.equal(planDayLocally('Write for 30 min', '2026-07-16', 540, existing)[0].startMin, 600)

console.log('Planner parser: 6 scenarios passed')
