# VoxRoom

VoxRoom is a real-time voice room web application that allows users to create and join voice chat rooms directly from the browser.

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
https://voxroomlive.vercel.app

Allow microphone access when prompted.

---

### 2️⃣ Login / Authentication
- Users authenticate via Supabase
- User data is loaded automatically after login
- Unauthenticated users are redirected to the login page

---

### 3️⃣ Create or Join a Room
- From the main page, users can:
  - Create a new voice room
  - Join an existing room using a room ID

---

### 4️⃣ Join Voice Chat
- WebSocket connection is established automatically
- Voice streaming starts after entering the room
- Microphone permission is required

---

### 5️⃣ Talk in Real Time
- Speak through your microphone
- Your voice is streamed live to all users in the same room
- Multiple users can talk simultaneously

---

### 6️⃣ Leave the Room
- Leave the page or navigate back
- WebSocket connection closes automatically
- User is safely removed from the room

---

## ⚙️ How It Works

1. User logs in using Supabase  
2. Frontend connects to backend via WebSocket  
3. Backend manages rooms and connected users  
4. Audio data is streamed in real time  

---

## 🛠️ Local Development

### Requirements
- Go 1.20+
- Node.js 18+
- npm or yarn

---

### Setup

#### 1. Clone the Repository

git clone https://github.com/Nathanaelcpt/voxroom.git
cd voxroom

#### 2. Run Backend
cd backend
go mod tidy
go run .


Backend will run on default configured port.

#### 3. Run Frontend
cd frontend
npm install
npm run dev


Open:

http://localhost:3000

---

## 🐞 Common Issues

No sound

- Check browser microphone permission

- Make sure correct input device is selected

WebSocket disconnected

- Backend might be sleeping (free hosting)

- Refresh the page to reconnect

---

## 📦 Deployment Notes

- Frontend is deployed on Vercel

- Backend can be deployed on Render, Railway, or Fly.io

- Make sure WebSocket support is enabled
