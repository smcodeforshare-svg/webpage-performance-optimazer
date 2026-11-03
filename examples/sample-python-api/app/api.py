import requests

async def get_user_data():
    response = requests.get('https://api.example.com/users')
    return response.json()
