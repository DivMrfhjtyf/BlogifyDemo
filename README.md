# 🚀 Blogify

Blogify is a full-stack social blogging and communication platform built with Node.js, Express.js, MongoDB, EJS, Socket.IO, GraphQL, Cloudinary, Google OAuth, Web Push, and production-oriented security controls.

It combines blogging, social networking, real-time messaging, notifications, user profiles, follow systems, privacy controls, media sharing, analytics, and administration in one application.

## 📌 Project Status

- **Version:** 2.1.0
- **Runtime:** Node.js 24.x
- **Application:** Express.js / EJS
- **Database:** MongoDB / Mongoose
- **Real-time:** Socket.IO
- **API:** Express + GraphQL

## ✨ Features

### 👤 Authentication & Accounts
- User registration and login
- Email/OTP verification
- Password reset
- JWT authentication
- HTTP-only authentication cookies
- Google OAuth authentication
- Profile management
- Account privacy controls
- Account deactivation/deletion

### 📝 Blogging
- Create, edit, and delete blogs
- Drafts and scheduled publishing
- Categories and tags
- Media uploads
- Likes and comments
- Nested comment replies
- View tracking
- Reading-time calculation
- Featured blogs
- Advanced search
- Blog analytics

### 👥 Social Networking
- Follow/unfollow users
- Private accounts
- Follow requests
- Accept/reject follow requests
- Followers and following
- User blocking and safety controls
- Profile discovery

### 🔔 Notifications
- Like, comment, reply, follow, mention, and follow-request notifications
- Unread notification counts
- Mark-as-read controls
- Web Push notifications

### 💬 Real-Time Messaging
Powered by Socket.IO.

- One-to-one messaging
- Real-time message delivery
- Text, image, video, and audio messages
- Message replies
- Message editing
- Message deletion and unsending
- Message likes
- Read status
- Typing indicators
- Online/offline status
- Message requests
- Shared profiles and media
- Conversation controls

### 👥 Group Messaging
- Create groups
- Add/remove members
- Group administration
- Group conversations
- Group media
- Member management

### 📊 Analytics
- Blog views and daily view tracking
- View-source and device tracking
- Geographic analytics
- Trending and most-liked blogs
- Author statistics
- Individual blog analytics

### 🛡️ Security
Blogify includes a security foundation containing authentication and authorization middleware, JWT authentication, HTTP-only and secure production cookies, SameSite protection, password hashing, OTP expiration/attempt limits, input validation, rate limiting, security headers, Content Security Policy, origin validation, protected admin routes, authenticated Socket.IO connections, and user safety controls.

> **Security notice:** No web application can honestly be guaranteed to be 100% secure. Production deployments should be independently tested, audited, and hardened for their specific infrastructure and requirements.

### ☁️ Media Uploads
Cloudinary is used for profile images, blog media, and message attachments including images, video, and audio.

### 🔌 GraphQL
GraphQL is available at:

```text
/graphql
```

Basic health query:

```graphql
{ __typename }
```

The GraphQL layer can expose application data supported by the current schema.

## 🏗️ Technology Stack

**Backend:** Node.js 24, Express.js, MongoDB, Mongoose, JWT, Passport/Google OAuth, Socket.IO, GraphQL

**Frontend:** EJS, HTML5, CSS3, JavaScript

**Services:** Cloudinary, Web Push, Resend/SMTP email, Upstash Redis

## 📁 Project Structure

```text
Blogify/
├── app.js
├── package.json
├── package-lock.json
├── Dockerfile
├── .env.example
├── graphql/
│   └── schema.js
├── models/
├── routes/
├── middlewares/
├── services/
├── views/
├── public/
├── tests/
└── scripts/
```

> The structure may evolve as the application is refactored and new features are added.

## ⚙️ Requirements

- Node.js 24.x
- npm
- MongoDB
- Git

