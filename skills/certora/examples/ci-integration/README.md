# Certora CI Integration

GitHub Actions workflow for running Certora verification on every pull request, with caching, parallel rule execution, and result interpretation.

## Basic Workflow

Create `.github/workflows/certora.yml`:

```yaml
name: Certora Verification
on:
  pull_request:
    paths:
      - "src/**"
      - "specs/**"
      - "certora/**"
  push:
    branches: [main]

jobs:
  certora:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "11"

      - name: Install solc
        run: |
          pip install solc-select
          solc-select install 0.8.28
          solc-select use 0.8.28

      - name: Install Certora CLI
        run: pip install certora-cli

      - name: Install project dependencies
        run: npm ci

      - name: Run verification
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: certoraRun certora/Token.conf
```

## Multi-Spec Parallel Verification

When you have multiple specs (token, vault, staking), run them in parallel using a matrix strategy.

```yaml
name: Certora Verification Suite
on:
  pull_request:
    paths:
      - "src/**"
      - "specs/**"
      - "certora/**"

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    strategy:
      fail-fast: false
      matrix:
        spec:
          - name: "Token"
            conf: "certora/Token.conf"
          - name: "Vault"
            conf: "certora/Vault.conf"
          - name: "Staking"
            conf: "certora/Staking.conf"

    name: Verify ${{ matrix.spec.name }}

    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "11"

      - name: Install toolchain
        run: |
          pip install solc-select certora-cli
          solc-select install 0.8.28
          solc-select use 0.8.28

      - name: Install dependencies
        run: npm ci

      - name: Run ${{ matrix.spec.name }} verification
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: certoraRun ${{ matrix.spec.conf }}
```

## Caching Dependencies

Speed up CI by caching Python packages, node_modules, and solc binaries.

```yaml
      - uses: actions/cache@v4
        with:
          path: |
            ~/.solc-select
            ~/.cache/pip
            node_modules
          key: certora-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            certora-${{ runner.os }}-
```

## Running Only Changed Specs

For large projects, detect which contracts changed and run only their specs:

```yaml
      - name: Detect changed contracts
        id: changes
        uses: dorny/paths-filter@v3
        with:
          filters: |
            token:
              - 'src/Token.sol'
              - 'specs/Token.spec'
              - 'certora/Token.conf'
            vault:
              - 'src/Vault.sol'
              - 'specs/Vault.spec'
              - 'certora/Vault.conf'

      - name: Verify Token
        if: steps.changes.outputs.token == 'true'
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: certoraRun certora/Token.conf

      - name: Verify Vault
        if: steps.changes.outputs.vault == 'true'
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: certoraRun certora/Vault.conf
```

## Running Specific Rules on PRs

For faster PR feedback, run only critical rules on PRs and the full suite on main.

```yaml
jobs:
  quick-verify:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      # ... setup steps ...

      - name: Run critical rules only
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: |
          certoraRun certora/Token.conf \
            --rule totalSupplyEqualsSumOfBalances,transferPreservesTotalSupply

  full-verify:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      # ... setup steps ...

      - name: Run full verification
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: certoraRun certora/Token.conf
```

## Secrets Setup

1. Go to your GitHub repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Name: `CERTORAKEY`
4. Value: your Certora API key from https://www.certora.com/signup

Never commit the API key to your repository. The `CERTORAKEY` environment variable is the only supported method.

## Interpreting CI Results

### Successful Run

The `certoraRun` command exits with code 0 when all rules pass. It prints a dashboard URL:

```
Job submitted successfully.
Follow the results at: https://prover.certora.com/output/...
```

### Failed Run

Exit code 1 means at least one rule failed. The output includes:

```
Rule transferPreservesTotalSupply: FAIL
Counter-example found. See report: https://prover.certora.com/output/...
```

Click the link to see the counter-example with concrete values.

### Timeout

If verification exceeds `smt_timeout` (default 600s per rule), the rule is marked `TIMEOUT`. Increase the timeout or simplify the rule:

```json
{
    "smt_timeout": "1200",
    "prover_args": ["-depth 10"]
}
```

### Vacuous Rules

With `rule_sanity: basic`, the report flags rules that pass vacuously. These are false positives — the rule passes because no valid execution exists, not because the property holds. Fix by relaxing `require` constraints.

## Makefile for Local Development

Create a `Makefile` to mirror CI locally:

```makefile
.PHONY: verify-token verify-vault verify-all

verify-token:
	certoraRun certora/Token.conf

verify-vault:
	certoraRun certora/Vault.conf

verify-all: verify-token verify-vault

# Run single rule for debugging
verify-rule:
	certoraRun certora/Token.conf --rule $(RULE)

# Example: make verify-rule RULE=transferPreservesTotalSupply
```

## PR Comment Bot (Optional)

Post verification results as a PR comment using the Certora output URL:

```yaml
      - name: Run verification
        id: certora
        env:
          CERTORAKEY: ${{ secrets.CERTORAKEY }}
        run: |
          OUTPUT=$(certoraRun certora/Token.conf 2>&1) || true
          URL=$(echo "$OUTPUT" | grep -o 'https://prover.certora.com/output/[^ ]*' || echo "No URL found")
          echo "report_url=$URL" >> "$GITHUB_OUTPUT"
          echo "$OUTPUT"
          echo "$OUTPUT" | grep -q "FAIL" && exit 1 || exit 0

      - name: Comment PR with results
        if: always() && github.event_name == 'pull_request'
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: certora-results
          message: |
            ## Certora Verification Results

            Report: ${{ steps.certora.outputs.report_url }}

            Status: ${{ steps.certora.outcome == 'success' && 'All rules passed' || 'Some rules failed — check report' }}
```

Last verified: February 2026
