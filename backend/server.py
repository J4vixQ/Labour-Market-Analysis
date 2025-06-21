from flask import Flask, Response, jsonify
import pandas as pd
import sqlite3
import os

app = Flask(__name__)
app.config["DEBUG"] = True

# Endpoint to get data from the "labour" table
@app.route("/api/v1/get_labour_data", methods=["GET"])
def get_labour_data():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, "data.db")
    connection = sqlite3.connect(db_path)
    df = pd.read_sql('SELECT * FROM labour', con=connection)
    connection.close()
    return Response(
        response=df.to_json(orient="records"),
        headers={"Access-Control-Allow-Origin": "*"}
    )

# Run the Flask app
app.run(port=8080)