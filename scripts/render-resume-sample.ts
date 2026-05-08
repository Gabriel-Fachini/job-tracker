import { renderResumeTex } from '../src/lib/latex/render';
import { sampleProfile } from '../src/lib/latex/__fixtures__/sample-profile';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('uploads/resumes/generated/__sample__');
fs.mkdirSync(outDir, { recursive: true });

const tex = renderResumeTex(sampleProfile);
const texPath = path.join(outDir, 'sample.tex');
fs.writeFileSync(texPath, tex, 'utf8');
console.log('TEX written:', texPath);

execFileSync('tectonic', [texPath, '--outdir', outDir], { stdio: 'inherit', timeout: 60_000 });
console.log('PDF:', path.join(outDir, 'sample.pdf'));
