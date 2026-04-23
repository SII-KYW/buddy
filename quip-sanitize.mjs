#!/usr/bin/env node
// Sanitize quip output: trim quotes, remove trailing punctuation, limit to 40 chars
import fs from 'fs';

const inFile = process.argv[2];
const outFile = process.argv[3];

const raw = fs.readFileSync(inFile, 'utf8').trim();
let q = raw
  .replace(/^["'""'']+/, '')
  .replace(/["'""'']+$/, '')
  .replace(/[。！？.!?]+$/, '')
  .trim();
if (q.length > 40) q = q.slice(0, 40);

fs.writeFileSync(outFile, q);
fs.unlinkSync(inFile);
