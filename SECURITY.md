# Security Policy

## Supported Versions

This is a small personal project with a single deployed version — there are no
maintained older releases. Security fixes are applied to the `main` branch
and deployed as a new Apps Script web app version.

## Reporting a Vulnerability

This app runs as a private Google Apps Script web app backed by a personal
Google Sheet. It isn't intended for public/multi-tenant use, but if you find a security issue (e.g. a way to access or modify data you shouldn't be able to, or a script injection/XSS vector), please report it privately rather than opening a public issue:

- Email: vanbiljonheini@gmail.com

Please include:

- A description of the issue and its potential impact
- Steps to reproduce (or a proof of concept)
- Any relevant logs or screenshots

You should receive an acknowledgement within a few days. Please allow time for a fix to be deployed before disclosing the issue publicly.

## Scope Notes

- This app does not implement its own authentication — access is controlled entirely by the Apps Script deployment's sharing settings and the bound Google Sheet's permissions.
- Fish-catch photos are stored in a Google Drive folder configured on the Settings tab; that folder's own Drive sharing settings determine who can view uploaded photos.
