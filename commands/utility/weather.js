import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

/**
 * 🌤️ Weather Command
 * Gets real-time weather data for any location worldwide
 * Supports cities, towns, villages, coordinates, etc.
 */

// Cache to avoid hitting API limits
const weatherCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

// Multiple weather data sources for accuracy
const WEATHER_SOURCES = {
    // Primary: OpenWeatherMap (accurate, reliable)
    OPENWEATHER: {
        name: 'OpenWeatherMap',
        apiKey: process.env.OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY', // Get free key from https://openweathermap.org/api
        endpoints: {
            current: 'https://api.openweathermap.org/data/2.5/weather',
            forecast: 'https://api.openweathermap.org/data/2.5/forecast',
            geocode: 'http://api.openweathermap.org/geo/1.0/direct'
        }
    },
    
    // Fallback: WeatherAPI (good for smaller towns)
    WEATHERAPI: {
        name: 'WeatherAPI',
        apiKey: process.env.WEATHERAPI_KEY || 'YOUR_WEATHERAPI_KEY', // Get free key from https://www.weatherapi.com/
        endpoint: 'https://api.weatherapi.com/v1/current.json'
    },
    
    // Backup: Open-Meteo (no API key needed for basic)
    OPENMETEO: {
        name: 'Open-Meteo',
        endpoint: 'https://api.open-meteo.com/v1/forecast'
    }
};

// Weather condition emojis
const WEATHER_EMOJIS = {
    'clear': '☀️',
    'clouds': '☁️',
    'rain': '🌧️',
    'drizzle': '🌦️',
    'thunderstorm': '⛈️',
    'snow': '❄️',
    'mist': '🌫️',
    'smoke': '💨',
    'haze': '🌫️',
    'dust': '💨',
    'fog': '🌁',
    'sand': '💨',
    'ash': '🌋',
    'squall': '💨',
    'tornado': '🌪️',
    'default': '🌤️'
};

// Wind direction mapping
const WIND_DIRECTIONS = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

// Unit conversions
function convertKelvinToCelsius(kelvin) {
    return Math.round(kelvin - 273.15);
}

function convertKelvinToFahrenheit(kelvin) {
    return Math.round((kelvin - 273.15) * 9/5 + 32);
}

function metersPerSecondToKmh(mps) {
    return Math.round(mps * 3.6);
}

function metersPerSecondToMph(mps) {
    return Math.round(mps * 2.237);
}

function getWindDirection(degrees) {
    const index = Math.round(degrees / 22.5) % 16;
    return WIND_DIRECTIONS[index];
}

function getWeatherEmoji(condition) {
    const lowerCondition = condition.toLowerCase();
    
    for (const [key, emoji] of Object.entries(WEATHER_EMOJIS)) {
        if (lowerCondition.includes(key)) {
            return emoji;
        }
    }
    
    return WEATHER_EMOJIS.default;
}

// Get emoji based on temperature
function getTemperatureEmoji(tempC) {
    if (tempC >= 30) return '🔥';
    if (tempC >= 25) return '☀️';
    if (tempC >= 20) return '😊';
    if (tempC >= 15) return '😐';
    if (tempC >= 10) return '🧥';
    if (tempC >= 5) return '❄️';
    if (tempC >= 0) return '🥶';
    return '🧊';
}

