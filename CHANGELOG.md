# Change Log

All notable changes to the "linear-connect" extension will be documented in this file.

## [Unreleased]

### Added
- Task Detail panel — click an issue in the Linear sidebar to open an in-IDE detail tab
- Edit issue title, description, status, and priority from the panel
- Add comments from the panel
- View sub-issues and labels inline
- Context menu: Open Issue in Browser
- Project Kanban board — open from sidebar project click or **Linear: Open Project Board** command
- List view toggle with sortable columns and inline status changes
- Drag-and-drop status changes on Kanban cards (optimistic UI)
- Board filters: status, label, assignee, and title search
- Phase-label swimlane grouping (default; configurable via `linear.board.phaseLabelPrefix`)
- Virtualized scrolling for large projects with paginated load-more
- Click board card → opens existing Task Detail panel
- Context menu: Open Project in Browser

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
