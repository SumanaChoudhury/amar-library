# Amar Library

A cozy, aesthetic personal digital library and in-browser PDF reader built for laptop, tablet, and mobile by **Sumana Choudhury**.

![Amar Library Preview](./public/hero-library.jpg)

---

## About the Creator & Project

> *"No lost bookmarks. No bent spines. Just pure stories, exactly where I left off."*

**Amar Library** (*"Amar"* means *"My"* in Bengali) was built by **Sumana Choudhury** — a passionate reader who can easily get lost in fictional worlds for hours, but also a proudly clumsy human being.

Between dropping heavy books, perpetually misplacing bookmarks in every corner of the house, accidentally creasing beautiful page corners, or forgetting which page she was on, reading physical books was becoming an unpredictable sport. 

Amar Library is her personal, fail-safe digital sanctuary:
- **Instant Cloud Sync**: Remembers your exact page across devices so clumsiness never gets in the way of a great chapter.
- **Continuous In-Browser Reader**: Silky smooth continuous vertical scrolling with 0-lag instant parsing.
- **Auto-Fit & Fullscreen**: Responsive viewport scaling that automatically fits pages to any screen size.
- **Double-Click Quick Open**: Double click or tap any book cover to jump straight into reader mode.
- **Custom Covers & Styling**: Edge-to-edge book cover display, ambient color accents, frosted glass action buttons, and spine titles.
- **Installable PWA**: Installable directly on iOS (Safari "Add to Home Screen"), Android (Chrome "Install App"), and desktop.
- **Ambient Audio**: Optional ambient rain and cozy background sounds while reading.
- **Secure Cloud Backend**: Supabase PostgreSQL database with Row-Level Security (RLS) and private storage buckets.

---

## Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **PDF Engine**: [PDF.js](https://mozilla.github.io/pdf.js/) with web worker offloading and streaming ArrayBuffer parsing
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL database, Row Level Security, Storage Buckets, Auth)
- **Deployment**: [Vercel](https://vercel.com/) (Fast global edge hosting)
- **App Platform**: Progressive Web App (PWA) with Service Worker and Web Manifest

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A free [Supabase](https://supabase.com) account

### 2. Clone and Install
```bash
git clone https://github.com/SumanaChoudhury/amar-library.git
cd amar-library
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

## Deploy to Vercel (1-Click Hosting)

1. Push this repository to your GitHub account:
   ```bash
   git remote set-url origin https://github.com/SumanaChoudhury/amar-library.git
   git branch -M main
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com/) and click **"Add New" > "Project"**.
3. Import your `amar-library` repository.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Publishable Key
5. Click **Deploy**.
6. In your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**, add your Vercel deployment URL to **Site URL** and **Redirect URLs**.

---

## Installing as a Mobile App (PWA)

- **iPhone / iPad**: Open your deployed Vercel URL in Safari, tap the **Share** button (box with arrow), and choose **"Add to Home Screen"**.
- **Android**: Open the URL in Chrome, tap the menu (⋮), and choose **"Install app"** or **"Add to Home screen"**.
- **Desktop (Chrome / Edge)**: Click the install icon in the URL bar to launch Amar Library as a standalone desktop app.

---

## License
MIT © Sumana Choudhury
