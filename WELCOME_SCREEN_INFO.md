# Welcome Screen Behavior

## How It Works

The welcome screen uses **sessionStorage** (not localStorage), which means:

- **Shows once per browser session**: When you first visit the dashboard in a new browser tab/window
- **Persists while tab is open**: Once you click "Enter Dashboard", you won't see it again in that same tab
- **Resets when browser closes**: When you close the browser tab/window, sessionStorage is cleared
- **Shows again on next visit**: When you open the dashboard in a new session, the welcome screen will appear again

## Not Time-Based

- ❌ **NOT** based on 24 hours
- ❌ **NOT** based on any time period
- ✅ **IS** based on browser sessions

## Why sessionStorage?

This provides a good user experience:
- First-time visitors see the welcome screen
- Users who keep the tab open don't see it repeatedly
- Users get a fresh welcome when they return in a new session

If you want it to show less frequently (e.g., only once per day), we can switch to localStorage with a timestamp check.

