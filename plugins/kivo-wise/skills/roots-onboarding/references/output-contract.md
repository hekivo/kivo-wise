# Architecture note output contract

Deep reference for the result of an architecture discovery. Loaded on demand from `skills/roots-onboarding/SKILL.md`.

## What must exist at the end

- An architecture note the user approved, at a location the user confirmed.
- Review feedback resolved or explicitly waived.
- A handoff block the planning step can consume.

## Verification checklist

- The note exists at the agreed path and the user approved it in the conversation.
- Every requirement names the native mechanism that covers it, or the reason for custom code.
- At least one independent review ran, or the user waived it.
- The handoff block is complete.

## Template

```markdown
# <Feature title> architecture note

## Overview
- Scope: <one sentence>
- Profile and app path: <profile> at <path>
- Chosen approach: <approach>

## Requirements
- <requirement> -> native: <mechanism and verified file> | custom: <reason>

## Decisions
- Chosen option: <A/B>
- Rejected alternatives: <short reason each>

## Components and boundaries
- <component>: responsibility, inputs, outputs, folder, registering provider

## Data flow
- <request / response / event summary, state ownership>

## Risks
- Risk: <risk>; mitigation: <mitigation>

## Validation
- Functional: <summary>
- Tests: <suite, runner command {{runner.test}}>

## Suggested sequencing
1. <phase>
2. <phase>
```

## Handoff block

```markdown
Handoff: architecture note -> planning

- note_path: <path>
- profile: <sage-theme | acorn-mu-plugin | radicle-app>
- app_path: <path>
- runner: <lando | ddev | none>
- parallelism: <constraints>
- open_questions: <list or none>
```
