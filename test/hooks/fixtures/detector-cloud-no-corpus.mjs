#!/usr/bin/env node
// Fixture detector: the Compose project in a cloud agent session whose configured corpus
// root does not exist in that environment.
import { rootArg, sageComposeDetection } from './sage-compose-detection.mjs';

const detection = sageComposeDetection(rootArg(), { kind: 'cloud', dockerCli: true });
detection.flag = { file: '.roots-stack.json', profile: null, app: null, runner: null, corpus: ['/nonexistent/kivo-wisdom/corpus'] };
process.stdout.write(`${JSON.stringify(detection)}\n`);
