# Form Guard

Browser-side spam protection and phone/email validation for Webflow forms that post to an external handler (Pardot, HubSpot and similar).

Genuine submissions are not touched: they post to the handler exactly as before, with the same cookies and hidden tracking fields. A suspected spam submission is stopped before it leaves the browser, the visitor sees the form's normal success message, and nothing reaches the handler. No conversion events fire for blocked submissions.

## Installation

Add to Site settings > Custom code > Footer, before any other scripts. Pin to a commit so the code can't change underneath the site.

```html
<script src="https://cdn.jsdelivr.net/gh/tahistudio/Tahi-Scripts@COMMIT_SHA/dist/form-guard.js"
  ts-form-selector='form[action*="/l/1051382/"]'></script>
```

## Attributes (on the script tag)

| Attribute | Default | What it does |
|---|---|---|
| `ts-form-selector` | `form` | Which forms the spam guard runs on |
| `ts-honeypot` | `ts_hp_note` | Name of the hidden honeypot field |
| `ts-qa-param` | `ts_qa` | URL parameter for the tester bypass |
| `ts-event` | `ts_form_spam_blocked` | dataLayer event pushed when a submission is blocked |
| `ts-block-domains` | (none) | Extra email domains to block, comma-separated |
| `ts-validation` | `true` | Set to `false` to turn off the phone/email validation |

## What it blocks

On its own:
- Hidden honeypot field filled in
- No real click, tap or key press on the page before submitting
- Placeholder details: Test / User, "Test Company", test@ or test.com email, "Test" postcode
- Spam email domains (maxxspace.com plus `ts-block-domains`)
- `+` aliases in the email address
- Spam words (promo, promocode, casino, crypto, SEO services...) in name or company fields
- Emoji in first or last name

Two or more of these warning signs together:
- Submitted under 2 seconds after page load (autofill alone is fine)
- Postcode is neither a UK postcode nor a US ZIP
- Russian (+7) phone number, or 6+ repeated digits
- Cyrillic text, or a link in the name, company or postcode field
- Spam words in the message, emoji in the company name, numbers in a name

## Phone and email validation

Runs on every phone and email input on the site (not just guarded forms) using the browser's own validation messages: digit counts, allowed characters, disposable email domains and common domain typos.

## QA

Add `?ts_qa=on` (or your `ts-qa-param`) to any URL to switch the guard off in that browser. The console then logs what would have been blocked. `?ts_qa=off` switches it back on.

## Limits

This only stops submissions that come through the page. Bots that post directly to the handler URL bypass the browser entirely, so pair it with handler-side checks (required fields, a required hidden field such as a session id) or a server-side middleware.
