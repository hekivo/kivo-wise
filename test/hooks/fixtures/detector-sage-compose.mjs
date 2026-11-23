#!/usr/bin/env node
// Fixture detector: Sage theme on the kivo-wp Compose runner (bin/ scripts), local session.
import { rootArg, sageComposeDetection } from './sage-compose-detection.mjs';

process.stdout.write(`${JSON.stringify(sageComposeDetection(rootArg()))}\n`);
