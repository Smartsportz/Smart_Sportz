from app.db.database import row
print(row('SELECT COUNT(*) AS c FROM users'))
for item in row('SELECT id, email, role, google_login FROM users LIMIT 10'):
    print(item)
