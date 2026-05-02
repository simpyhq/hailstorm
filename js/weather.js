const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=35.2226&longitude=-97.4395&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1";
const WEATHER_REFRESH_MS = 600_000;

function weatherCodeToText(code) {
  if (code === 0) {
    return "Clear";
  }

  if (code >= 1 && code <= 3) {
    return "Partly Cloudy";
  }

  if (code >= 45 && code <= 48) {
    return "Foggy";
  }

  if (code >= 51 && code <= 57) {
    return "Drizzle";
  }

  if (code >= 61 && code <= 67) {
    return "Rain";
  }

  if (code >= 71 && code <= 77) {
    return "Snow";
  }

  if (code >= 80 && code <= 82) {
    return "Showers";
  }

  if (code === 95) {
    return "Thunderstorm";
  }

  return "Unknown";
}

function updateText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function renderWeather(data) {
  updateText("weather-temp", `${Math.round(data.temperature)}°F`);
  updateText("weather-condition", data.condition.toUpperCase());
  updateText("weather-highlow", `High: ${Math.round(data.high)}° Low: ${Math.round(data.low)}°`);
  updateText("weather-wind", `Wind: ${Math.round(data.windSpeed)} mph`);
}

async function updateWeather() {
  try {
    const response = await fetch(WEATHER_URL);
    if (!response.ok) {
      throw new Error("Weather request failed");
    }

    const payload = await response.json();
    const current = payload?.current;
    const daily = payload?.daily;
    const high = daily?.temperature_2m_max?.[0];
    const low = daily?.temperature_2m_min?.[0];

    if (
      !Number.isFinite(current?.temperature_2m) ||
      !Number.isFinite(current?.windspeed_10m) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low)
    ) {
      throw new Error("Weather payload missing fields");
    }

    renderWeather({
      temperature: current.temperature_2m,
      condition: weatherCodeToText(current.weathercode),
      windSpeed: current.windspeed_10m,
      high,
      low,
    });
  } catch {
    return;
  }
}

export function initWeather() {
  updateWeather().catch(() => {});
  window.setInterval(() => {
    updateWeather().catch(() => {});
  }, WEATHER_REFRESH_MS);
}