// Format time
function formatTime(timestamp, timezoneOffset = 0) {
    const date = new Date((timestamp + timezoneOffset) * 1000);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// Format date
function formatDate(timestamp, timezoneOffset = 0) {
    const date = new Date((timestamp + timezoneOffset) * 1000);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Calculate feels like temperature
function calculateFeelsLike(temp, humidity, windSpeed) {
    // Using heat index approximation for feels like temperature
    if (temp >= 24) {
        // Heat index calculation (simplified)
        return Math.round(temp + 0.1 * humidity - 0.1 * windSpeed);
    } else if (temp <= 10) {
        // Wind chill approximation
        return Math.round(13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16));
    }
    return temp;
}

// Get UV index description
function getUvIndexDescription(uv) {
    if (uv >= 11) return 'Extreme (Avoid sun)';
    if (uv >= 8) return 'Very High (Protection required)';
    if (uv >= 6) return 'High (Protection advised)';
    if (uv >= 3) return 'Moderate (Protection suggested)';
    return 'Low (No protection needed)';
}

// Get air quality description
function getAirQualityDescription(aq) {
    const aqiMap = {
        1: 'Good 👍',
        2: 'Fair 👌',
        3: 'Moderate 😷',
        4: 'Poor 😷',
        5: 'Very Poor 🚫'
    };
    return aqiMap[aq] || 'Unknown';
}

// Get location coordinates from name
async function geocodeLocation(locationName) {
    try {
        // Try OpenWeatherMap geocoding first
        const owmUrl = `${WEATHER_SOURCES.OPENWEATHER.endpoints.geocode}?q=${encodeURIComponent(locationName)}&limit=5&appid=${WEATHER_SOURCES.OPENWEATHER.apiKey}`;
        const owmResponse = await fetch(owmUrl);
        const owmData = await owmResponse.json();
        
        if (owmData && owmData.length > 0) {
            const result = owmData[0];
            return {
                lat: result.lat,
                lon: result.lon,
                name: result.name,
                country: result.country,
                state: result.state,
                source: 'OpenWeatherMap'
            };
        }
        
        // Fallback: Nominatim (OpenStreetMap) - no API key needed
        const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
        const osmResponse = await fetch(osmUrl, {
            headers: { 'User-Agent': 'WeatherBot/1.0' }
        });
        const osmData = await osmResponse.json();
        
        if (osmData && osmData.length > 0) {
            const result = osmData[0];
            return {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                name: result.display_name.split(',')[0],
                country: result.display_name.split(',').pop().trim(),
                source: 'OpenStreetMap'
            };
        }
        
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Get weather data from OpenWeatherMap
async function getWeatherFromOpenWeatherMap(lat, lon, locationName) {
    try {
        const cacheKey = `owm_${lat}_${lon}`;
        const cached = weatherCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Using cached OpenWeatherMap data');
            return cached.data;
        }
        
        const url = `${WEATHER_SOURCES.OPENWEATHER.endpoints.current}?lat=${lat}&lon=${lon}&appid=${WEATHER_SOURCES.OPENWEATHER.apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`OpenWeatherMap API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Get forecast for next few hours
        const forecastUrl = `${WEATHER_SOURCES.OPENWEATHER.endpoints.forecast}?lat=${lat}&lon=${lon}&appid=${WEATHER_SOURCES.OPENWEATHER.apiKey}&cnt=4`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        
        const weatherInfo = {
            source: WEATHER_SOURCES.OPENWEATHER.name,
            location: {
                name: locationName || data.name,
                country: data.sys.country,
                lat: data.coord.lat,
                lon: data.coord.lon
            },
            current: {
                temperature: {
                    celsius: convertKelvinToCelsius(data.main.temp),
                    fahrenheit: convertKelvinToFahrenheit(data.main.temp),
                    kelvin: data.main.temp
                },
                feels_like: {
                    celsius: convertKelvinToCelsius(data.main.feels_like),
                    fahrenheit: convertKelvinToFahrenheit(data.main.feels_like)
                },
                condition: data.weather[0].main,
                description: data.weather[0].description,
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                wind: {
                    speed: data.wind.speed,
                    direction: data.wind.deg ? getWindDirection(data.wind.deg) : 'N/A',
                    deg: data.wind.deg
                },
                clouds: data.clouds.all,
                visibility: data.visibility / 1000, // Convert to km
                sunrise: formatTime(data.sys.sunrise, data.timezone),
                sunset: formatTime(data.sys.sunset, data.timezone),
                timezone: data.timezone,
                timestamp: data.dt,
                date: formatDate(data.dt, data.timezone)
            },
            forecast: [],
            additional: {
                uv_index: null, // OWM requires separate UV API call
                air_quality: null // OWM requires separate Air Quality API
            }
        };
        
        // Parse forecast data
        if (forecastData && forecastData.list) {
            weatherInfo.forecast = forecastData.list.slice(0, 4).map(item => ({
                time: formatTime(item.dt, data.timezone),
                temp: convertKelvinToCelsius(item.main.temp),
                condition: item.weather[0].main,
                description: item.weather[0].description
            }));
        }
        
        weatherCache.set(cacheKey, {
            data: weatherInfo,
            timestamp: Date.now()
        });
        
        return weatherInfo;
    } catch (error) {
        console.error('OpenWeatherMap error:', error);
        throw error;
    }
}

// Get weather data from WeatherAPI (good for small towns)
async function getWeatherFromWeatherAPI(locationName) {
    try {
        const cacheKey = `weatherapi_${locationName}`;
        const cached = weatherCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Using cached WeatherAPI data');
            return cached.data;
        }
        
        const url = `${WEATHER_SOURCES.WEATHERAPI.endpoint}?key=${WEATHER_SOURCES.WEATHERAPI.apiKey}&q=${encodeURIComponent(locationName)}&aqi=yes`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`WeatherAPI error: ${response.status}`);
        }
        
        const data = await response.json();
        
        const weatherInfo = {
            source: WEATHER_SOURCES.WEATHERAPI.name,
            location: {
                name: data.location.name,
                country: data.location.country,
                region: data.location.region,
                lat: data.location.lat,
                lon: data.location.lon,
                localtime: data.location.localtime
            },
            current: {
                temperature: {
                    celsius: data.current.temp_c,
                    fahrenheit: data.current.temp_f
                },
                feels_like: {
                    celsius: data.current.feelslike_c,
                    fahrenheit: data.current.feelslike_f
                },
                condition: data.current.condition.text,
                description: data.current.condition.text,
                humidity: data.current.humidity,
                pressure: data.current.pressure_mb,
                wind: {
                    speed: data.current.wind_kph / 3.6, // Convert to m/s
                    direction: data.current.wind_dir,
                    deg: null
                },
                clouds: data.current.cloud,
                visibility: data.current.vis_km,
                uv_index: data.current.uv,
                air_quality: data.current.air_quality ? {
                    pm2_5: data.current.air_quality.pm2_5,
                    pm10: data.current.air_quality.pm10,
                    o3: data.current.air_quality.o3,
                    no2: data.current.air_quality.no2,
                    so2: data.current.air_quality.so2,
                    co: data.current.air_quality.co,
                    us_epa_index: data.current.air_quality['us-epa-index'],
                    gb_defra_index: data.current.air_quality['gb-defra-index']
                } : null,
                last_updated: data.current.last_updated
            },
            additional: {
                sunrise: null,
                sunset: null
            }
        };
        
        weatherCache.set(cacheKey, {
            data: weatherInfo,
            timestamp: Date.now()
        });
        
        return weatherInfo;
    } catch (error) {
        console.error('WeatherAPI error:', error);
        throw error;
    }
}

