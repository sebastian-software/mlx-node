#!/usr/bin/env node
import { generate } from '../dist/generate.js';

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
