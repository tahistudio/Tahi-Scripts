/**
 * Form Guard
 * Browser-side spam protection and phone/email validation for Webflow forms
 * that post to an external handler (Pardot, HubSpot and similar).
 * Genuine submissions are not touched. Suspected spam is stopped before it
 * leaves the browser and shown the form's normal success message.
 * @version 1.0.0
 * @author Liam Miller
 * @repository https://github.com/tahistudio/Tahi-Scripts
 */

(function () {
  'use strict';

  var script = document.currentScript;

  function attr(name, fallback) {
    var value = script && script.getAttribute(name);
    return value === null || value === undefined || value === '' ? fallback : value;
  }

  function list(name) {
    return attr(name, '')
      .split(',')
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(Boolean);
  }

  var FORM_SELECTOR = attr('ts-form-selector', 'form');
  var HONEYPOT_NAME = attr('ts-honeypot', 'ts_hp_note');
  var QA_PARAM = attr('ts-qa-param', 'ts_qa');
  var QA_KEY = QA_PARAM + '_bypass';
  var EVENT_NAME = attr('ts-event', 'ts_form_spam_blocked');
  var VALIDATION = attr('ts-validation', 'true') !== 'false';

  /* ------------------------------------------------------------------
     SPAM GUARD
     ------------------------------------------------------------------ */

  var MIN_FILL_MS = 2000;
  var BLOCK_SCORE = 2;

  var TEST_EMAIL_DOMAINS = ['test.com', 'test.co.uk', 'testing.com', 'example.com', 'example.org', 'example.co.uk'];
  var TEST_EMAIL_LOCALS = ['test', 'testing', 'tester', 'testuser'];
  var SPAM_EMAIL_DOMAINS = ['maxxspace.com'].concat(list('ts-block-domains'));

  var SPAM_WORDS = /\b(promo|promos|promocode|promocodes|promo codes?|bonus|casino|crypto|bitcoin|forex|viagra|cialis|seo services?|backlinks?)\b/i;
  var EMOJI = /\p{Extended_Pictographic}/u;

  var UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?|GIR)\s*(\d[A-Z]{2})?$/i;
  var US_ZIP = /^\d{5}(-\d{4})?$/;
  var JUNK_POSTCODE = /^(test|testing|asdf|qwerty|none|null|x+|a+|0+|(.)\2+)$/i;

  var CYRILLIC = new RegExp('[' + String.fromCharCode(0x0400) + '-' + String.fromCharCode(0x04ff) + ']');
  var LINK = /(https?:\/\/|www\.|\.(com|net|org|ru|xyz|info|biz|io|co)(\/|\b))/i;

  var interacted = false;

  function markInteraction(e) {
    if (e.isTrusted) interacted = true;
  }

  ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, markInteraction, { capture: true, passive: true });
  });

  function qaBypass() {
    try {
      var p = new URLSearchParams(window.location.search).get(QA_PARAM);
      if (p === 'on') localStorage.setItem(QA_KEY, '1');
      if (p === 'off') localStorage.removeItem(QA_KEY);
      return localStorage.getItem(QA_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  qaBypass();

  var FIELDS = {
    first: /first/,
    last: /last|surname/,
    email: /mail/,
    phone: /phone|mobile|tel/,
    company: /company|organi[sz]ation|business/,
    postcode: /post.?code|zip/,
    message: /message|comment|enquiry|details/,
  };

  function readFields(form) {
    var out = {};
    var els = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea');
    Object.keys(FIELDS).forEach(function (key) {
      out[key] = '';
      for (var i = 0; i < els.length; i++) {
        if (els[i].name === HONEYPOT_NAME) continue;
        var id = ((els[i].name || '') + ' ' + (els[i].id || '')).toLowerCase();
        if (FIELDS[key].test(id)) {
          out[key] = (els[i].value || '').trim();
          break;
        }
      }
    });
    return out;
  }

  function assess(v, ctx) {
    var hard = [];
    var soft = [];

    if (ctx.honeypot) hard.push('honeypot');
    if (!ctx.interacted) hard.push('no-interaction');
    if (ctx.elapsedMs < MIN_FILL_MS) soft.push('too-fast');

    var first = (v.first || '').toLowerCase();
    var last = (v.last || '').toLowerCase();
    var company = (v.company || '').toLowerCase();
    var email = (v.email || '').toLowerCase();
    var postcode = (v.postcode || '').trim();
    var phone = (v.phone || '').trim();

    if (first === 'test' && (last === 'user' || last === 'test')) hard.push('placeholder-name');
    if (/^test(ing)?( company| co| ltd| limited)?$/.test(company)) hard.push('placeholder-company');

    var at = email.lastIndexOf('@');
    if (at > 0) {
      var local = email.slice(0, at);
      var domain = email.slice(at + 1);
      if (TEST_EMAIL_DOMAINS.indexOf(domain) !== -1 || TEST_EMAIL_LOCALS.indexOf(local) !== -1) {
        hard.push('test-email');
      }
      if (SPAM_EMAIL_DOMAINS.some(function (d) { return domain === d || domain.slice(-d.length - 1) === '.' + d; })) {
        hard.push('spam-domain');
      }
      if (local.indexOf('+') !== -1) hard.push('plus-alias');
    }

    var names = [v.first, v.last].join(' ');
    if (SPAM_WORDS.test(names + ' ' + (v.company || ''))) hard.push('spam-words');
    else if (SPAM_WORDS.test(v.message || '')) soft.push('spam-words-in-message');
    if (EMOJI.test(names)) hard.push('emoji-in-name');
    else if (EMOJI.test(v.company || '')) soft.push('emoji-in-company');
    if (/\d/.test(names)) soft.push('digits-in-name');

    if (postcode) {
      if (JUNK_POSTCODE.test(postcode)) hard.push('junk-postcode');
      else if (!UK_POSTCODE.test(postcode) && !US_ZIP.test(postcode)) soft.push('unknown-postcode');
    }

    if (/^(\+|00)\s*7/.test(phone)) soft.push('ru-phone');
    if (/(\d)\1{5,}/.test(phone.replace(/\D/g, ''))) soft.push('repeated-digits');

    if (CYRILLIC.test([v.first, v.last, v.company, v.message].join(' '))) soft.push('cyrillic');
    if (LINK.test([v.first, v.last, v.company, v.postcode].join(' '))) soft.push('link-in-field');

    return {
      blocked: hard.length > 0 || soft.length >= BLOCK_SCORE,
      reasons: hard.concat(soft),
    };
  }

  function addHoneypot(form) {
    if (form.querySelector('[name="' + HONEYPOT_NAME + '"]')) return;
    var box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.display = 'none';
    var input = document.createElement('input');
    input.type = 'text';
    input.name = HONEYPOT_NAME;
    input.tabIndex = -1;
    input.setAttribute('autocomplete', 'off');
    box.appendChild(input);
    form.appendChild(box);
  }

  function addHoneypots() {
    document.querySelectorAll(FORM_SELECTOR).forEach(addHoneypot);
  }

  function showSuccess(form) {
    var done = form.parentElement && form.parentElement.querySelector('.w-form-done');
    form.style.display = 'none';
    if (done) done.style.display = 'block';
  }

  window.addEventListener(
    'submit',
    function (e) {
      var form = e.target;
      if (!form || !form.matches || !form.matches(FORM_SELECTOR)) return;

      var hp = form.querySelector('[name="' + HONEYPOT_NAME + '"]');
      var result = assess(readFields(form), {
        honeypot: !!(hp && hp.value),
        interacted: interacted,
        elapsedMs: window.performance ? performance.now() : MIN_FILL_MS,
      });

      if (qaBypass()) {
        console.info('[form-guard] QA mode, not blocking.', result.blocked ? 'Would block: ' + result.reasons.join(', ') : 'Would allow.', result.reasons);
        return;
      }

      if (!result.blocked) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      showSuccess(form);

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: EVENT_NAME, spam_reasons: result.reasons.join(',') });
    },
    true,
  );

  /* ------------------------------------------------------------------
     PHONE + EMAIL VALIDATION (all forms)
     ------------------------------------------------------------------ */

  var ALLOW_DOMAINS = [];

  var BLOCK_DOMAINS = ['mailinator.com', 'yopmail.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'tempr.email', 'trashmail.com', 'throwawaymail.com', 'dispostable.com', 'maildrop.cc', 'getnada.com', 'fakeinbox.com', 'mailnesia.com', 'spam4.me', 'discard.email', 'emailondeck.com', 'moakt.com', 'mohmal.com', 'example.com', 'example.org', 'asdf.com', 'aaa.com', 'qwerty.com'];

  var TYPO_DOMAINS = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gnail.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'iclod.com': 'icloud.com',
  };

  var MIN_DIGITS = 7;
  var MAX_DIGITS = 15;

  var PHONE_PATTERN = '\\+?[0-9 \\(\\)\\.\\-]{6,24}';
  var EMAIL_PATTERN = '[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+';

  var PHONE_SELECTOR = 'input[type="tel"], input[name*="hone" i], input[id*="hone" i]';
  var EMAIL_SELECTOR = 'input[type="email"], input[name*="mail" i], input[id*="mail" i]';

  var EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function digitCount(value) {
    var m = value.match(/\d/g);
    return m ? m.length : 0;
  }

  function isPhone(el) {
    return el.matches && el.matches(PHONE_SELECTOR);
  }

  function isEmail(el) {
    return el.matches && el.matches(EMAIL_SELECTOR) && !isPhone(el);
  }

  function validatePhone(el) {
    var value = (el.value || '').trim();

    if (!value) {
      el.setCustomValidity('');
      return;
    }

    if (/[a-z]/i.test(value)) {
      el.setCustomValidity('Please enter a phone number using digits only.');
      return;
    }
    if (/[^\d+\s().\-]/.test(value)) {
      el.setCustomValidity('Please remove any special characters. You can use + ( ) - and spaces.');
      return;
    }
    if (value.indexOf('+') > 0 || (value.match(/\+/g) || []).length > 1) {
      el.setCustomValidity('The + symbol can only be used at the start of the number.');
      return;
    }

    var count = digitCount(value);
    if (count < MIN_DIGITS) {
      el.setCustomValidity('That number looks too short. Please check and try again.');
      return;
    }
    if (count > MAX_DIGITS) {
      el.setCustomValidity('That number looks too long. Please check and try again.');
      return;
    }

    el.setCustomValidity('');
  }

  function validateEmail(el) {
    var value = (el.value || '').trim().toLowerCase();

    if (!value) {
      el.setCustomValidity('');
      return;
    }

    if (!EMAIL_SHAPE.test(value)) {
      el.setCustomValidity('Please enter a valid email address, for example name@company.co.uk');
      return;
    }

    var domain = value.split('@').pop();

    if (ALLOW_DOMAINS.indexOf(domain) !== -1) {
      el.setCustomValidity('');
      return;
    }

    if (TYPO_DOMAINS[domain]) {
      el.setCustomValidity('Did you mean @' + TYPO_DOMAINS[domain] + '?');
      return;
    }
    if (BLOCK_DOMAINS.indexOf(domain) !== -1) {
      el.setCustomValidity('Please use your work email address.');
      return;
    }
    if (!/\.[a-z]{2,}$/.test(domain)) {
      el.setCustomValidity("That email domain doesn't look right. Please check and try again.");
      return;
    }
    if (/\.\./.test(value) || /^[.\-]/.test(domain)) {
      el.setCustomValidity("That email address doesn't look right. Please check and try again.");
      return;
    }

    el.setCustomValidity('');
  }

  function validate(el) {
    if (isPhone(el)) validatePhone(el);
    else if (isEmail(el)) validateEmail(el);
  }

  function prepare(el) {
    if (el.dataset.vPrepped) return;
    el.dataset.vPrepped = '1';

    if (isPhone(el)) {
      el.setAttribute('type', 'tel');
      el.setAttribute('inputmode', 'tel');
      el.setAttribute('autocomplete', 'tel');
      el.setAttribute('pattern', PHONE_PATTERN);
      el.setAttribute('title', 'Digits only. You can use + ( ) - and spaces.');
    } else if (isEmail(el)) {
      el.setAttribute('type', 'email');
      el.setAttribute('inputmode', 'email');
      el.setAttribute('autocomplete', 'email');
      el.setAttribute('pattern', EMAIL_PATTERN);
      el.setAttribute('title', 'For example: name@company.co.uk');
    }
    validate(el);
  }

  function prepareAll() {
    document.querySelectorAll(PHONE_SELECTOR + ', ' + EMAIL_SELECTOR).forEach(prepare);
  }

  if (VALIDATION) {
    ['input', 'change', 'blur'].forEach(function (evt) {
      document.addEventListener(
        evt,
        function (e) {
          if (e.target && e.target.tagName === 'INPUT') {
            prepare(e.target);
            validate(e.target);
          }
        },
        true,
      );
    });
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */

  function init() {
    addHoneypots();
    if (VALIDATION) prepareAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TahiFormGuard = { assess: assess, version: '1.0.0' };
})();
