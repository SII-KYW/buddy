#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadState, saveState, interact, notify, getPetResponse } from './pet-engine.mjs';

const HOME = os.homedir();
const STATE_FILE = path.join(HOME, '.claude', 'buddy', 'state.json');

const action = process.argv[2];
if (!['pet', 'feed', 'play', 'clean'].includes(action)) {
  console.log('Usage: node interact.mjs <pet|feed|play|clean>');
  process.exit(1);
}

const state = loadState();
if (!state) {
  console.log('No buddy yet! Hatch one first.');
  process.exit(1);
}

const result = interact(state, action);
if (!result) {
  console.log('Unknown action');
  process.exit(1);
}

saveState(state);

const response = getPetResponse(state);
notify(`${result.icon} ${response}`, `${state.name}`);
console.log(`${result.icon} ${response} (${result.buff} +${result.amount} for 5min)`);
