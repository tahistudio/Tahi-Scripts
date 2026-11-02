/**
 * Scored Quiz
 * One-question-at-a-time scored quiz for Webflow. Questions, weights and score
 * bands live in a JSON config on the page; layout and styling stay in Webflow
 * through template elements. Results can be gated behind a form that posts to
 * an external handler (Pardot) in the background, or through Webflow's own
 * form handling when the form has no action, then unlocked in place.
 * @version 0.3.0
 * @author Liam Miller
 * @repository https://github.com/tahistudio/Tahi-Scripts
 */

(function () {
  'use strict';

  var ADVANCE_MS = 260;
  var SCORE_FINAL_MS = 1200;
  var REDUCED = false;
  try {
    REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function q(root, sel) {
    return root.querySelector(sel);
  }

  function qa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function setText(root, sel, value) {
    qa(root, sel).forEach(function (el) {
      el.textContent = value;
    });
  }

  function push(event, data) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: event };
    for (var k in data) if (data.hasOwnProperty(k)) payload[k] = data[k];
    window.dataLayer.push(payload);
  }

  /* ------------------------------------------------------------------
     SCORING
     Category score = average of answered option scores in that category.
     Overall = category scores weighted, normalised over answered categories,
     rounded and clamped to 1..100.
     ------------------------------------------------------------------ */

  function validIndex(qq, i) {
    return typeof i === 'number' && i % 1 === 0 && i >= 0 && i < qq.options.length;
  }

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function isScored(qq, i) {
    return !!qq.category && validIndex(qq, i) && typeof qq.options[i].score === 'number';
  }

  function score(config, answers) {
    var cats = config.categories.map(function (c) {
      var scores = config.questions
        .filter(function (qq) { return qq.category === c.id && isScored(qq, answers[qq.id]); })
        .map(function (qq) { return qq.options[answers[qq.id]].score; });
      var avg = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : null;
      return { id: c.id, title: c.title, weight: c.weight, raw: avg, score: avg === null ? null : Math.round(avg) };
    });

    var wSum = 0;
    var total = 0;
    cats.forEach(function (c) {
      if (c.raw === null) return;
      wSum += c.weight;
      total += c.weight * c.raw;
    });
    var overall = wSum ? Math.round(total / wSum) : 0;
    overall = Math.max(1, Math.min(100, overall));

    var tiers = config.tiers.slice().sort(function (a, b) { return b.min - a.min; });
    var tier = tiers.filter(function (t) { return overall >= t.min; })[0] || tiers[tiers.length - 1];

    var below = config.recommendationBelow == null ? 60 : config.recommendationBelow;
    var recs = [];
    config.questions.forEach(function (qq) {
      var i = answers[qq.id];
      if (!isScored(qq, i)) return;
      var opt = qq.options[i];
      if (opt.recommendation && opt.score < below) {
        recs.push({ question: qq.id, score: opt.score, title: opt.recommendation.title, description: opt.recommendation.description });
      }
    });
    recs.sort(function (a, b) { return a.score - b.score; });

    return { overall: overall, tier: tier, categories: cats, recommendations: recs };
  }

  /* ------------------------------------------------------------------
     QUIZ
     ------------------------------------------------------------------ */

  function init(root) {
    if (root.getAttribute('data-sq-ready') === '1') return;
    var cfgEl = q(root, 'script[data-sq-config]');
    if (!cfgEl) return console.warn('Scored Quiz: missing <script type="application/json" data-sq-config>');

    var config;
    try {
      config = JSON.parse(cfgEl.textContent);
    } catch (e) {
      return console.error('Scored Quiz: config is not valid JSON', e);
    }
    root.setAttribute('data-sq-ready', '1');

    var id = root.getAttribute('data-sq') || config.id || 'quiz';
    var prefix = config.fieldPrefix || 'sq_';
    var storeKey = 'sq_' + id + '_' + hash(cfgEl.textContent);

    var screens = {
      intro: q(root, '[data-sq-screen="intro"]'),
      question: q(root, '[data-sq-screen="question"]'),
      result: q(root, '[data-sq-screen="result"]'),
    };

    var optionsWrap = q(root, '[data-sq-options]');
    var optionTpl = q(root, '[data-sq-option-template]');
    if (!screens.question || !optionsWrap || !optionTpl) return console.warn('Scored Quiz: missing question screen, [data-sq-options] or [data-sq-option-template]');
    optionTpl.removeAttribute('data-sq-option-template');
    optionTpl.parentNode.removeChild(optionTpl);

    var catWrap = q(root, '[data-sq-categories]');
    var catTpl = catWrap && q(catWrap, '[data-sq-category-template]');
    if (catTpl) {
      catTpl.removeAttribute('data-sq-category-template');
      catTpl.parentNode.removeChild(catTpl);
    }

    var recWrap = q(root, '[data-sq-recommendations]');
    var recTpl = recWrap && q(recWrap, '[data-sq-recommendation-template]');
    if (recTpl) {
      recTpl.removeAttribute('data-sq-recommendation-template');
      recTpl.parentNode.removeChild(recTpl);
    }

    var state = { index: 0, answers: {}, result: null, started: false, completed: false, unlocked: false };
    try {
      var saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved && saved.answers) {
        config.questions.forEach(function (qq) {
          if (validIndex(qq, saved.answers[qq.id])) state.answers[qq.id] = saved.answers[qq.id];
        });
        var idx = typeof saved.index === 'number' ? saved.index : 0;
        state.index = Math.max(0, Math.min(idx, config.questions.length - 1));
        var all = config.questions.every(function (qq) { return state.answers[qq.id] != null; });
        state.completed = !!saved.completed && all;
        state.unlocked = state.completed && !!saved.unlocked;
      }
    } catch (e) {}

    function save() {
      try {
        sessionStorage.setItem(storeKey, JSON.stringify({ index: state.index, answers: state.answers, completed: state.completed, unlocked: state.unlocked }));
      } catch (e) {}
    }

    var gatedEls = qa(root, '[data-sq-gated]');
    var gate = q(root, '[data-sq-gate]');
    var form = gate && (gate.tagName === 'FORM' ? gate : q(gate, 'form'));
    var webflowMode = !!form && !form.getAttribute('action');
    function setGated(locked) {
      gatedEls.forEach(function (el) {
        if (locked) {
          el.setAttribute('inert', '');
          el.setAttribute('aria-hidden', 'true');
        } else {
          el.removeAttribute('inert');
          el.removeAttribute('aria-hidden');
        }
      });
    }

    function show(name) {
      Object.keys(screens).forEach(function (k) {
        if (!screens[k]) return;
        var on = k === name;
        screens[k].hidden = !on;
        screens[k].style.display = on ? '' : 'none';
      });
      root.setAttribute('data-sq-state', name);
    }

    function focusHeading(screen) {
      var h = q(screen, '[data-sq-focus]') || q(screen, 'h1, h2, h3');
      if (!h) return;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      try {
        h.focus({ preventScroll: true });
      } catch (e) {}
    }

    function renderQuestion() {
      var total = config.questions.length;
      var qq = config.questions[state.index];
      var cat = config.categories.filter(function (c) { return c.id === qq.category; })[0];

      setText(root, '[data-sq-question-text]', qq.text);
      setText(root, '[data-sq-question-number]', String(state.index + 1));
      setText(root, '[data-sq-question-total]', String(total));
      setText(root, '[data-sq-question-category]', cat ? cat.title : '');
      qa(root, '[data-sq-progress-fill]').forEach(function (el) {
        el.style.width = Math.round((state.index / total) * 100) + '%';
      });
      qa(root, '[data-sq-progress]').forEach(function (el) {
        el.setAttribute('role', 'progressbar');
        el.setAttribute('aria-valuemin', '0');
        el.setAttribute('aria-valuemax', String(total));
        el.setAttribute('aria-valuenow', String(state.index));
        if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Quiz progress');
      });

      optionsWrap.innerHTML = '';
      optionsWrap.setAttribute('role', 'radiogroup');
      optionsWrap.setAttribute('aria-label', qq.text);
      var current = validIndex(qq, state.answers[qq.id]) ? state.answers[qq.id] : 0;
      qq.options.forEach(function (opt, i) {
        var el = optionTpl.cloneNode(true);
        var label = q(el, '[data-sq-option-label]') || el;
        label.textContent = opt.label;
        el.setAttribute('role', 'radio');
        var selected = state.answers[qq.id] === i;
        el.setAttribute('aria-checked', selected ? 'true' : 'false');
        el.classList.toggle('is-selected', selected);
        el.setAttribute('tabindex', i === current ? '0' : '-1');
        el.addEventListener('click', function (e) {
          e.preventDefault();
          choose(i, el);
        });
        el.addEventListener('keydown', function (e) {
          var dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
          if (dir) {
            e.preventDefault();
            var opts = qa(optionsWrap, '[role="radio"]');
            var to = opts[(i + dir + opts.length) % opts.length];
            opts.forEach(function (o) { o.setAttribute('tabindex', o === to ? '0' : '-1'); });
            to.focus();
          } else if (el.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            choose(i, el);
          }
        });
        optionsWrap.appendChild(el);
      });

      qa(root, '[data-sq-back]').forEach(function (b) {
        b.style.visibility = state.index === 0 && !screens.intro ? 'hidden' : '';
      });
    }

    var advancing = false;
    var advanceTimer = null;

    function choose(i, el) {
      if (advancing) return;
      var qq = config.questions[state.index];
      state.answers[qq.id] = i;
      qa(optionsWrap, '[role="radio"]').forEach(function (o) {
        o.classList.remove('is-selected');
        o.setAttribute('aria-checked', 'false');
      });
      el.classList.add('is-selected');
      el.setAttribute('aria-checked', 'true');
      advancing = true;
      advanceTimer = window.setTimeout(function () {
        advancing = false;
        advanceTimer = null;
        next();
      }, REDUCED ? 0 : ADVANCE_MS);
    }

    function next() {
      if (state.index < config.questions.length - 1) {
        state.index++;
        save();
        renderQuestion();
        focusHeading(screens.question);
      } else {
        state.completed = true;
        save();
        finish();
      }
    }

    function cancelAdvance() {
      if (advanceTimer) window.clearTimeout(advanceTimer);
      advanceTimer = null;
      advancing = false;
    }

    function back() {
      cancelAdvance();
      if (state.index > 0) {
        state.index--;
        save();
        renderQuestion();
        focusHeading(screens.question);
      } else if (screens.intro) {
        show('intro');
        focusHeading(screens.intro);
      }
    }

    function start(resumed) {
      state.started = true;
      if (!resumed) push('sq_start', { quiz_id: id });
      show('question');
      renderQuestion();
      focusHeading(screens.question);
    }

    function animateScore(el, to) {
      if (REDUCED) {
        el.textContent = String(to);
        return;
      }
      var t0 = null;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 900);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
      window.setTimeout(function () {
        el.textContent = String(to);
      }, SCORE_FINAL_MS);
    }

    function finish(resumed) {
      var r = (state.result = score(config, state.answers));
      setGated(!state.unlocked);
      root.setAttribute('data-sq-tier', String(r.tier.key || r.tier.label).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      qa(root, '[data-sq-score]').forEach(function (el) {
        animateScore(el, r.overall);
      });
      setText(root, '[data-sq-tier-label]', r.tier.label);
      setText(root, '[data-sq-tier-description]', r.tier.description || '');
      qa(root, '[data-sq-score-fill]').forEach(function (el) {
        el.style.width = r.overall + '%';
      });

      if (catWrap && catTpl) {
        catWrap.innerHTML = '';
        r.categories.forEach(function (c) {
          if (c.score === null) return;
          var el = catTpl.cloneNode(true);
          setText(el, '[data-sq-category-name]', c.title);
          setText(el, '[data-sq-category-score]', String(c.score));
          qa(el, '[data-sq-category-fill]').forEach(function (f) {
            f.style.width = c.score + '%';
          });
          catWrap.appendChild(el);
        });
      }

      if (recWrap && recTpl) {
        recWrap.innerHTML = '';
        var max = config.maxRecommendations || 5;
        r.recommendations.slice(0, max).forEach(function (rec) {
          var el = recTpl.cloneNode(true);
          setText(el, '[data-sq-recommendation-title]', rec.title);
          setText(el, '[data-sq-recommendation-description]', rec.description);
          recWrap.appendChild(el);
        });
        qa(root, '[data-sq-no-recommendations]').forEach(function (el) {
          el.style.display = r.recommendations.length ? 'none' : '';
        });
      }

      if (form) fillFields(r);
      if (!resumed) push('sq_complete', { quiz_id: id, quiz_score: r.overall, quiz_tier: r.tier.label });
      show('result');
      if (state.unlocked) root.setAttribute('data-sq-unlocked', '1');
      /* Focus once the score has finished counting, so screen readers announce the final value */
      if (!resumed) {
        window.setTimeout(function () {
          focusHeading(screens.result);
        }, REDUCED ? 0 : SCORE_FINAL_MS + 50);
      }
    }

    function restart() {
      cancelAdvance();
      if (form && webflowMode) {
        /* webflow.js hid the form and showed the success block; reset for a fresh lead */
        var done = form.parentNode && q(form.parentNode, '.w-form-done');
        form.style.display = '';
        if (done) done.style.display = 'none';
        watchWebflowSuccess();
      }
      state.index = 0;
      state.completed = false;
      state.unlocked = false;
      state.answers = {};
      state.result = null;
      root.removeAttribute('data-sq-unlocked');
      root.removeAttribute('data-sq-tier');
      try {
        sessionStorage.removeItem(storeKey);
      } catch (e) {}
      if (screens.intro) {
        show('intro');
        focusHeading(screens.intro);
      } else {
        start();
      }
    }

    /* Gate: the form posts to its own action (Pardot) in a hidden iframe,
       with the score and answers attached, then the results unlock. The
       spam guard listens on window in the capture phase, so it still runs
       first and stops spam before this handler. */

    function hidden(form, name, value) {
      var input = form.querySelector('input[type="hidden"][name="' + name + '"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
      }
      input.value = value;
    }

    function unlock() {
      state.unlocked = true;
      save();
      setGated(false);
      root.setAttribute('data-sq-unlocked', '1');
      var target = q(root, '[data-sq-unlocked-focus]') || recWrap || catWrap;
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        try {
          target.focus();
        } catch (e) {}
      }
    }

    function fillFields(r) {
      hidden(form, prefix + 'score', String(r.overall));
      hidden(form, prefix + 'tier', r.tier.label);
      r.categories.forEach(function (c) {
        if (c.score !== null) hidden(form, prefix + 'cat_' + c.id, String(c.score));
      });
      hidden(form, prefix + 'answers', config.questions.filter(function (qq) { return qq.category; }).map(function (qq) {
        var i = state.answers[qq.id];
        return qq.id + '=' + (isScored(qq, i) ? qq.options[i].score : '');
      }).join(';'));
      config.questions.forEach(function (qq) {
        var i = state.answers[qq.id];
        if (qq.field && validIndex(qq, i)) hidden(form, prefix + qq.field, qq.options[i].label);
      });
      hidden(form, prefix + 'source', id);
    }

    /* Webflow-handled form (no action): webflow.js submits it and shows the
       success block. Unlock when that block appears, never on failure. */
    function watchWebflowSuccess() {
      var block = form.parentNode;
      var done = block && q(block, '.w-form-done');
      if (!done || !window.MutationObserver) return;
      var obs = new MutationObserver(function () {
        if (done.style.display && done.style.display !== 'none') {
          obs.disconnect();
          unlock();
        }
      });
      obs.observe(done, { attributes: true, attributeFilter: ['style'] });
    }

    if (form) {
      if (webflowMode) watchWebflowSuccess();
      form.addEventListener(
        'submit',
        function (e) {
          if (form.checkValidity && !form.checkValidity()) return;
          var r = state.result || score(config, state.answers);
          fillFields(r);

          if (webflowMode) {
            push('sq_lead', { quiz_id: id, quiz_score: r.overall, quiz_tier: r.tier.label });
            return;
          }
          if (root.getAttribute('data-sq-submit-mode') === 'native') return;

          e.preventDefault();
          e.stopPropagation();
          var sinkId = 'sq-sink-' + id;
          var sink = document.getElementById(sinkId);
          if (!sink) {
            sink = document.createElement('iframe');
            sink.id = sink.name = sinkId;
            sink.setAttribute('aria-hidden', 'true');
            sink.setAttribute('tabindex', '-1');
            sink.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px;';
            document.body.appendChild(sink);
          }
          form.target = sinkId;
          var btn = q(form, '[type="submit"]');
          var original = btn && (btn.tagName === 'INPUT' ? btn.value : btn.innerHTML);
          if (btn) {
            btn.disabled = true;
            if (btn.tagName === 'INPUT') btn.value = btn.getAttribute('data-wait') || 'Please wait...';
          }
          try {
            HTMLFormElement.prototype.submit.call(form);
          } catch (err) {
            form.target = '';
            return form.submit();
          }
          push('sq_lead', { quiz_id: id, quiz_score: r.overall, quiz_tier: r.tier.label });
          window.setTimeout(function () {
            if (btn) {
              btn.disabled = false;
              if (btn.tagName === 'INPUT') btn.value = original;
            }
            unlock();
          }, 600);
        },
        false,
      );
    }

    qa(root, '[data-sq-start]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        start();
      });
    });
    qa(root, '[data-sq-back]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        back();
      });
    });
    qa(root, '[data-sq-restart]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        restart();
      });
    });

    var resumed = Object.keys(state.answers).length > 0;
    if (state.completed) {
      state.started = true;
      finish(true);
    } else if (screens.intro && !resumed) {
      show('intro');
    } else {
      start(resumed);
    }
  }

  function boot() {
    qa(document, '[data-sq]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.TahiScoredQuiz = { score: score, version: '0.3.0' };
})();
