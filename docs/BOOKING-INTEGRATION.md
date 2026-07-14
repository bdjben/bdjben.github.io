# Booking integration

## Purpose

The website separates two commercially different paths:

1. **Outcome-based engagements** remain in the homepage engagement menu. Diagnostics, foundations, operating-system builds, and retainers are scoped as deliverables.
2. **Calendar-based sessions** live at `/book/`. Exploratory calls, advisory time, project build sessions, and installation holds retain the current YouCanBook.me prices and move directly to the selected appointment's date picker.

This separation preserves the current public pricing while avoiding the implication that a larger implementation is sold as an hourly booking.

## Technical approach

YouCanBook.me sends `X-Frame-Options: DENY`, so its date picker cannot be responsibly embedded in the website. The staged design instead uses appointment-specific links in this form:

```text
https://benbadejo.youcanbook.me/selectTime?appointmentTypeIds=<appointment-type-id>
```

The provider creates a fresh booking intent and opens the calendar with the appointment type already selected. Links open in a new tab so visitors can return to the service description without losing their place.

## Current appointment mapping

| Website label | Duration | Price | Appointment type |
| --- | ---: | ---: | --- |
| Initial Exploratory Call | 30 minutes | $100 | `jsid3277851` |
| Extended Exploratory Call | 60 minutes | $125 | `jsid982392` |
| Advisory / Teaching Session | 60 minutes | $175 | `jsid6259313` |
| Project Build Session | 60 minutes | $250 | `jsid4735414` |
| OpenClaw Standard Installation | 3-hour booking hold | $1,000 | `jsid3830076` |
| OpenClaw Power User Installation | 3-hour booking hold | $2,500 | `jsid2634290` |

The direct-link pattern was verified against the live scheduler on July 14, 2026.

## Pricing decision still open

No engagement or appointment price was changed in this production migration. Three coherent future models are available:

### 1. Keep the split model

Use YouCanBook.me for clearly bounded paid time and quote larger engagements around outcomes. This is the least disruptive option and is the current staged design.

### 2. Make exploratory calls a qualification funnel

Offer one shorter no-cost or credited discovery call, then convert qualified work into a paid diagnostic or fixed-scope engagement. This lowers initial friction but requires tighter qualification and calendar controls.

### 3. Consolidate around paid diagnostics

Remove most public hourly options for new clients. Route new work into a paid diagnostic, while keeping advisory and build sessions available only to existing clients. This creates the clearest premium positioning but changes the current sales motion most substantially.

The website and YouCanBook.me copy should be updated together once one model is selected.
