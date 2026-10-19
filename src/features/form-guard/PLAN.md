# Form Guard

## Overview
Spam protection for Webflow forms that submit straight to an external handler, so Webflow's own spam filtering never runs. First built for Elevate's Pardot forms (October 2026).

## Core Features
1. Spam guard (forms matching `ts-form-selector`)
   - Capture-phase submit listener on window, so it runs before Webflow, GTM and other submit listeners
   - Hard rules block on their own; soft rules block at two or more
   - Blocked submissions show the Webflow success state and push a dataLayer event
   - Honeypot field is display:none so autofill and password managers skip it
   - QA bypass stored in localStorage via a URL parameter
2. Phone and email validation (all forms)
   - setCustomValidity messages, disposable domain list, typo suggestions
   - Phone pattern escaped for the regex `v` flag Chrome uses on pattern attributes

## Design notes
- Config lives on the script tag so one build serves every client
- Source is ASCII-only; Cyrillic and emoji ranges are built from escapes
- Fails open: if the script doesn't load, forms work as normal

## Future
- Optional server-side check (Webflow Cloud or Cloudflare Worker) for bots posting directly to handlers
