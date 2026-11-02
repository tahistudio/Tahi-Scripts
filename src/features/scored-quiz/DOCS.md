# Scored Quiz

One-question-at-a-time scored quiz for Webflow. Questions, weights and score bands live in a JSON config inside the quiz; layout and styling stay in Webflow through template elements. Results can be gated behind a form that posts to an external handler (Pardot, HubSpot) in a hidden iframe, then unlocked in place.

## Installation

Page settings > Before </body>. Pin to a commit.

```html
<script src="https://cdn.jsdelivr.net/gh/tahistudio/Tahi-Scripts@COMMIT_SHA/dist/scored-quiz.js"></script>
```

## Structure

```html
<div data-sq="quiz-id">
  <script type="application/json" data-sq-config>{ ...config... }</script>  <!-- in an HTML embed -->

  <div data-sq-screen="intro"> ... <a data-sq-start>Start</a></div>           <!-- optional -->

  <div data-sq-screen="question">
    <span data-sq-question-category></span>
    Question <span data-sq-question-number></span> of <span data-sq-question-total></span>
    <div data-sq-progress><div data-sq-progress-fill></div></div>
    <h2 data-sq-question-text data-sq-focus></h2>
    <div data-sq-options>
      <a data-sq-option-template><span data-sq-option-label></span></a>   <!-- cloned per answer -->
    </div>
    <a data-sq-back>Back</a>
  </div>

  <div data-sq-screen="result">
    <span data-sq-score></span> <div data-sq-tier-label></div> <p data-sq-tier-description></p>
    <div data-sq-gate> ...Webflow form... </div>
    <div data-sq-gated>
      <div data-sq-categories><div data-sq-category-template> [data-sq-category-name] [data-sq-category-score] [data-sq-category-fill] </div></div>
      <div data-sq-recommendations><div data-sq-recommendation-template> [data-sq-recommendation-title] [data-sq-recommendation-description] </div></div>
      <p data-sq-no-recommendations>No major gaps found.</p>
    </div>
    <a data-sq-restart>Retake</a>
  </div>
</div>
```

Templates are removed and cloned at runtime, so they stay visible and styleable in the Designer.

## Config

```json
{
  "fieldPrefix": "sq_",
  "maxRecommendations": 5,
  "recommendationBelow": 60,
  "categories": [{ "id": "connectivity", "title": "Connectivity", "weight": 0.25 }],
  "questions": [
    { "id": "employees", "field": "employees", "text": "...", "options": [{ "label": "1-10" }] },
    { "id": "failover", "category": "connectivity", "text": "...",
      "options": [{ "label": "Automatic", "score": 100 },
                  { "label": "None", "score": 0, "recommendation": { "title": "...", "description": "..." } }] }
  ],
  "tiers": [{ "min": 90, "label": "...", "description": "..." }, { "min": 0, "label": "...", "description": "..." }]
}
```

- Questions with a `category` and numeric option scores are scored. Others are context only; with a `field`, the chosen label is sent as a hidden field.
- Score: each category is the average of its answered option scores; overall is the weighted average across answered categories, rounded and clamped to 1..100.
- Recommendations come from chosen options scoring below `recommendationBelow`, lowest first, up to `maxRecommendations`.

## Gate and fields sent

On submit the form gets hidden fields: `{prefix}score`, `{prefix}tier`, `{prefix}cat_{id}`, `{prefix}answers` (`id=score;...`), `{prefix}{field}` per context question, and `{prefix}source`. The form posts to its own action in a hidden iframe, then the root gets `data-sq-unlocked="1"`. Add `data-sq-submit-mode="native"` on the root to post normally instead. A spam guard listening on window in the capture phase (form-guard) still runs first.

## State and events

- Root attributes: `data-sq-state` (intro, question, result), `data-sq-tier` (slug of the band label), `data-sq-unlocked`.
- Progress is kept in sessionStorage so a reload resumes.
- dataLayer events: `sq_start`, `sq_complete` (quiz_score, quiz_tier), `sq_lead`.

## Page CSS needed (Webflow cannot express these attribute states)

```css
[data-sq]:not([data-sq-state]) [data-sq-screen]:not([data-sq-screen="intro"]){display:none}
[data-sq] [data-sq-gated]{filter:blur(6px);pointer-events:none;user-select:none}
[data-sq][data-sq-unlocked="1"] [data-sq-gated]{filter:none;pointer-events:auto;user-select:auto}
[data-sq][data-sq-unlocked="1"] [data-sq-gate]{display:none}
```