// Get weather data from Open-Meteo (no API key needed)
async function getWeatherFromOpenMeteo(lat, lon, locationName) {
    try {
        const cacheKey = `openmeteo_${lat}_${lon}`;
        const cached = weatherCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Using cached Open-Meteo data');
            return cached.data;
        }
        
        const url = `${WEATHER_SOURCES.OPENMETEO.endpoint}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m&timezone=auto`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Open-Meteo API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        const weatherInfo = {
            source: WEATHER_SOURCES.OPENMETEO.name,
            location: {
                name: locationName,
                lat: lat,
                lon: lon,
                timezone: data.timezone
            },
            current: {
                temperature: {
                    celsius: data.current_weather.temperature,
                    fahrenheit: Math.round(data.current_weather.temperature * 9/5 + 32)
                },
                condition: getConditionFromWeatherCode(data.current_weather.weathercode),
                description: getWeatherDescription(data.current_weather.weathercode),
                wind: {
                    speed: data.current_weather.windspeed,
                    direction: getWindDirection(data.current_weather.winddirection)
                },
                time: new Date(data.current_weather.time).toLocaleTimeString()
            }
        };
        
        weatherCache.set(cacheKey, {
            data: weatherInfo,
            timestamp: Date.now()
        });
        
        return weatherInfo;
    } catch (error) {
        console.error('Open-Meteo error:', error);
        throw error;
    }
}

// Helper for Open-Meteo weather codes
function getConditionFromWeatherCode(code) {
    const codes = {
        0: 'Clear',
        1: 'Mainly Clear',
        2: 'Partly Cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing Rime Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Dense Drizzle',
        56: 'Light Freezing Drizzle',
        57: 'Dense Freezing Drizzle',
        61: 'Slight Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        66: 'Light Freezing Rain',
        67: 'Heavy Freezing Rain',
        71: 'Slight Snow',
        73: 'Moderate Snow',
        75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Slight Rain Showers',
        81: 'Moderate Rain Showers',
        82: 'Violent Rain Showers',
        85: 'Slight Snow Showers',
        86: 'Heavy Snow Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Slight Hail',
        99: 'Thunderstorm with Heavy Hail'
    };
    return codes[code] || 'Unknown';
}

