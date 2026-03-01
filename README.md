# Backend System for a Virtual Event Management Platform

Node.js + Express backend with in-memory storage for users and events.

## Features
- User registration and login with `bcryptjs` + JWT
- Role-based access (`organizer`, `attendee`)
- Event CRUD for organizers only
- Event registration/cancellation for attendees
- In-memory participant management
- Async mock email on:
  - successful user registration
  - successful event registration

## Tech Stack
- Node.js
- Express.js
- bcryptjs
- jsonwebtoken
- cors
- nodemon (dev)

## Setup
```bash
npm install
```

## Run
```bash
npm start
```

Development mode:
```bash
npm run dev
```

Server default: `http://localhost:3000`

## Auth Endpoints
- `POST /register`
- `POST /login`
- `GET /me`

### Register Body
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "pass123",
  "role": "organizer"
}
```

### Login Body
```json
{
  "email": "alice@example.com",
  "password": "pass123"
}
```

## Event Endpoints
All endpoints below require `Authorization: Bearer <token>`.

- `GET /events` (any authenticated user)
- `GET /events/:id` (any authenticated user)
- `POST /events` (organizer only)
- `PUT /events/:id` (organizer owner only)
- `DELETE /events/:id` (organizer owner only)
- `POST /events/:id/register` (attendee only)
- `DELETE /events/:id/register` (attendee only)
- `GET /my-registrations` (attendee only)

### Create Event Body
```json
{
  "title": "Tech Summit",
  "date": "2026-04-20",
  "time": "14:00",
  "description": "Tech event"
}
```

## Notes
- Data is stored in memory (`users`, `events`) and resets when server restarts.
- Set `JWT_SECRET` in environment for production usage.
