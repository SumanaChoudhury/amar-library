# 📖 The Book Nook

A cozy, aesthetic personal digital library and in-browser PDF reader built for laptop, tablet, and mobile.

![The Book Nook Preview](./public/hero-library.jpg)

## ✨ Features

- **Continuous In-Browser PDF Reader**: Smooth continuous vertical scrolling with dynamic page rendering, lazy canvas viewport management, and 0-lag instant parsing.
- **Auto-Fit & Fullscreen**: Responsive viewport scaling that automatically fits pages to your screen width and height.
- **Double-Click Quick Open**: Double click or tap any book cover to jump straight into reader mode.
- **Reading Progress Sync**: Remembers your exact page across devices in real time with Supabase cloud storage.
- **Custom Covers & Styling**: Edge-to-edge book cover display, ambient color accents, frosted glass action buttons, and spine titles.
- **Organized Shelves**: Custom shelves and reading states (*Reading*, *To Read*, *Completed*), plus tag filtering and instant search.
- **Installable PWA**: Installable directly on iOS (Safari "Add to Home Screen"), Android (Chrome "Install App"), and desktop.
- **Ambient Audio**: Optional ambient rain and cozy background sounds while reading.
- **Secure Supabase Cloud Backend**: Row-Level Security (RLS) PostgreSQL database and private storage buckets for PDFs and cover assets.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **PDF Engine**: [PDF.js](https://mozilla.github.io/pdf.js/) with web worker offloading and streaming ArrayBuffer parsing
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL database, Row Level Security, Storage Buckets, Auth)
- **Deployment**: [Vercel](https://vercel.com/) (Fast global edge hosting)
- **App Platform**: Progressive Web App (PWA) with Service Worker and Web Manifest

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A free [Supabase](https://supabase.com) account

### 2. Clone and Install
```bash
git clone https://github.com/SumanaChoudhury/the-book-nook.git
cd the-book-nook
npm install
```

### 3. Configure Supabase Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your project credentials from your Supabase Dashboard (**Settings -> API**):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 Deploy to Vercel (1-Click Hosting)

1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/SumanaChoudhury/the-book-nook.git
   git branch -M main
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com/) and click **"Add New" > "Project"**.
3. Import your `the-book-nook` repository.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Publishable Key
5. Click **Deploy**.
6. In your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**, add your Vercel deployment URL to **Site URL** and **Redirect URLs**.

---

## 📱 Installing as a Mobile App (PWA)

- **iPhone / iPad**: Open your deployed Vercel URL in Safari, tap the **Share** button (box with arrow), and choose **"Add to Home Screen"**.
- **Android**: Open the URL in Chrome, tap the menu (⋮), and choose **"Install app"** or **"Add to Home screen"**.
- **Desktop (Chrome / Edge)**: Click the install icon in the URL bar to launch The Book Nook as a standalone desktop app.

---

## 📄 License
MIT © Sumana Choudhury
