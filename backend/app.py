import os
import requests
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

db_url = os.environ.get("DATABASE_URL") or "sqlite:///local_dev.db"
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get("JWT_SECRET_KEY", "dev-secret")

db = SQLAlchemy(app)

CORS(app, resources={r"/*": {"origins": "*"}})

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    calorie_goal = db.Column(db.Integer, default=2000)

with app.app_context():
    db.create_all()

@app.route('/')
def home():
    return 'Backend is running!'

@app.route('/user/<username>/goal', methods=['GET'])
def get_goal(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'calorieGoal': user.calorie_goal}), 200

@app.route('/user/<username>/goal', methods=['POST'])
def set_goal(username):
    data = request.get_json(silent=True) or {}
    new_goal = data.get('newGoal')
    if new_goal is None:
        return jsonify({'error': 'Missing newGoal'}), 400
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.calorie_goal = new_goal
    db.session.commit()
    return jsonify({'calorieGoal': user.calorie_goal}), 200

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Missing username or password'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Missing username or password'}), 400
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({'error': 'Invalid username or password'}), 401
    return jsonify({'message': 'Login successful', 'username': username}), 200

def get_nutritionix_keys():
    app_id = os.environ.get("NUTRITIONIX_APP_ID")
    app_key = os.environ.get("NUTRITIONIX_APP_KEY") or os.environ.get("NUTRITIONIX_API_KEY")
    if not app_id or not app_key:
        app.logger.warning("Missing Nutritionix credentials.")
        return None, None
    return app_id, app_key


@app.route("/api/nutrition/search", methods=["POST", "OPTIONS"])
def nutrition_search():
    """Proxy POST request to Nutritionix /natural/nutrients."""
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    query = data.get("query")
    if not query:
        return jsonify({"error": "Missing query text"}), 400

    app_id, app_key = get_nutritionix_keys()
    if not app_id:
        return jsonify({"error": "Nutrition service not configured"}), 500

    try:
        response = requests.post(
            "https://trackapi.nutritionix.com/v2/natural/nutrients",
            json={"query": query},
            headers={
                "x-app-id": app_id,
                "x-app-key": app_key,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        data = response.json()
    except Exception as e:
        app.logger.error(f"Nutritionix request failed: {e}")
        return jsonify({"error": "Failed to reach Nutritionix"}), 502

    if response.status_code >= 400:
        app.logger.warning(f"Nutritionix error {response.status_code}: {data}")
        return jsonify({"error": "Nutritionix returned an error"}), response.status_code

    return jsonify(data), 200


@app.route("/api/nutrition/search/instant", methods=["GET", "OPTIONS"])
def nutrition_search_instant():
    """Proxy GET request to Nutritionix /search/instant."""
    if request.method == "OPTIONS":
        return "", 204

    query = request.args.get("query")
    if not query:
        return jsonify({"error": "Missing 'query' parameter"}), 400

    app_id, app_key = get_nutritionix_keys()
    if not app_id:
        return jsonify({"error": "Nutrition service not configured"}), 500

    try:
        response = requests.get(
            "https://trackapi.nutritionix.com/v2/search/instant",
            params={"query": query},
            headers={
                "x-app-id": app_id,
                "x-app-key": app_key,
                "Content-Type": "application/json",
            },
            timeout=8,
        )
        data = response.json()
    except Exception as e:
        app.logger.error(f"Instant search failed: {e}")
        return jsonify({"error": "Nutritionix instant search failed"}), 502

    if response.status_code >= 400:
        return jsonify({"error": "Nutritionix returned an error"}), response.status_code

    return jsonify(data), 200


@app.route("/api/nutrition/natural/nutrients", methods=["POST", "OPTIONS"])
def nutrition_natural_nutrients():
    """Another Nutritionix proxy for detailed nutrient parsing."""
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Missing JSON body"}), 400

    app_id, app_key = get_nutritionix_keys()
    if not app_id:
        return jsonify({"error": "Nutrition service not configured"}), 500

    try:
        response = requests.post(
            "https://trackapi.nutritionix.com/v2/natural/nutrients",
            json=payload,
            headers={
                "x-app-id": app_id,
                "x-app-key": app_key,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        data = response.json()
    except Exception as e:
        app.logger.error(f"Nutritionix nutrient lookup failed: {e}")
        return jsonify({"error": "Nutritionix request failed"}), 502

    if response.status_code >= 400:
        return jsonify({"error": "Nutritionix returned an error"}), response.status_code

    return jsonify(data), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found", "path": request.path}), 404


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=port, debug=debug)
