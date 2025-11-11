# Influencer Giveaway Platform - WeChat Mini Program

WeChat Mini Program frontend for the Influencer Giveaway Platform.

## Tech Stack

- **Platform**: WeChat Mini Program
- **Language**: JavaScript/TypeScript
- **SDK**: WeChat Mini Program SDK (built-in)

## Project Structure

```
miniprogram/
├── pages/           # Mini Program pages
├── components/      # Reusable components
├── services/        # API service layer
├── utils/           # Frontend utilities
├── images/          # Image assets
├── app.js          # App entry point
└── app.json        # App configuration
```

## Setup

1. Open WeChat Developer Tools
2. Import this project directory
3. Configure your AppID in `project.config.json`
4. Update API base URL in `app.js` (globalData.apiBaseUrl)

## Development

- Use WeChat Developer Tools for development and debugging
- API base URL should point to your backend server
- For production, update API base URL to production server

## Pages

- `pages/index/` - Home page
- `pages/register/` - Influencer registration
- `pages/create-giveaway/` - Create giveaway
- `pages/my-activities/` - My activities list
- `pages/giveaway/` - Public giveaway page
- `pages/claim-item/` - Claim item page
- `pages/payment/` - Payment page
- `pages/order-status/` - Order status page
- `pages/my-orders/` - My orders list
- `pages/sharing-area/` - Sharing area
- `pages/share-item/` - Share item page