function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Heavy thunderstorm with hail'
    };
    return descriptions[code] || 'Weather conditions not specified';
}

// Main weather function that tries multiple sources
async function getWeatherData(location) {
    try {
        console.log(`Fetching weather for: ${location}`);
        
        // First, try to geocode the location
        const geoData = await geocodeLocation(location);
        
        if (!geoData) {
            throw new Error(`Location "${location}" not found. Try being more specific.`);
        }
        
        const { lat, lon, name, country } = geoData;
        console.log(`Found location: ${name}, ${country} (${lat}, ${lon})`);
        
        // Try sources in order of preference
        let weatherData = null;
        const sourcesToTry = [
            () => getWeatherFromOpenWeatherMap(lat, lon, name),
            () => getWeatherFromWeatherAPI(`${name}, ${country}`),
            () => getWeatherFromOpenMeteo(lat, lon, name)
        ];
        
        for (const source of sourcesToTry) {
            try {
                weatherData = await source();
                if (weatherData) break;
            } catch (error) {
                console.warn(`Source failed: ${error.message}`);
                continue;
            }
        }
        
        if (!weatherData) {
            throw new Error('All weather sources failed. Please try again later.');
        }
        
        return weatherData;
    } catch (error) {
        console.error('Weather data fetch error:', error);
        throw error;
    }
}

