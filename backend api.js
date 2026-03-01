const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

// In-memory stores
const users = [];
const events = [];
let nextUserId = 1;
let nextEventId = 1;

async function sendEmail(to, subject, message) {
  return new Promise((resolve) => {
    console.log(`[email] sending to ${to}: ${subject}`);
    setTimeout(() => {
      console.log(`[email] sent to ${to}. Message: ${message}`);
      resolve(true);
    }, 300);
  });
}

function sanitizeUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Access token missing or malformed" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

function authorizeOrganizer(req, res, next) {
  if (req.user.role !== "organizer") {
    return res.status(403).json({ message: "Organizer access only" });
  }
  return next();
}

function authorizeAttendee(req, res, next) {
  if (req.user.role !== "attendee") {
    return res.status(403).json({ message: "Attendee access only" });
  }
  return next();
}

function findEventById(idParam) {
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return null;
  }
  return events.find((event) => event.id === id) || null;
}

app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, and role are required" });
    }

    if (!["organizer", "attendee"].includes(role)) {
      return res.status(400).json({ message: "role must be organizer or attendee" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: nextUserId++,
      name: String(name).trim(),
      email: normalizedEmail,
      role,
      passwordHash,
      registeredEventIds: [],
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    await sendEmail(
      user.email,
      "Welcome to Virtual Event Platform",
      `Hi ${user.name}, your account has been created successfully.`
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = users.find((candidate) => candidate.email === normalizedEmail);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login" });
  }
});

app.get("/me", authenticate, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({ user: sanitizeUser(user) });
});

app.get("/events", authenticate, (req, res) => {
  return res.status(200).json({
    count: events.length,
    events,
  });
});

app.get("/events/:id", authenticate, (req, res) => {
  const event = findEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.status(200).json({ event });
});

app.post("/events", authenticate, authorizeOrganizer, (req, res) => {
  const { title, date, time, description } = req.body;

  if (!title || !date || !time || !description) {
    return res.status(400).json({ message: "title, date, time, and description are required" });
  }

  const event = {
    id: nextEventId++,
    title: String(title).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    description: String(description).trim(),
    organizerId: req.user.id,
    participants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  events.push(event);

  return res.status(201).json({
    message: "Event created",
    event,
  });
});

app.put("/events/:id", authenticate, authorizeOrganizer, (req, res) => {
  const event = findEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ message: "You can only update your own events" });
  }

  const { title, date, time, description } = req.body;

  if (title !== undefined) event.title = String(title).trim();
  if (date !== undefined) event.date = String(date).trim();
  if (time !== undefined) event.time = String(time).trim();
  if (description !== undefined) event.description = String(description).trim();

  event.updatedAt = new Date().toISOString();

  return res.status(200).json({
    message: "Event updated",
    event,
  });
});

app.delete("/events/:id", authenticate, authorizeOrganizer, (req, res) => {
  const event = findEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ message: "You can only delete your own events" });
  }

  const eventIndex = events.findIndex((entry) => entry.id === event.id);
  events.splice(eventIndex, 1);

  users.forEach((user) => {
    user.registeredEventIds = user.registeredEventIds.filter((eventId) => eventId !== event.id);
  });

  return res.status(200).json({ message: "Event deleted" });
});

app.post("/events/:id/register", authenticate, authorizeAttendee, async (req, res) => {
  try {
    const event = findEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.participants.includes(req.user.id)) {
      return res.status(400).json({ message: "Already registered for this event" });
    }

    const user = users.find((entry) => entry.id === req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    event.participants.push(req.user.id);
    user.registeredEventIds.push(event.id);
    event.updatedAt = new Date().toISOString();

    await sendEmail(
      user.email,
      `Event registration confirmed: ${event.title}`,
      `Hi ${user.name}, you are successfully registered for ${event.title} on ${event.date} at ${event.time}.`
    );

    return res.status(200).json({
      message: "Event registration successful",
      event,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register for event" });
  }
});

app.get("/my-registrations", authenticate, authorizeAttendee, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const registeredEvents = user.registeredEventIds
    .map((eventId) => events.find((event) => event.id === eventId))
    .filter(Boolean);

  return res.status(200).json({
    count: registeredEvents.length,
    events: registeredEvents,
  });
});

app.delete("/events/:id/register", authenticate, authorizeAttendee, (req, res) => {
  const event = findEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (!event.participants.includes(req.user.id)) {
    return res.status(400).json({ message: "Not registered for this event" });
  }

  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  event.participants = event.participants.filter((participantId) => participantId !== req.user.id);
  user.registeredEventIds = user.registeredEventIds.filter((eventId) => eventId !== event.id);
  event.updatedAt = new Date().toISOString();

  return res.status(200).json({ message: "Event registration cancelled" });
});

app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  return res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
