# DealScope – Playwright Web Scraper

DealScope is a full-stack web scraping application that uses Playwright
to extract dynamic, JavaScript-rendered deal data from **Nykaa, Amazon,
and Flipkart**, and presents it through a Next.js frontend.

---

## 🚀 Features
- Scrapes dynamic e-commerce websites using Playwright
- Site-specific scraping logic for Nykaa, Amazon, and Flipkart
- Handles JavaScript-rendered content and dynamic loading
- Flask backend to manage scraping and alerts
- Next.js frontend to browse scraped deals
- JSON-based storage for subscriptions and alerts
- Clean separation of frontend and backend

---

## 🌐 Supported Websites
- **Nykaa**
- **Amazon**
- **Flipkart**

Each website uses a dedicated scraping logic to handle differences
in DOM structure, dynamic content loading, and layout.

---

## 🛠 Tech Stack

### Frontend
- Next.js
- React
- CSS

### Backend
- Python
- Playwright
- Flask

---

## 📂 Project Structure

app/ → Next.js frontend

backend/ → Flask + Playwright scraping logic

data/ → JSON data storage

screenshots/ → UI screenshots


---

## ▶️ How to Run the Project

### Backend (Scraper + API)

cd backend

pip install -r requirements.txt

playwright install

python app.py

### Frontend (UI)

npm install

npm run dev

### Open your browser and visit:
http://localhost:3000

### Notes

- This project demonstrates real-world browser automation using Playwright
- Designed to scrape JavaScript-heavy e-commerce websites
- Focuses on practical full-stack integration rather than static scraping

  