// Format weather data into a nice message
function formatWeatherMessage(weatherData, locationQuery) {
    const { location, current, source, forecast } = weatherData;
    const emoji = getWeatherEmoji(current.condition);
    const tempEmoji = getTemperatureEmoji(current.temperature.celsius);
    
    let message = `🌤️ *WEATHER REPORT* 🌤️\n`;
    message += `📍 *Location:* ${location.name}, ${location.country || ''}\n`;
    message += `📅 *Date:* ${current.date || 'Today'}\n`;
    message += `⏰ *Time:* ${current.time || new Date().toLocaleTimeString()}\n`;
    message += `📡 *Source:* ${source}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Current conditions
    message += `${emoji} *Current Conditions*\n`;
    message += `• Condition: ${current.condition} (${current.description})\n`;
    message += `• Temperature: ${current.temperature.celsius}°C ${tempEmoji} / ${current.temperature.fahrenheit}°F\n`;
    
    if (current.feels_like) {
        message += `• Feels like: ${current.feels_like.celsius}°C / ${current.feels_like.fahrenheit}°F\n`;
    }
    
    if (current.humidity !== undefined) {
        message += `• Humidity: ${current.humidity}% 💧\n`;
    }
    
    if (current.wind && current.wind.speed) {
        const windKmh = metersPerSecondToKmh(current.wind.speed);
        const windMph = metersPerSecondToMph(current.wind.speed);
        message += `• Wind: ${windKmh} km/h 💨 (${windMph} mph) ${current.wind.direction || ''}\n`;
    }
    
    if (current.pressure !== undefined) {
        message += `• Pressure: ${current.pressure} hPa 📊\n`;
    }
    
    if (current.visibility !== undefined) {
        message += `• Visibility: ${current.visibility} km 👁️\n`;
    }
    
    if (current.clouds !== undefined) {
        message += `• Cloudiness: ${current.clouds}% ☁️\n`;
    }
    
    if (current.uv_index !== undefined && current.uv_index !== null) {
        message += `• UV Index: ${current.uv_index} (${getUvIndexDescription(current.uv_index)})\n`;
    }
    
    if (current.air_quality && current.air_quality.us_epa_index) {
        message += `• Air Quality: ${getAirQualityDescription(current.air_quality.us_epa_index)}\n`;
    }
    
    if (current.sunrise && current.sunset) {
        message += `• Sunrise: ${current.sunrise} 🌅\n`;
        message += `• Sunset: ${current.sunset} 🌇\n`;
    }
    
    // Forecast for next few hours
    if (forecast && forecast.length > 0) {
        message += `\n📅 *Next Few Hours*\n`;
        forecast.forEach(hour => {
            message += `• ${hour.time}: ${hour.temp}°C, ${hour.description}\n`;
        });
    }
    
    // Recommendations
    message += `\n💡 *Recommendations*\n`;
    
    // Temperature-based recommendations
    if (current.temperature.celsius >= 30) {
        message += `• Stay hydrated 💧\n`;
        message += `• Wear light clothing 👕\n`;
        message += `• Avoid direct sun ☀️\n`;
    } else if (current.temperature.celsius >= 20) {
        message += `• Pleasant weather 😊\n`;
        message += `• Good for outdoor activities 🚶‍♂️\n`;
    } else if (current.temperature.celsius >= 10) {
        message += `• Light jacket recommended 🧥\n`;
    } else if (current.temperature.celsius >= 0) {
        message += `• Wear warm clothing 🧣\n`;
        message += `• Watch for ice ⚠️\n`;
    } else {
        message += `• Extreme cold! ❄️\n`;
        message += `• Stay indoors if possible 🏠\n`;
    }
    
    // Weather condition recommendations
    if (current.condition.toLowerCase().includes('rain')) {
        message += `• Bring an umbrella ☂️\n`;
        message += `• Watch for slippery surfaces ⚠️\n`;
    }
    
    if (current.condition.toLowerCase().includes('snow')) {
        message += `• Drive carefully if driving 🚗\n`;
        message += `• Dress in layers 🧥\n`;
    }
    
    if (current.condition.toLowerCase().includes('thunderstorm')) {
        message += `• Stay indoors 🏠\n`;
        message += `• Avoid tall objects ⚡\n`;
    }
    
    if (current.wind && metersPerSecondToKmh(current.wind.speed) > 30) {
        message += `• Windy! Secure loose items 💨\n`;
    }
    
    if (current.uv_index && current.uv_index >= 6) {
        message += `• Use sunscreen 🧴\n`;
        message += `• Wear sunglasses 😎\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⏱️ *Last Updated:* ${new Date().toLocaleTimeString()}\n`;
    message += `🔍 *Query:* "${locationQuery}"\n`;
    
    return message;
}

// Weather command
export default {
    name: "weather",
    description: "Get accurate weather information for any location worldwide",
    category: "utility",
    usage: "weather <city/town> or weather <city>, <country>",
    
    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        
        if (!args || args.length === 0) {
            return sock.sendMessage(jid, {
                text: "❌ *Please specify a location*\n\n" +
                      "📝 *Usage:*\n" +
                      "• .weather Nairobi\n" +
                      "• .weather London, UK\n" +
                      "• .weather New York City\n" +
                      "• .weather Tokyo, Japan\n\n" +
                      "🌍 *Works for:*\n" +
                      "• Major cities (Nairobi, London)\n" +
                      "• Small towns (Nakuru, Kisumu)\n" +
                      "• Villages (specify country)\n" +
                      "• Coordinates (35.6762, 139.6503)\n\n" +
                      "💡 *Tip:* Be specific for better results!"
            }, { quoted: m });
        }
        
        const location = args.join(' ');
        
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', jid);
        
        try {
            // Send initial message
            const statusMsg = await sock.sendMessage(jid, {
                text: `🔍 *Searching weather for:*\n"${location}"\n\n⏳ Please wait while I fetch real-time data...`
            }, { quoted: m });
            
            // Get weather data
            const weatherData = await getWeatherData(location);
            
            // Format and send weather report
            const weatherMessage = formatWeatherMessage(weatherData, location);
            
            // Send the weather report
            await sock.sendMessage(jid, {
                text: weatherMessage
            }, { quoted: m });
            
            // Try to send additional info if available
            try {
                const { current } = weatherData;
                
                // Send air quality info if available
                if (current.air_quality) {
                    const aq = current.air_quality;
                    let airQualityMsg = `🌬️ *AIR QUALITY DETAILS*\n`;
                    airQualityMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
                    
                    if (aq.pm2_5) airQualityMsg += `• PM2.5: ${aq.pm2_5.toFixed(1)} μg/m³\n`;
                    if (aq.pm10) airQualityMsg += `• PM10: ${aq.pm10.toFixed(1)} μg/m³\n`;
                    if (aq.o3) airQualityMsg += `• Ozone: ${aq.o3.toFixed(1)} ppb\n`;
                    if (aq.no2) airQualityMsg += `• NO₂: ${aq.no2.toFixed(1)} ppb\n`;
                    if (aq.so2) airQualityMsg += `• SO₂: ${aq.so2.toFixed(1)} ppb\n`;
                    if (aq.co) airQualityMsg += `• CO: ${aq.co.toFixed(1)} mg/m³\n`;
                    
                    airQualityMsg += `\n⚠️ *Health Advice:*\n`;
                    const aqi = aq.us_epa_index || aq.gb_defra_index;
                    
                    if (aqi === 1) airQualityMsg += `• Air quality is good\n• Outdoor activities are safe`;
                    else if (aqi === 2) airQualityMsg += `• Air quality is acceptable\n• Sensitive groups may be affected`;
                    else if (aqi === 3) airQualityMsg += `• Sensitive groups should limit outdoor exertion`;
                    else if (aqi === 4) airQualityMsg += `• Everyone may begin to experience health effects`;
                    else if (aqi === 5) airQualityMsg += `• Health warning: Avoid outdoor activities`;
                    
                    await sock.sendMessage(jid, { text: airQualityMsg });
                }
                
                // Send forecast if available
                if (weatherData.forecast && weatherData.forecast.length > 0) {
                    let forecastMsg = `📅 *EXTENDED FORECAST*\n`;
                    forecastMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
                    
                    weatherData.forecast.forEach((hour, index) => {
                        forecastMsg += `• ${hour.time}: ${hour.temp}°C, ${hour.description}\n`;
                    });
                    
                    forecastMsg += `\n💡 Updated every 3 hours`;
                    
                    await sock.sendMessage(jid, { text: forecastMsg });
                }
                
            } catch (additionalError) {
                console.log('Could not send additional info:', additionalError.message);
            }
            
        } catch (error) {
            console.error('Weather command error:', error);
            
            let errorMessage = `❌ *Weather Fetch Failed*\n\n`;
            
            if (error.message.includes('not found') || error.message.includes('location')) {
                errorMessage += `*Reason:* Location not found\n`;
                errorMessage += `*Solution:*\n`;
                errorMessage += `• Check spelling 📝\n`;
                errorMessage += `• Add country code (e.g., "Paris, France")\n`;
                errorMessage += `• Be more specific\n\n`;
                errorMessage += `💡 *Examples:*\n`;
                errorMessage += `• .weather Nairobi, Kenya\n`;
                errorMessage += `• .weather 51.5074, -0.1278 (coordinates)\n`;
                errorMessage += `• .weather New York City, USA\n`;
            } else if (error.message.includes('API') || error.message.includes('source')) {
                errorMessage += `*Reason:* Weather service temporarily unavailable\n`;
                errorMessage += `*Solution:* Try again in a few minutes\n\n`;
                errorMessage += `💡 *Alternative:*\n`;
                errorMessage += `• Check weather on:\n`;
                errorMessage += `• https://weather.com\n`;
                errorMessage += `• https://accuweather.com\n`;
            } else {
                errorMessage += `*Error:* ${error.message}\n`;
                errorMessage += `*Solution:* Please try again later`;
            }
            
            await sock.sendMessage(jid, { text: errorMessage }, { quoted: m });
        } finally {
            // Stop typing indicator
            await sock.sendPresenceUpdate('paused', jid);
        }
    }
};

