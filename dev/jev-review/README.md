# Jev review harness (optional)

Dev tooling for maintainers. It is **not** loaded by the plugin, not copied into the Codex build, and nothing in CI depends on it. It needs a [TypeSafe](https://docs.typesafe.ai) API key in `TYPESAFE_API_KEY`. Without the key the scripts print a notice and exit.

It uses Jev (TypeSafe's System One model) for typed judgments over kivo-wise content only: skill descriptions and bodies, eval expectations and eval answers. The HTTP API is called with plain `fetch` (Node 20+, no dependencies). The key is read from the environment inside the process. It is never printed or written, and it is redacted from error messages.

| Script | Primitive | What it answers |
|---|---|---|
| `route.mjs --label <name>` | Choice | For each request in `prompts.json`, which skill would be opened first, judged from the skills' `description` frontmatter (plus `none`). Reports accuracy, top-2 accuracy, the confusion matrix, low-confidence cases and confusable pairs. It also replays the same requests through `hooks/user-prompt-router.mjs` (the keyword router) for comparison. |
| `route.mjs --label <name> --keywords-only` | none | The keyword-router half only. Runs offline and makes no API calls. |
| `bullets.mjs --label <name>` | Noul | One question per expectation bullet (`evals/**/graders/expectations.md`), asked against the latest final answer in `evals/results/` (`run-3b-*.json`, then `run-3.json`, then `run-2.json`). Fails at p < 0.5; borderline is 0.35 to 0.65. |
| `scores.mjs --label <name>` | Score | Five scored dimensions per `SKILL.md`: trigger precision, profile coverage, actionability of the Procedure, runner discipline, native-first. Code combines them into a composite (`WEIGHTS` in the script). `--from results/scores-<name>.json` recomputes the composite without new requests. |

Common flags: `--only a,b` limits the run to some prompt ids, cases or skills. `--dry-run` prints the first request body without sending it.

Results go to `results/` (git-ignored): one JSON file per run, plus `usage.jsonl` with the questions and input tokens of each request. Jev bills input tokens only; see the [models page](https://docs.typesafe.ai/models.md) for the current price.

Notes on reading the output:

- Choice options are shuffled per request with a fixed seed, so before and after runs see the same order. This spreads the documented first-option bias.
- `prompts.json` labels are hand-written. The keyword router was tuned on these same prompts, so its score here is optimistic. Add new prompts before trusting a change.
- Noul answers on universal negative bullets ("never suggests running X outside the runner") sit low across most cases. Treat them as a weak signal and check the answer by hand.
- On `scores.mjs`, the runner dimension rates skills with no project commands low (for example `roots-triage` and `docs-brain`, which run only host-side read-only tools). That reflects the rubric, not a defect.