Depending on enabled features, you may also need Cloudinary, Google OAuth credentials, Upstash Redis, an email provider, and Web Push/VAPID credentials.

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Developer72663/BlogifyDemo.git
cd BlogifyDemo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file using `.env.example` as the reference. Never commit real credentials or production secrets to GitHub.

### 4. Run the application

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## 🔐 Environment Configuration

The current `.env.example` contains configuration for runtime, database, authentication, Redis, Google OAuth, email, Cloudinary, and Web Push.

Typical production variables include:

```env
NODE_ENV=production
PORT=8000
APP_URL=https://your-domain.example
FRONTEND_URL=https://your-domain.example
SOCKET_URL=https://your-domain.example
MONGODB_URI=
JWT_SECRET=
RESET_PASSWORD_SECRET=
OTP_SECRET=
BCRYPT_ROUNDS=12
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_USER=
EMAIL_PASSWORD=
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

Use the repository's `.env.example` as the authoritative list of currently supported variables.

## 🔑 Google OAuth

When deploying with Google authentication, configure OAuth credentials for the deployment domain. The callback URL must exactly match the authorized redirect URI configured in Google Cloud Console.

Do not reuse another person's production OAuth credentials.

## 📡 Real-Time Messaging

Blogify uses Socket.IO for real-time communication. The hosting environment must support the application's Socket.IO/WebSocket requirements. Reverse proxies and load balancers may require additional WebSocket configuration.

## 🔔 Web Push

Web Push requires VAPID credentials and HTTPS in production.

## 🧪 Testing

Run the project's test command:

```bash
npm test
```

Recommended testing areas include authentication, blogs, drafts, comments, likes, follow requests, notifications, messaging, media uploads, group messaging, admin functions, GraphQL, and security controls.

## 🐳 Docker

Blogify includes a Dockerfile for container deployment.

```bash
docker build -t blogify .
docker run -p 8000:8000 --env-file .env blogify
```

## 🌐 Deployment

Blogify is designed for Node.js-compatible hosting environments such as Render, Koyeb, Railway, Google Cloud, AWS, and similar services.

Different providers can require configuration changes for environment variables, MongoDB, HTTPS/domain settings, OAuth callbacks, Cloudinary, email, Web Push, Redis, and Socket.IO/WebSockets.

A successful deployment on one hosting provider does **not** guarantee zero configuration changes on another provider.

## 🔒 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong authentication secrets
- [ ] Configure MongoDB
- [ ] Configure Cloudinary
- [ ] Configure Google OAuth
- [ ] Configure email
- [ ] Configure Web Push
- [ ] Configure Redis where required
- [ ] Configure HTTPS and production domain
- [ ] Verify Socket.IO/WebSocket support
- [ ] Review origin/CORS configuration
- [ ] Review administrator accounts
- [ ] Verify production cookies
- [ ] Run tests
- [ ] Perform security testing
- [ ] Test all major user flows
- [ ] Configure backups and monitoring

## 💼 Commercial Use

Blogify can serve as a foundation for social blogging, creator, community, publishing, social networking, and messaging-enabled platforms.

For a commercial sale, licensing and ownership terms should be defined separately between the seller and buyer.

## ⚠️ Production Disclaimer

Blogify should be reviewed and configured before production use. The deployment owner is responsible for infrastructure, secrets, third-party services, domain configuration, security auditing, compliance, monitoring, backups, and hosting configuration.

No software application can reasonably be guaranteed to be completely vulnerability-free.

## 👨‍💻 Developer

**Developer72663**

GitHub: https://github.com/Developer72663

Repository: https://github.com/Developer72663/BlogifyDemo

## 📄 License

The project currently uses the **ISC** license as specified by `package.json`.

For an exclusive commercial sale or ownership transfer, use a separate written agreement defining ownership, source-code rights, commercial usage, redistribution rights, modification rights, exclusivity, support, and warranty/disclaimer terms.

---

⭐ **Blogify — blogging, social networking, notifications, analytics, and real-time messaging in one platform.**
