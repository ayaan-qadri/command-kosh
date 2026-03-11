# Security

## Keep in Mind

Command Kosh stores your commands **locally only**. No data is sent to any remote server for core functionality.

Every save is signed with HMAC-SHA256. The signing key lives in your OS keyring and never touches disk as plain text. On launch, the app verifies the file against its signature and blocks execution if anything doesn't match.

## Do

- Keep your OS and Command Kosh up to date
- Review commands before running them, especially if shared by others
- Treat your stored commands like any other script - don't store plain-text secrets inside them

## Don't

- Share your `.sig` files or keyring credentials
- Run commands from untrusted sources without reviewing them first
- Assume the app protects you from malicious commands you intentionally run yourself
