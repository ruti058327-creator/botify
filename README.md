# Botify

Botify is a Hebrew, right-to-left website for creating website-aware customer-service bots. The application includes regular-user and administrator views, OTP account flows, bot management, customer support conversations, profile-image upload, and plan records.

## Run locally

1. Install server dependencies: `cd server` and run `npm install`.
2. Configure `server/.env` using the variable names in `server/.env.example`.
3. From the repository root, run `npm start`.
4. Open `http://localhost:3000`.

The server uses `MONGO_URI` for MongoDB, `EMAIL_USER` and `EMAIL_PASS` for email verification, `JWT_SECRET` for signed sessions, and `GEMINI_API_KEY` for AI answers. Do not commit `.env` or share its values.

## Project layout

- `public/` contains the client pages, styles, shared scripts, and browser API service.
- `server/` contains the Express API, Mongoose models, middleware, and controllers.
- `server/docs/project-design.md` contains the screen-flow diagram, active API table, and database relationship diagram.
- `server/README.md` contains server-specific setup and implementation notes.

The payment page currently records plan and limited card metadata in MongoDB. It is not connected to a payment processor and does not charge cards; full card numbers and CVVs are not stored.

Deployment to Render, GitHub Pages, and MongoDB Atlas must be configured and verified in the corresponding provider dashboards. The local repository alone cannot confirm that production services are deployed.