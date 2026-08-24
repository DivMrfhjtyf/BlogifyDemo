<div align="center">

# 🚀 Blogify

### A modern full-stack social blogging, networking & real-time messaging platform

<p>
  <img src="https://img.shields.io/badge/Node.js-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/GraphQL-API-E10098?style=for-the-badge&logo=graphql&logoColor=white" alt="GraphQL" />
</p>

<p>
  <a href="https://blogifydemo.onrender.com"><strong>🌐 Live Demo</strong></a>
  &nbsp; • &nbsp;
  <a href="https://github.com/Developer72663/BlogifyDemo"><strong>📦 Source Code</strong></a>
</p>

</div>

---

## 🌟 About Blogify

**Blogify** is a full-stack social blogging and communication platform built to bring publishing, social networking, notifications, analytics, and real-time conversations together in one application.

It is designed as a feature-rich Node.js application with a traditional EJS frontend, MongoDB persistence, Socket.IO real-time communication, GraphQL APIs, Cloudinary media handling, Google OAuth, Web Push, email services, and production-oriented security controls.

> **Project goal:** Build a complete social publishing experience where users can create content, discover people, build relationships, receive notifications, and communicate in real time.

---

## ✨ Highlights

| Area | Highlights |
| --- | --- |
| 📝 **Blogging** | Create, edit, delete, draft, categories, tags, likes, comments, media and analytics |
| 👥 **Social** | Follow, private accounts, follow requests, followers, following and blocking |
| 💬 **Messaging** | Real-time chat, replies, editing, unsending, likes, read status and media |
| 👨‍👩‍👧 **Groups** | Group conversations, member management and administration |
| 🔔 **Notifications** | Social activity, follow requests, mentions, unread counts and Web Push |
| 📊 **Analytics** | Views, devices, sources, geographic data, trends and author analytics |
| 🔐 **Security** | JWT, secure cookies, validation, rate limiting, CSP, origin checks and authorization |
| ☁️ **Media** | Cloudinary-powered images, videos and audio |
| 🔌 **GraphQL** | GraphQL endpoint alongside the Express application |
| 🛠️ **Admin** | Administrative controls and protected admin routes |

---

# 📝 Blogging

- Create, edit and delete blog posts
- Drafts and scheduled publishing
- Categories and tags
- Media uploads
- Likes and comments
- Nested comment replies
- View tracking
- Reading-time calculation
- Featured content
- Search and discovery
- Blog analytics

# 👥 Social Networking

- Follow and unfollow users
- Private accounts
- Follow requests
- Accept or reject requests
- Followers and following
- User blocking
- Safety controls
- Profile discovery

# 💬 Real-Time Messaging

Powered by **Socket.IO**.

- One-to-one conversations
- Real-time message delivery
- Text messages
- Image, video and audio messages
- Voice/audio messaging
- Message replies
- Message editing
- Message deletion
- Unsend messages
- Message likes
- Read status
- Typing indicators
- Online/offline status
- Message requests
- Shared profiles and media
- Conversation controls

# 👥 Group Messaging

- Create groups
- Add and remove members
- Group administration
- Group conversations
- Group media
- Member management

# 🔔 Notifications

- Likes
- Comments and replies
- Follows
- Follow requests
- Mentions
- Unread counts
- Mark as read
- Web Push notifications

# 📊 Analytics

- Blog views
- Daily view tracking
- View source tracking
- Device tracking
- Geographic analytics
- Trending content
- Most-liked content
- Author statistics
- Individual blog analytics

---

# 🛡️ Security Foundation

Blogify includes a security foundation with:

- Authentication and authorization middleware
- JWT authentication
- HTTP-only cookies
- Secure production cookies
- SameSite cookie protection
- Password hashing
- OTP expiration and attempt limits
- Input validation/sanitization
- Rate limiting
- Security headers
- Content Security Policy
- Origin validation
- Protected admin routes
- Authenticated Socket.IO connections
- User blocking and safety controls

> ⚠️ **Security notice:** No web application can honestly be guaranteed to be 100% secure. Production deployments should be independently tested, audited, monitored and hardened for their specific infrastructure and requirements.

---

# 🧰 Technology Stack

### Backend

- Node.js 24
- Express.js
- MongoDB
- Mongoose
- JWT
- Passport / Google OAuth
- Socket.IO
- GraphQL

### Frontend

- EJS
- HTML5
- CSS3
- JavaScript

### Services & Infrastructure

- Cloudinary
- Web Push
- Resend / SMTP
- Upstash Redis

---

# 📁 Architecture

