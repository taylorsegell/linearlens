# Change Log

All notable changes to **Linear Lens** (`taylorsegell.linearlens`) are documented in this file.

## [1.0.0] - 2026-07-19

First marketplace release under publisher `taylorsegell` as **Linear Lens**.

### Added
- Linear sidebar — Issues, Projects, Initiatives, Reviews (Personal API key)
- Issue Detail panel — edit title, description, status, priority, assignee, labels; comments; clickable sub-issues
- Project Detail panel — overview, milestones, recent issues, editable description
- Project Kanban + List boards — DnD status, filters, phase swimlanes, virtualized scrolling
- OAuth authentication provider id `linearlens` (registered; Accounts sign-in deferred — API key powers the UI for 1.0.0)
- Board setting `linear.board.phaseLabelPrefix`

### Changed
- Extension id is now `taylorsegell.linearlens` (was `linear.linear-connect` in the upstream auth-provider lineage)
- OAuth redirect URIs are `${uriScheme}://taylorsegell.linearlens/callback`

### Notes
- Agent assignment is not included in 1.0.0
- Packaging builds both the extension host bundle and the webview on publish

---

## History (linear-connect lineage)

Prior versions below refer to the upstream Linear Connect auth-provider package before the Linear Lens product cut.

## [2.0.0] - 2026-06-22

### Added
- Refresh token support for Linear's 2026 OAuth model (access tokens expire after ~24 hours)
- Automatic token refresh when sessions are requested
- Token revocation on logout via Linear's `/oauth/revoke` endpoint
- Unit tests for OAuth, scope, and session storage modules
- CI workflow

### Changed
- Scope-aware `getSessions` — returns only sessions matching requested scopes
- Replaced `@linear/sdk` viewer lookup with direct GraphQL fetch (smaller bundle)
- Minimum VS Code version raised to 1.96.0
- Removed redundant `activationEvents` (implicit activation since VS Code 1.74)

### Removed
- Dependencies: `@linear/sdk`, `node-fetch`, `uuid`

### Breaking
- Existing stored sessions without refresh tokens are invalidated; users must sign in again once after upgrading

## [1.0.3] - 2022-05-19

- Correctly pass along requested auth scopes

## [1.0.2] - 2022-04-04

- Assets change

## [1.0.1] - 2022-04-02

- Some polish and changes to documentation.

## [1.0.0] - 2022-04-01

- Initial release, adding the "linearapp" authentication provider.
