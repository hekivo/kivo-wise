#!/usr/bin/env node
// Fixture detector: Sage theme on the kivo-wp Compose runner, contract 2 (global router), local session.
import { rootArg, sageComposeDetection } from './sage-compose-detection.mjs';

process.stdout.write(`${JSON.stringify(sageComposeDetection(rootArg(), { kind: 'local', dockerCli: true }, 2))}\n`);
