
# SmartRegress GitHub Action
🔍 AI-Powered Regression Test Selection for Pull Requests

This GitHub Action runs SmartRegress, an AI-powered regression-analysis engine that:

✔ Analyzes PR diff
✔ Detects impacted areas
✔ Selects & prioritizes relevant tests
✔ Works with mono-repo & multi-repo test suites
✔ Generates JSON/Markdown output

SmartRegress CLI:
👉 https://www.npmjs.com/package/smartregress

## 🚀 Usage (Simple Example)
name: SmartRegress Analysis

on:
  pull_request:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run SmartRegress
        uses: adlerqa/smartregress-action@v1
        with:
          pr-number: ${{ github.event.pull_request.number }}
          pat: ${{ secrets.GITHUB_PAT }}

## ⚙️ Advanced Usage (All Options)
uses: adlerqa/smartregress-action@v1
with:
  repo: percona/pmm
  pr-number: 4870
  test-repo: percona/pmm-qa@main,qa-team/tests@develop
  test-roots: tests,e2e_tests/tests
  pat: ${{ secrets.GITHUB_PAT }}
  model: gpt-4o-mini
  out: .smartregress
  debug: true

## 🔧 Inputs
Input	Required	Description
repo	No	Repository to analyze (defaults to current repo)
pr-number	Yes	Pull Request number
test-repo	No	External test repos (comma-separated)
test-roots	No	Test directories (comma-separated)
pat	No*	GitHub PAT (required if repo is private or rate limit exceeded)
model	No	AI model name
out	No	Output folder
debug	No	Enable verbose logs
## 📦 Outputs

SmartRegress can generate:

analysis.json

summary.md

impactedTests.json

results.json

These can be stored as workflow artifacts.

## 🧪 Example: Upload Results
- uses: actions/upload-artifact@v4
  with:
    name: smartregress-results
    path: .smartregress

## 🏷 Versioning

Use the stable tag:

uses: adlerqa/smartregress-action@v1


And update it when you publish new versions.

## 📄 License

Apache-2.0