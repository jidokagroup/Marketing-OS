# JIDOKA Marketing OS Chrome Extension

This is the first-pass Chrome connector for the Content Generator competitor
watchlist.

## Install locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this `chrome-extension` folder.
6. Open JIDOKA Marketing OS.
7. Go to `Content > Content Generator`.
8. Click `Connect to Chrome extension`.

## What it scans

The extension opens the watchlist profile URLs in inactive Chrome tabs and
captures visible page text, titles, headings, and descriptions from public
social/profile pages. It uses the user's normal logged-in Chrome session.

It skips obvious private or account-management routes such as inbox, direct
messages, notifications, settings, login, and account pages.

## What it does not collect

- Passwords
- Cookies
- Private messages
- Hidden account data
- Payment or account settings

The scan result is passed into the Marketing OS page and submitted with the
`Generate Ideas` form.
