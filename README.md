# ChatApp - Real-time Chat Application

Modern, full-stack chat application built with Next.js 15, Prisma, Socket.io, and Shadcn UI.

## Features

- 🔐 **Authentication** - Secure register/login with NextAuth.js
- 💬 **Private Chat** - One-on-one messaging with friends
- 👥 **Group Chat** - Create and manage group conversations
- 👤 **User Profiles** - Customizable avatars and display names
- ➕ **Friend System** - Add friends by email
- 🎨 **Modern UI** - Beautiful interface with Framer Motion animations
- ⚡ **Real-time** - Instant message delivery (Socket.io ready)
- 📱 **Responsive** - Works on desktop and mobile

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Real-time**: Socket.io (ready to integrate)
- **Type Safety**: TypeScript

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or pnpm

## Getting Started

### 1. Clone and Install

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database and copy the environment variables:

```bash
cp .env.example .env
```

Edit `.env` and set your database URL:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chatapp"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

Generate a secure NextAuth secret:

```bash
openssl rand -base64 32
```

### 3. Initialize Database

```bash
npm run db:generate
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── friends/      # Friend management
│   │   ├── groups/       # Group management
│   │   └── messages/     # Message endpoints
│   ├── auth/             # Auth pages
│   ├── chat/             # Main chat interface
│   └── layout.tsx
├── components/
│   ├── chat/             # Chat components
│   │   ├── chat-sidebar.tsx
│   │   ├── chat-window.tsx
│   │   └── user-avatar.tsx
│   └── ui/               # Shadcn UI components
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── socket.ts         # Socket.io client
│   └── utils.ts          # Utilities
├── prisma/
│   └── schema.prisma     # Database schema
└── types/                # TypeScript definitions
```

## Database Schema

- **User** - User accounts with authentication
- **Friendship** - Friend relationships between users
- **Group** - Group chat rooms
- **GroupMember** - Group membership with roles (Admin/Member)
- **Message** - Chat messages (private & group)

## Features Detail

### Authentication
- Email/password registration
- Secure password hashing with bcrypt
- JWT-based session management

### Private Chat
- Direct messaging between friends
- Message history
- Real-time delivery (Socket.io ready)
- Read receipts

### Group Chat
- Create groups with custom names and descriptions
- Admin controls (rename group, manage members)
- Multiple members support
- Group avatars

### Friend System
- Add friends by email
- Friend list management
- Online/offline status (ready to implement)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Friends
- `GET /api/friends` - Get friend list
- `POST /api/friends` - Add friend by email

### Groups
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group
- `PATCH /api/groups/[id]` - Update group (admin only)

### Messages
- `GET /api/messages` - Get messages (private or group)
- `POST /api/messages` - Send message

## Customization

### Styling
Edit `app/globals.css` for global styles and Tailwind configuration.

### Colors
The app uses a blue-purple gradient theme. Modify in components:
```tsx
className="bg-gradient-to-r from-blue-600 to-purple-600"
```

### Database
To modify the schema, edit `prisma/schema.prisma` and run:
```bash
npm run db:push
```

## Production Deployment

### 1. Build the application
```bash
npm run build
```

### 2. Set environment variables
- `DATABASE_URL` - Production database URL
- `NEXTAUTH_URL` - Production domain
- `NEXTAUTH_SECRET` - Strong secret key

### 3. Deploy
Deploy to Vercel, Railway, or any Node.js hosting platform.

## Real-time Implementation

Socket.io client is ready in `lib/socket.ts`. To enable real-time:

1. Create a Socket.io server (separate or in Next.js API route)
2. Emit `new-message` events on message send
3. Listen for incoming messages in ChatWindow component

Example:
```tsx
useEffect(() => {
  socket.on('new-message', (message) => {
    setMessages(prev => [...prev, message])
  })
}, [])
```

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env`
- Ensure database exists

### Authentication Error
- Verify NEXTAUTH_SECRET is set
- Clear browser cookies
- Check NEXTAUTH_URL matches your domain

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
