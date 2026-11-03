from fastapi import FastAPI
import requests

app = FastAPI()

# Bottleneck 1: Synchronous requests.get in an async def endpoint freezes the asyncio event loop
# Bottleneck 2: Missing timeout= parameter
@app.get("/api/weather")
async def get_weather(city: str):
    response = requests.get(f"https://api.weather.local/forecast?city={city}")
    return response.json()

@app.get("/api/status")
def health_check():
    return {"status": "healthy"}
