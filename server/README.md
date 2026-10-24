# Botify Server

Botify is a Node.js and Express application for account management, website-scanned customer-service bots, support conversations, and subscription records. MongoDB is accessed through Mongoose.

## Run locally

1. Install the server dependencies: `cd server` followed by `npm install`.
2. Copy `.env.example` to `.env`. Set `MONGO_URI` to the connection string from your MongoDB Atlas cluster and set `JWT_SECRET`; add the email and Gemini settings for those features.
3. Start the server with `npm start` from `server/`, or run `npm start` from the repository root.
4. Open `http://localhost:3000`.

The server reads `MONGO_URI`, `PORT`, `EMAIL_USER`, `EMAIL_PASS`, `GEMINI_API_KEY`, `JWT_SECRET`, `ADMIN_USERNAMES`, and `ADMIN_PASSWORD` from `server/.env`. `MONGO_URI` must point to the project's MongoDB Atlas database. `JWT_SECRET` is required and must remain stable so existing tokens remain valid. Registration/login email verification needs the email settings. AI responses need `GEMINI_API_KEY`.

## Structure

- `controllers/` contains request handling and application logic.
- `middlewares/` contains authentication, request logging, upload, and error handling middleware.
- `models/` contains the Mongoose schemas.
- `routes/` contains Express route definitions.
- `utils/` contains shared helpers, including the plan limits.
- `validation/` contains Joi request schemas. Route validation runs before controllers, and unhandled errors are serialized by `middlewares/errorHandler.js`.
- `../public/services/api-service.js` centralizes browser API requests; `../public/js/config.js` defines the API origin.

Server JavaScript uses native ES modules. The browser uses one login form for every role; the server returns a role-bearing token and the client displays the corresponding destination link. Authorization is enforced by the server, not by client-side menu visibility.

The request logger is created by `middlewares/requestLogger.js` and registered in `server.js` as a configurable middleware creator.

## Project documentation

See [docs/project-design.md](docs/project-design.md) for the screen-flow diagram, active API route table, and database schema relationships.

## Important implementation note

The payment flow currently records a selected plan and safe card metadata in MongoDB. It does not connect to a payment processor and does not charge a card. The stored card data is limited to the cardholder name and last four digits; a full card number and CVV must not be stored by this application.

The server seeds the `administrators` MongoDB collection with the usernames in `ADMIN_USERNAMES` on startup (default: `NOA`, `RUTI`, `RUTY`, and `MIRYAM`). Add or remove usernames in that setting and restart the server to update the configured administrator accounts. All listed administrators sign in with the shared `ADMIN_PASSWORD`; set it in the server environment before starting the server. The server issues a signed administrator token only after checking this password; never put the shared password in source code or commit `.env`. Registered accounts can also be granted administrator access by promoting their `role` field to `admin` in the Atlas `users` collection; those accounts continue to use the normal password and email verification flow.