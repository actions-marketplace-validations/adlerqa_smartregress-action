'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getInput(name) {
  const key = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  return (process.env[key] || '').trim();
}

function toBool(v, defaultValue = false) {
  if (!v) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

function writeOutput(name, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) return;
  fs.appendFileSync(outFile, `${name}=${value}\n`, 'utf8');
}

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(cmd, args, opts = {}) {
  console.log(`▶️ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

async function postPrComment({ repo, prNumber, token, body }) {
  // PR comments are Issue comments API: POST /repos/{owner}/{repo}/issues/{issue_number}/comments
  const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'smartregress-actions',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to comment on PR: ${res.status} ${res.statusText} - ${text}`);
  }
}

function redact(s) {
  if (!s) return '';
  if (s.length <= 10) return '***';
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

(async function main() {
  try {
    const repo = getInput('repo') || process.env.GITHUB_REPOSITORY;
    const prNumber = getInput('pr_number');
    const outputDir = getInput('output_dir') || './out';

    const openaiKey = getInput('openai_api_key');
    const model = getInput('model') || 'gpt-4o-mini';

    const githubToken = getInput('github_token'); // optional
    const commentOnPr = toBool(getInput('comment_on_pr'), true);

    const cliRepo = getInput('cli_repo') || 'adlerqa/smartregress-cli';
    const cliRef = getInput('cli_ref') || 'main';

    if (!repo) throw new Error('Missing repo (owner/name).');
    if (!prNumber) throw new Error('Missing pr_number input.');
    if (!openaiKey) throw new Error('Missing openai_api_key input.');

    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const absOut = path.resolve(workspace, outputDir);
    safeMkdir(absOut);

    const tempBase = process.env.RUNNER_TEMP || path.join(workspace, '.tmp');
    safeMkdir(tempBase);

    const cliDir = path.join(tempBase, `smartregress-cli-${Date.now()}`);

    // Clone CLI (use token if provided)
    let cloneUrl = `https://github.com/${cliRepo}.git`;
    if (githubToken) {
      // token-in-url needs encoding
      const enc = encodeURIComponent(githubToken);
      cloneUrl = `https://x-access-token:${enc}@github.com/${cliRepo}.git`;
    }

    run('git', ['clone', '--depth', '1', '--branch', cliRef, cloneUrl, cliDir]);

    // Write CLI config inside cloned repo
    const configPath = path.join(cliDir, 'smartregress.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ apiKey: openaiKey, model }, null, 2),
      'utf8'
    );

    console.log(`✅ Wrote config: ${configPath} (apiKey=${redact(openaiKey)}, model=${model})`);

    // If/when CLI supports GitHub token, we already pass it via env for future-proofing.
    const env = { ...process.env };
    if (githubToken) env.SMARTREGRESS_GITHUB_TOKEN = githubToken;

    // Run analyze
    run(
      'node',
      ['src/cli/index.js', 'analyze', '--repo', repo, '--pr', String(prNumber), '--out', absOut],
      { cwd: cliDir, env }
    );

    const summaryPath = path.join(absOut, 'summary.md');
    const resultsPath = path.join(absOut, 'results.json');

    if (!fs.existsSync(summaryPath)) throw new Error(`summary.md not found at ${summaryPath}`);
    if (!fs.existsSync(resultsPath)) throw new Error(`results.json not found at ${resultsPath}`);

    writeOutput('summary_path', summaryPath);
    writeOutput('results_path', resultsPath);

    // Optional PR comment
    if (commentOnPr) {
      if (!githubToken) {
        console.log('⚠️ comment_on_pr=true but github_token not provided. Skipping PR comment.');
      } else {
        const summary = fs.readFileSync(summaryPath, 'utf8');
        const body =
          `## 🤖 SmartRegress Report\n\n` +
          `**Repo:** \`${repo}\`\n` +
          `**PR:** #${prNumber}\n\n` +
          summary.slice(0, 60000);

        await postPrComment({ repo, prNumber, token: githubToken, body });
        console.log('✅ Posted SmartRegress summary as PR comment.');
      }
    }

    console.log('🎉 SmartRegress Action finished successfully.');
  } catch (err) {
    console.error(`::error::${err?.message || String(err)}`);
    process.exit(1);
  }
})();