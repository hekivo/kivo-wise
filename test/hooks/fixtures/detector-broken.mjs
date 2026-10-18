#!/usr/bin/env node
// Fixture detector: misbehaving detector (garbage on stdout, non-zero exit). Hooks must not crash.
process.stdout.write('not json at all\n');
process.exit(1);
