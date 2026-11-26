# Project report (LaTeX)

`main.tex` is the CSE731 final project report; `figures/` holds its images.

## Compile

**Overleaf:** zip this `docs/report` folder, choose *New Project → Upload
Project*, and compile with **pdfLaTeX** (the default).

**Locally** (TeX Live or MiKTeX):

```bash
cd docs/report
pdflatex main.tex
pdflatex main.tex   # second run fills in the table of contents and references
```

Rename the output to `MT2025066_MT2025027.pdf` for submission.

Before compiling, set the lecturer's name in the `\lecturer` command near the
top of `main.tex`.

## Regenerating the screenshots

With the API on :5000 (test database) and the React build on :3000 running,
and a Playwright HTML report in `e2e-tests/playwright-report`:

```bash
cd e2e-tests
node scripts/capture-report-figures.js
```