```text
Blogify/
├── app.js
├── package.json
├── package-lock.json
├── Dockerfile
├── .env.example
│
├── graphql/
│   └── schema.js
│
├── models/
├── routes/
├── middlewares/
├── services/
├── controllers/
│
├── views/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
│
├── tests/
└── scripts/
```

> The architecture may evolve as the project continues to be refactored and improved.

---

# ⚙️ Requirements

- **Node.js:** 24.x
- **npm**
- **MongoDB**
- **Git**

Depending on enabled features:

- Cloudinary
- Google OAuth credentials
- Upstash Redis
- Email provider
- Web Push / VAPID credentials

---

# 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/Developer72663/BlogifyDemo.git
cd BlogifyDemo
```

### 2. Install

```bash
npm install
```

### 3. Configure environment

Create `.env` using `.env.example` as the authoritative reference.

**Never commit real credentials or production secrets.**

### 4. Run in development

```bash
npm run dev
```

### 5. Run in production

```bash
npm start
```

---

# 🔐 Environment Configuration

The project uses environment variables for runtime, database, authentication, Redis, Google OAuth, email, Cloudinary and Web Push.

Typical configuration includes:

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

Use the repository's `.env.example` for the complete, current variable list.

---

# 🔌 GraphQL

GraphQL is available at:

```text
/graphql
```

Basic health query:

```graphql
{
  __typename
}
```

The GraphQL layer can expose application data supported by the current schema.

---

# 📡 Real-Time Messaging

Blogify uses Socket.IO for real-time communication.

The deployment environment must support the application's Socket.IO/WebSocket requirements. Reverse proxies and load balancers may require additional WebSocket configuration.

---

# ☁️ Cloudinary Media

Cloudinary handles application media such as:

- Profile images
- Blog images and media
- Message attachments
- Images
- Videos
- Audio

Production deployments should use credentials owned by the deployment owner.

---

# 🔔 Web Push

Web Push requires VAPID credentials and HTTPS in production.

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

---

# 🧪 Testing

Run the project's test command:

```bash
npm test
```

Recommended functional testing areas:

- Authentication
- Registration and login
- OTP verification
- Password reset
- Google authentication
- Blog creation/editing/deletion
- Drafts and publishing
- Comments and replies
- Likes
- Follow/unfollow
- Private accounts and follow requests
- Notifications
- Real-time messaging
- Message editing/deletion/unsending
- Voice and media messaging
- Group messaging
- Cloudinary uploads
- Admin functions
- GraphQL
- Security controls

---

# 🐳 Docker

Blogify includes a Dockerfile for container deployment.

```bash
docker build -t blogify .
docker run -p 8000:8000 --env-file .env blogify
```

Production secrets should be supplied securely rather than committed to the repository.

---

# 🌐 Deployment

Blogify is designed for Node.js-compatible hosting environments such as:

- Render
- Koyeb
- Railway
- Google Cloud
- AWS
- Similar Node.js hosting platforms

Different providers can require configuration changes for environment variables, MongoDB, HTTPS/domain settings, OAuth callbacks, Cloudinary, email, Web Push, Redis and Socket.IO/WebSockets.

> A successful deployment on one hosting provider does **not** guarantee zero configuration changes on another provider.

---

# ✅ Production Checklist

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
- [ ] Test major user flows
- [ ] Configure backups and monitoring

---

# 💼 Commercial / Licensing

Blogify can serve as a foundation for:

- Social blogging platforms
- Creator platforms
- Community platforms
- Publishing platforms
- Social networking applications
- Messaging-enabled platforms
- Custom content platforms

For a commercial sale, licensing and ownership terms should be defined separately between the seller and buyer.

---

# ⚠️ Production Disclaimer

Blogify should be reviewed and configured before production use.

The deployment owner is responsible for:

- Production infrastructure
- Secrets and credentials
- Third-party services
- Domain configuration
- Security auditing
- Compliance requirements
- Monitoring
- Backups
- Hosting configuration

No software application can reasonably be guaranteed to be completely vulnerability-free.

---

# 👨‍💻 Developer

**Developer72663**

- GitHub: https://github.com/Developer72663
- Repository: https://github.com/Developer72663/BlogifyDemo
- Live Demo: https://blogifydemo.onrender.com

---

# 📄 License

The project currently uses the **ISC** license as specified by `package.json`.

For an exclusive commercial sale or ownership transfer, use a separate written agreement defining ownership, source-code rights, commercial usage, redistribution rights, modification rights, exclusivity, support and warranty/disclaimer terms.

---

<div align="center">

### ⭐ Blogify

**Blogging • Social Networking • Notifications • Analytics • Real-Time Messaging**

Made with ❤️ using Node.js and MongoDB.

</div>
