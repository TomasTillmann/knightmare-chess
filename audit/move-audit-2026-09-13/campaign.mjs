import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const startSeed = Number(process.argv[2] ?? 9130100);
const count = Number(process.argv[3] ?? 100);
const maxMoves = Number(process.argv[4] ?? 50);
const prefix = `audit/move-audit-2026-09-13/campaign-${startSeed}`;
for (let seed = startSeed; seed < startSeed + count; seed++) {
  const started = Date.now();
  const source = `
    import {writeFileSync} from 'node:fs';
    import {generateTrace,replayTrace} from './src/game/cards/random-campaign.ts';
    let last;
    try {
      const {trace,review}=generateTrace(${seed},${maxMoves},(step,moves,state)=>{last={step,moves,state};});
      if (!trace.failure) replayTrace(trace);
      if (trace.failure) {
        writeFileSync('${prefix}-${seed}-failure.json',JSON.stringify(trace,null,2));
        writeFileSync('${prefix}-${seed}-review.jsonl',review);
      }
      console.log(JSON.stringify({seed:${seed},moves:trace.moves,steps:trace.steps.length,failure:trace.failure??null,cards:trace.sampledCards}));
    } catch(error) {
      writeFileSync('${prefix}-${seed}-exception.json',JSON.stringify({error:String(error),last},null,2));
      console.log(JSON.stringify({seed:${seed},failure:String(error)}));
    }
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 45000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
  const line = {seed,wallMs:Date.now()-started,status:result.status,error:result.error?.message,
    result:result.stdout.trim(),stderr:result.stderr.trim().slice(0,2000)};
  appendFileSync(`${prefix}.jsonl`,JSON.stringify(line)+'\n');
  console.log(JSON.stringify(line));
}
