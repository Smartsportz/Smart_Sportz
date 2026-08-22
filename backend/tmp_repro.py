from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
for path in ['/api/v1/admin/tournaments', '/api/v1/admin/managers']:
    response = client.get(path)
    print(path, response.status_code)
    print(response.text)
    print('---')
