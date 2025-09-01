# MacroTracker

A full-stack fitness tracking web application built with **Python (Flask)**, **React**, and **PostgreSQL**.  
MacroTracker helps users log meals, set and edit calorie goals, and track daily nutrition progress with a clean, interactive dashboard.

## Features
- Guest mode with food search (via Nutritionix API) and local meal logging
- User authentication with secure password storage (requires PostgreSQL setup)
- Per-user calorie goal persistence (requires PostgreSQL setup)
- Interactive React dashboard with calorie visualization
- Log foods by meal (breakfast, lunch, dinner, snacks)
- Serving size and unit conversion support
- PostgreSQL database for user accounts, meals, and calorie data

## Tech Stack
- **Frontend:** React, HTML, CSS, JavaScript
- **Backend:** Python, Flask
- **Database:** PostgreSQL
- **APIs:** Nutritionix API

## Running the Project (for development/demo)
This project uses a separate backend and frontend, so you’ll need to run both.

### 1. Backend (Flask)
```bash
cd backend
python app.py
```
- Requires Python 3 and Flask.  
- Update `app.py` with your local database credentials if you want full account persistence.  
- If you don’t set up PostgreSQL, you can still run the app in guest mode.

### 2. Frontend (React)
```bash
cd frontend
npm install
npm start
```
- Runs the React development server on http://localhost:3000.  

**Note: This project was created for practice and learning purposes.  
You can use it fully in **guest mode** (no PostgreSQL required) to try out the frontend, search foods, and log meals locally. If you want user accounts and calorie goal persistence, you’ll need to set up your own PostgreSQL instance and Nutritionix API credentials.  

## Future Improvements
This project is still in progress, and I plan to keep working on it by making small upgrades  and adding new features as I learn more.
