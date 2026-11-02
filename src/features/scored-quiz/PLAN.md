# Scored Quiz

## Overview
A config-driven scored quiz for lead generation, first built for Elevate's Digital Resilience Score (November 2026), modelled on the gated downtime calculator pattern.

## Core Features
1. One question per screen, auto-advance on answer, Back, progress, resume from sessionStorage
2. Weighted category scoring, score bands, recommendations from low-scoring answers
3. Result gate: form posts to its own handler in a hidden iframe, then results unlock in place
4. Hidden fields carry score, band, category scores, answers and context answers to the CRM
5. dataLayer events for start, completion and lead

## Design notes
- Templates (option, category, recommendation) are Webflow elements cloned at runtime, so all styling stays in the Designer
- Config is JSON in an embed so content editors can change questions without touching code
- Options render as role="radio" in a radiogroup; focus moves to the question heading on each step
- Respects prefers-reduced-motion for auto-advance and the score count-up

## Future
- Multi-select questions
- Optional per-category result copy
