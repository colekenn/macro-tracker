import React, { useState } from 'react';
import './App.css';
import api from './api';

function App() {
  const [screen, setScreen] = useState('home');
  const [started, setStarted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [foodSearch, setFoodSearch] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [caloriesEaten, setCaloriesEaten] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [servingSize, setServingSize] = useState(1);
  const [servingUnit, setServingUnit] = useState('serving');

  const [loggedFoods, setLoggedFoods] = useState({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  });

  const [selectedMeal, setSelectedMeal] = useState('breakfast');

  // --------- Helpers ----------
  async function fetchSuggestions(query) {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      // call backend proxy endpoint
      const res = await api.apiFetch(`/api/nutrition/search/instant?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      const commonFoods = data.common ? data.common.map(item => item.food_name) : [];
      setSuggestions(commonFoods.slice(0, 5));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
  }

  function CalorieEditor({ calorieGoal, setCalorieGoal }) {
    const [showInput, setShowInput] = useState(false);
    const [newGoal, setNewGoal] = useState(calorieGoal);

    return (
      <div>
        {!showInput ? (
          <button className="edit-calorie" onClick={() => {setShowInput(true)}}>
            Edit Calorie Goal
          </button>
        ) : (
          <div>
            <input
              type="number"
              value={newGoal}
              placeholder='Enter Calorie Goal'
              onChange={(e) => setNewGoal(Number(e.target.value))}
              autoFocus
            />
            <button
              onClick={async () => {
                setCalorieGoal(newGoal);
                setShowInput(false);

                if (loggedIn && username) {
                  try {
                    await api.apiFetch(`/user/${username}/goal`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ newGoal }),
                    });
                  } catch (err) {
                    console.error("Error saving calorie goal:", err);
                  }
                }
              }}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    );
  }

  function convertToBaseUnit(userAmount, userUnit, baseUnit, foodName) {
    const weightConversions = {
      grams: 1, g: 1, oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
      lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
    };
    const volumeConversions = {
      ml: 1, milliliter: 1, milliliters: 1, l: 1000, liter: 1000, liters: 1000,
      tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
      tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
      cup: 240, cups: 240,
      fl_oz: 29.5735, 'fl oz': 29.5735, 'fluid ounce': 29.5735, 'fluid ounces': 29.5735,
    };
    const volumeToWeightApprox = {
      chicken: 140, rice: 185, oats: 90, sugar: 200, flour: 125, butter: 227,
    };
    const uUser = userUnit.toLowerCase();
    const uBase = baseUnit.toLowerCase();

    if (uUser === uBase) return userAmount;
    if (weightConversions[uUser] && weightConversions[uBase]) {
      const grams = userAmount * weightConversions[uUser];
      return grams / weightConversions[uBase];
    }
    if (volumeConversions[uUser] && volumeConversions[uBase]) {
      const ml = userAmount * volumeConversions[uUser];
      return ml / volumeConversions[uBase];
    }
    if (volumeConversions[uUser] && weightConversions[uBase]) {
      const cups = (userAmount * volumeConversions[uUser]) / volumeConversions['cup'];
      let gramsPerCup = 240;
      if (foodName) {
        const fn = foodName.toLowerCase();
        for (const key in volumeToWeightApprox) {
          if (fn.includes(key)) {
            gramsPerCup = volumeToWeightApprox[key];
            break;
          }
        }
      }
      const grams = cups * gramsPerCup;
      return grams / weightConversions[uBase];
    }
    if (weightConversions[uUser] && volumeConversions[uBase]) {
      return null;
    }
    return null;
  }

  // ---------- Food search & log ----------
  async function searchAndLogFood() {
    try {
      if (!foodSearch.trim()) {
        setMessage("Please enter a food name.");
        return;
      }

      // call backend proxy for nutritionix
      const response = await api.apiFetch('/api/nutrition/natural/nutrients', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: foodSearch })
      });

      const data = await response.json();
      if (!data.foods || data.foods.length === 0) {
        setMessage("Food not found. Try another search.");
        return;
      }
      const food = data.foods[0];
      const baseServingQty = food.serving_qty;
      const baseServingUnit = food.serving_unit;
      const baseCalories = food.nf_calories;
      const convertedQty = convertToBaseUnit(servingSize, servingUnit, baseServingUnit, food.food_name);
      const calories = convertedQty
        ? Math.round((convertedQty / baseServingQty) * baseCalories)
        : Math.round(servingSize * baseCalories);
      const foodItem = {
        name: food.food_name,
        calories: calories,
        servingSize: `${servingSize} ${servingUnit}`
      };
      setLoggedFoods(prev => ({
        ...prev,
        [selectedMeal]: [...prev[selectedMeal], foodItem]
      }));
      setCaloriesEaten(prev => prev + calories);
      setMessage(`Added ${foodItem.name} (${calories} cal) to ${selectedMeal}`);
      setFoodSearch("");
      setServingSize(1);
      setServingUnit('serving');
    } catch (error) {
      console.error(error);
      setMessage("Error searching food. Try again.");
    }
  }

  // ---------- Auth ----------
  async function registerUser(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    try {
      const response = await api.apiFetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');
      setLoggedIn(true);
      setMessage('');
      setScreen('home');
    } catch (error) {
      setMessage(error.message);
    }
    
    setUsername(username);
    setPassword('');
    setConfirmPassword('');
  }

  async function loginUser(e) {
    e.preventDefault();
    try {
      const response = await api.apiFetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      setLoggedIn(true);
      setMessage('');
      setScreen('home');
      
      try {
        const goalRes = await api.apiFetch(`/user/${username}/goal`);
        const goalData = await goalRes.json();
        if (goalRes.ok && goalData && typeof goalData.calorieGoal === 'number') {
          setCalorieGoal(goalData.calorieGoal);
        }
      } catch (err) {
        console.error("Error fetching calorie goal:", err);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function clearLogs() {
    setLoggedFoods({
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    });
    setCaloriesEaten(0);
    setMessage('');
  }

  // ---------- UI ----------
  if (!started) {
    return (
      <div className="landing-wrapper">
        <div className="landing-card">
          <img src="/logoMacro.png" alt="MacroTracker Logo" className="landing-card-logo" />
          <h1 className="landing-title">Welcome to MacroTracker</h1>
          <p className="landing-subtitle">Track your calories. Reach your goals. Stay consistent.</p>
          <div className="landing-button-group">
            <button className="landing-button" onClick={() => { setStarted(true); setScreen('Register'); setLoggedIn(false) }}>
              Sign Up
            </button>
            <button className="landing-button secondary" onClick={() => { setStarted(true); setScreen('Login'); setLoggedIn(false) }}>
              Log In
            </button>
            <button className="landing-button-guest" onClick={() => { setStarted(true); setScreen('home'); }}>
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'home') {
    return (
      <div className="App">
        <nav className="navbar">
          <div className="logo-title">
            <img className="logo" src="/logoMacro.png" alt="Logo" />
            <div className="title">MacroTracker</div>
          </div>
          <div className="nav-links">
            {!loggedIn ? (
              <>
                <span className="welcoming">Welcome, Guest!</span>
                <button onClick={() => {setScreen('Login'); setMessage('');}}>Log In</button>
                <button onClick={() => {setScreen('Register'); setMessage('');}}>Register</button>
              </>
            ) : (
              <>
                <span className="welcoming">Welcome, {username}!</span>
                <button
                  onClick={() => {
                    setLoggedIn(false);
                    setUsername('');
                    setPassword('');
                    setMessage('');
                    setScreen('home');
                  }}
                >
                  Log Out
                </button>
              </>
            )}
          </div>
        </nav>

        <main className="main-content">
          <div className="dashboard">
            <div className="top-row">
              <div className="card calorie-card">
                <h2>Today's Calories</h2>
                <div className="calorie-visual">
                  <svg width="120" height="120">
                    <circle cx="60" cy="60" r="50" stroke="#e0e0e0" strokeWidth="12" fill="none" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="#0a2900"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (calorieGoal ? (caloriesEaten / calorieGoal) : 0))}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                    <text className="circletext" x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      {caloriesEaten} / {calorieGoal}
                    </text>
                  </svg>
                  <p className="calorie-msg">
                    {!loggedIn
                      ? 'Sign in to save your calorie goal!'
                      : `You have ${Math.max(calorieGoal - caloriesEaten, 0)} calories remaining`}
                  </p>
                  <CalorieEditor calorieGoal={calorieGoal} setCalorieGoal={setCalorieGoal} />
                </div>
              </div>

              <div className="card log-card">
                <h2>Log Foods</h2>

                <div className="meal-select">
                  <label>
                    <input type="radio" name="meal" value="breakfast" checked={selectedMeal === 'breakfast'} onChange={() => setSelectedMeal('breakfast')} />
                    Breakfast
                  </label>
                  <label>
                    <input type="radio" name="meal" value="lunch" checked={selectedMeal === 'lunch'} onChange={() => setSelectedMeal('lunch')} />
                    Lunch
                  </label>
                  <label>
                    <input type="radio" name="meal" value="dinner" checked={selectedMeal === 'dinner'} onChange={() => setSelectedMeal('dinner')} />
                    Dinner
                  </label>
                  <label>
                    <input type="radio" name="meal" value="snacks" checked={selectedMeal === 'snacks'} onChange={() => setSelectedMeal('snacks')} />
                    Snacks
                  </label>
                </div>

                <input
                  placeholder="e.g. Chicken Breast"
                  className="search-bar"
                  value={foodSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFoodSearch(value);
                    fetchSuggestions(value);
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={servingSize}
                    onChange={e => setServingSize(Number(e.target.value))}
                    className="serving-input"
                    placeholder="Amount"
                  />
                  <select value={servingUnit} onChange={e => setServingUnit(e.target.value)} className="serving-unit-select">
                    <option value="serving">serving (default)</option>
                    <option value="grams">grams</option>
                    <option value="oz">ounces</option>
                    <option value="cup">cups</option>
                    <option value="tbsp">tablespoons</option>
                    <option value="tsp">teaspoons</option>
                  </select>
                </div>

                {suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((item, index) => (
                      <li key={index} onClick={() => { setFoodSearch(item); setSuggestions([]); }} className="suggestion-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                <button className='searchlog' onClick={searchAndLogFood}>Search & Log</button>
                {message && <p className="message">{message}</p>}
              </div>
            </div>

            <div className="card logged-foods-box">
              <h2>Logged Foods</h2>
              <div className="logged-foods-container">
                {['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => (
                  <div key={meal} className="logged-foods-section">
                    <h3>{meal.charAt(0).toUpperCase() + meal.slice(1)}</h3>
                    {loggedFoods[meal].length === 0 ? (
                      <p>No foods logged yet.</p>
                    ) : (
                      <ul>
                        {loggedFoods[meal].map((food, index) => (
                          <li key={index}>
                            {food.name} - {food.calories} cal
                            {food.servingSize && <> ({food.servingSize})</>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <button className="clear-button" onClick={clearLogs}>Clear All Logs</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'Login') {
    return (
      <div className="landing-wrapper">
        <div className="landing-card">
          <img src="/logoMacro.png" alt="MacroTracker Logo" className="landing-card-logo" />
          <h2 className="landing-title">Log In</h2>
          <input className="auth-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="auth-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="landing-button" onClick={loginUser}>Submit</button>
          <button className="back-button" onClick={() => { setStarted(false); setUsername(''); setPassword(''); setMessage(''); setScreen('home'); }}>Back</button>
          <p className="message">{message}</p>
        </div>
      </div>
    );
  }

  if (screen === 'Register') {
    return (
      <div className="landing-wrapper">
        <div className="landing-card">
          <img src="/logoMacro.png" alt="MacroTracker Logo" className="landing-card-logo" />
          <h2 className="landing-title">Sign Up</h2>
          <input className="auth-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="auth-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <input className="auth-input" placeholder="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          <button className="submitbutton" onClick={registerUser}>Submit</button>
          <button className="back-button" onClick={() => { setStarted(false); setUsername(''); setPassword(''); setConfirmPassword(''); setMessage(''); setScreen('home'); }}>Back</button>
          <p className="message">{message}</p>
        </div>
      </div>
    );
  }
}

export default App;
