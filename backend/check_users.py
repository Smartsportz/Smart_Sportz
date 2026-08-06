from app.db.database import row
print('users', row('SELECT COUNT(*) AS c FROM users'))
for user in row('SELECT id, email, role, google_login FROM users LIMIT 10'):
    print(user)
