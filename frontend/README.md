# Voxroom

Voxroom is a real-time voice room web application that allows users to create and join voice chat rooms directly from the browser.

The app is built with a **Go backend** and a **TypeScript frontend**, using WebSocket for real-time communication and Supabase for authentication.

🌐 Live Demo: https://voxroomlive.vercel.app

---

## ✨ Features

- 🎙️ Real-time voice chat  
- 🧑‍🤝‍🧑 Multiple users per room  
- 🏠 Create & join voice rooms  
- 🔐 Authentication with Supabase  
- ⚡ WebSocket-based real-time connection  
- 🌍 Fully web-based (no installation)

---

## 🧠 Tech Stack

**Frontend**
- TypeScript
- Next.js
- Tailwind CSS
- WebSocket

**Backend**
- Go
- WebSocket
- REST API

**Authentication**
- Supabase

**Deployment**
- Frontend: Vercel  
- Backend: Render (or similar)

---

## 🧭 Step-by-Step Usage

### 1️⃣ Open the App
Go to:
Visit the Voxroom website:

https://voxroomlive.vercel.app


Make sure your browser allows microphone access.

### 2️⃣ Login / Authentication

Users are authenticated using Supabase

After logging in, user data is loaded automatically

Unauthenticated users will be redirected to the login page

### 3️⃣ Create or Join a Room

From the main page, you can:

Create a new voice room

Join an existing room using its room ID

### 4️⃣ Join Voice Chat

When entering a room:

A WebSocket connection is established

Voice streaming starts automatically

Allow microphone permission when prompted

### 5️⃣ Talk in Real Time

Speak through your microphone

Your voice is streamed live to other users in the same room

Multiple users can talk together simultaneously

### 6️⃣ Leave the Room

Leave the page or navigate back

WebSocket connection closes automatically

You are safely removed from the room
---

## ⚙️ How It Works (Simple)

User logs in via Supabase

Frontend connects to backend using WebSocket

Backend manages rooms and connected users

Audio streams are sent and received in real time
---

## 🛠️ Local Development
Requirements

Go 1.20+

Node.js 18+

npm or yarn
---

## Setup
1. Clone Repository
git clone https://github.com/Nathanaelcpt/voxroom.git
cd voxroom

2. Run Backend
cd backend
go mod tidy
go run .


Backend will run on default configured port.

3. Run Frontend
cd frontend
npm install
npm run dev


Open:

http://localhost:3000
---

## 🐞 Common Issues

No sound

Check browser microphone permission

Make sure correct input device is selected

WebSocket disconnected

Backend might be sleeping (free hosting)

Refresh the page to reconnect
---

## 📦 Deployment Notes

Frontend is deployed on Vercel

Backend can be deployed on Render, Railway, or Fly.io

Make sure WebSocket support is enabled
---

## 📄 License

This project is open-source and free to use.
