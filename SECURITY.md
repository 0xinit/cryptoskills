# Security Policy

## Reporting a Vulnerability

CryptoSkills is a directory of agent skills (documentation and code examples). It does not run production infrastructure or handle user funds.

If you discover a security issue — such as hardcoded secrets, malicious code in a skill, or a vulnerability in the website — please report it responsibly:

1. **Do not open a public issue.** Instead, email the maintainers or use [GitHub's private vulnerability reporting](https://github.com/0xinit/cryptoskills/security/advisories/new).
2. Include a description of the issue, affected files, and steps to reproduce.
3. We will acknowledge receipt within 48 hours and provide a fix timeline.

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Hardcoded secrets or API keys in skill files | Vulnerabilities in third-party protocols referenced by skills |
| XSS or injection in the website (cryptoskills.dev) | Security of example code when deployed to production |
| Malicious code injected via skill contributions | Theoretical issues in code snippets meant for illustration |
| Exposed credentials in git history | Protocol-level bugs in DeFi/infrastructure projects |

## Best Practices for Contributors

- Never commit private keys, API keys, or `.env` files
- Use `process.env` for all secrets in templates and examples
- Verify contract addresses onchain before including them
- Flag any suspicious content in skill submissions during PR review
