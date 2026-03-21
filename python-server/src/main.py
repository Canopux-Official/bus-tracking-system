# src/main.py
from src import create_app,db
from src.database.models import Bus

app = create_app()

# For dev only: create tables automatically
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)