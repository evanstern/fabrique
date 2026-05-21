# MongoDB Atlas setup

Fabrique uses MongoDB Atlas for v1. The dev VM lacks AVX support
(it's a QEMU virtual CPU), so MongoDB 5+ won't run in a local
container. Atlas free tier handles dev and is production-realistic.

This file is a one-time setup walkthrough. After you finish, your
local `.env` will have a `MONGO_URL` value and `docker compose up`
will work.

## What you'll create

- A MongoDB Atlas account (if you don't have one)
- An Atlas organization + project
- A free-tier (M0) cluster
- A database user
- A network access rule
- A connection string

## Steps

### 1. Sign up / sign in

Go to https://www.mongodb.com/cloud/atlas/register and create an
account, or sign in if you already have one.

### 2. Create an organization and project

Atlas groups clusters under projects, and projects under
organizations. For fabrique:

- Organization: anything you like (e.g. your name or `infinitynode`)
- Project: `fabrique`

### 3. Create a free-tier cluster

- Cluster tier: **M0 (Free)**
- Cloud provider: any (AWS is the default; pick the region
  geographically closest to where the app runs)
- Cluster name: `fabrique-dev` (or anything; doesn't affect the
  connection string except as a label)

Atlas provisions the cluster. Takes ~3-5 minutes.

### 4. Create a database user

In the project: **Database Access → Add New Database User**.

- Authentication method: **Password**
- Username: `fabrique-app`
- Password: generate a strong one and save it (you'll need it for
  the connection string)
- Database user privileges: **Read and write to any database**
  (fine for v1; tighten later)

### 5. Add a network access rule

In the project: **Network Access → Add IP Address**.

For v1 dev, the simplest path is:

- **Allow access from anywhere** (`0.0.0.0/0`).

This is fine because the database user password is the actual
auth boundary. For production, add a specific IP allowlist
later.

### 6. Get the connection string

In the project: **Database → Connect → Drivers**.

- Driver: **Node.js**
- Version: latest

Atlas shows a connection string like:

```
mongodb+srv://fabrique-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Replace `<password>` with the password from step 4. Add the
database name `fabrique` between the host and the query string:

```
mongodb+srv://fabrique-app:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/fabrique?retryWrites=true&w=majority
```

### 7. Put it in `.env`

In the repo worktree:

```bash
cp .env.example .env
# edit .env, set MONGO_URL to the connection string from step 6
```

`.env` is gitignored. Never commit it.

### 8. Bring up the stack

```bash
docker compose build
docker compose up -d
docker compose logs -f app
```

The app starts. (Card #3 doesn't yet make any Mongo calls; the
connection string is just configured. Card #4 will be the first
card that actually opens a connection and reads/writes.)

## Verifying the connection (optional, before card #4)

You can sanity-check the connection string with `mongosh` if you
have it installed:

```bash
mongosh "$MONGO_URL"
```

You should land in a Mongo shell connected to the `fabrique`
database. `show collections` will show none (we haven't created
any yet).

## Production note

The same Atlas cluster can serve production once we're ready. The
free tier is fine for the small data volumes fabrique will produce
in v1. We can scale up or add a separate prod cluster later.
