import sqlite3
import pandas as pd

conn = sqlite3.connect('backend/data.db')
df = pd.read_sql('SELECT * FROM labour', conn)
df.to_json('labour.json', orient='records')