// Additional helper commands
export const weatherUtils = {
    // Clear weather cache
    clearCache: () => {
        weatherCache.clear();
        return '✅ Weather cache cleared';
    },
    
    // Get cache stats
    getCacheStats: () => {
        return `📊 Weather Cache Stats:\n` +
               `• Entries: ${weatherCache.size}\n` +
               `• Memory: ~${Math.round((JSON.stringify(Array.from(weatherCache.entries())).length / 1024))} KB`;
    },
    
    // Test if location is valid
    testLocation: async (location) => {
        try {
            const geoData = await geocodeLocation(location);
            if (geoData) {
                return `✅ Location found:\n` +
                       `• Name: ${geoData.name}\n` +
                       `• Country: ${geoData.country}\n` +
                       `• Coordinates: ${geoData.lat}, ${geoData.lon}\n` +
                       `• Source: ${geoData.source}`;
            } else {
                return '❌ Location not found';
            }
        } catch (error) {
            return `❌ Error: ${error.message}`;
        }
    }
};

// Quick weather function for other modules to use
export async function getQuickWeather(location) {
    try {
        const weatherData = await getWeatherData(location);
        const { current } = weatherData;
        
        return {
            temp: current.temperature.celsius,
            condition: current.condition,
            emoji: getWeatherEmoji(current.condition),
            humidity: current.humidity,
            wind: current.wind?.speed ? metersPerSecondToKmh(current.wind.speed) : null
        };
    } catch {
        return null;
    }
}