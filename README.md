# Tahi Scripts

A collection of lightweight, performant utility scripts for Webflow projects.

## Available Scripts

### Before-After Comparison
A lightweight image comparison script for before/after effects.

```html
<!-- Latest version -->
<script src="https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@main/dist/before-after.js"></script>

<!-- Specific version -->
<script src="https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@1.0.0/dist/before-after.js"></script>
```

[View Documentation](src/features/before-after/DOCS.md)

### Form Visualizer
A form state visualization tool for complex forms.

```html
<!-- Latest version -->
<script src="https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@main/dist/form-visualizer.js"></script>

<!-- Specific version -->
<script src="https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@1.0.0/dist/form-visualizer.js"></script>
```

[View Documentation](src/features/form-visualizer/DOCS.md)

### Scored Quiz
One-question-at-a-time scored quiz with weighted categories, score bands, recommendations and a gated results form that posts to Pardot or HubSpot without leaving the page. Pin it to a commit.

```html
<script src="https://cdn.jsdelivr.net/gh/tahistudio/Tahi-Scripts@COMMIT_SHA/dist/scored-quiz.js"></script>
```

[View Documentation](src/features/scored-quiz/DOCS.md)

## Usage with jsDelivr CDN

All scripts are available through jsDelivr's CDN. You can use either:

1. Latest version (from main branch):
```html
https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@main/dist/[script-name].js
```

2. Specific version:
```html
https://cdn.jsdelivr.net/gh/LiamMillerDev/Tahi-Scripts@[version]/dist/[script-name].js
```

## Development

1. Clone the repository:
```bash
git clone https://github.com/LiamMillerDev/Tahi-Scripts.git
```

2. Install dependencies:
```bash
npm install
```

3. Build the scripts:
```bash
npm run build
```

This will:
- Clean the dist directory
- Build and minify all scripts
- Automatically commit the dist files

## Contributing

1. Create a new feature directory in `src/features/`
2. Follow the existing structure:
   - `feature-name.js` - Main script file
   - `DOCS.md` - Documentation
   - `PLAN.md` - Implementation plan
3. Build and test your feature
4. Submit a pull request

## License

MIT License - see LICENSE file for details 
