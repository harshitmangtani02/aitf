export interface WeatherData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  cloudCover: number;
  uvIndex: number;
  weatherCode: number;
  description: string;
}

export interface LocationData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

// Weather code to description mapping for Open-Meteo
const weatherCodeDescriptions: { [key: number]: string } = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

// Country capitals mapping
const countryCapitals: { [key: string]: string } = {
  'united states': 'Washington, D.C.',
  'usa': 'Washington, D.C.',
  'us': 'Washington, D.C.',
  'united kingdom': 'London',
  'uk': 'London',
  'japan': 'Tokyo',
  'china': 'Beijing',
  'india': 'New Delhi',
  'germany': 'Berlin',
  'france': 'Paris',
  'italy': 'Rome',
  'spain': 'Madrid',
  'canada': 'Ottawa',
  'australia': 'Canberra',
  'brazil': 'Brasília',
  'russia': 'Moscow',
  'south korea': 'Seoul',
  'mexico': 'Mexico City',
  'netherlands': 'Amsterdam',
  'sweden': 'Stockholm',
  'norway': 'Oslo',
  'denmark': 'Copenhagen',
  'finland': 'Helsinki',
  'switzerland': 'Bern',
  'austria': 'Vienna',
  'belgium': 'Brussels',
  'portugal': 'Lisbon',
  'greece': 'Athens',
  'turkey': 'Ankara',
  'egypt': 'Cairo',
  'south africa': 'Cape Town',
  'argentina': 'Buenos Aires',
  'chile': 'Santiago',
  'colombia': 'Bogotá',
  'peru': 'Lima',
  'venezuela': 'Caracas',
  'thailand': 'Bangkok',
  'vietnam': 'Hanoi',
  'singapore': 'Singapore',
  'malaysia': 'Kuala Lumpur',
  'indonesia': 'Jakarta',
  'philippines': 'Manila',
  'new zealand': 'Wellington',
  'israel': 'Jerusalem',
  'saudi arabia': 'Riyadh',
  'uae': 'Abu Dhabi',
  'united arab emirates': 'Abu Dhabi',
  'poland': 'Warsaw',
  'czech republic': 'Prague',
  'hungary': 'Budapest',
  'romania': 'Bucharest',
  'bulgaria': 'Sofia',
  'croatia': 'Zagreb',
  'serbia': 'Belgrade',
  'ukraine': 'Kyiv',
  'belarus': 'Minsk',
  'lithuania': 'Vilnius',
  'latvia': 'Riga',
  'estonia': 'Tallinn'
};

// Simple fallback function to get location data directly
export async function getLocationData(cityName: string): Promise<LocationData> {
  // Get coordinates using geocoding API
  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
  );

  if (!geoResponse.ok) {
    throw new Error(`Geocoding API error: ${geoResponse.status}`);
  }

  const geoData = await geoResponse.json();

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`Location not found: ${cityName}`);
  }

  const location = geoData.results[0];

  return {
    city: location.name,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude
  };
}

export interface LocationRequest {
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  requestTime: string;
  targetDate?: string; // YYYY-MM-DD format
  dateType: 'current' | 'historical' | 'forecast';
}

interface ConversationState {
  lastCity: string | null;
  lastCountry: string | null;
  lastDate: string | null;
  lastDateType: string | null;
}

export async function analyzeUserQuery(
  query: string, 
  language: string = 'en', 
  previousUserMessages: string[] = [], 
  conversationState?: ConversationState
): Promise<LocationRequest & { isWeatherQuery?: boolean; nonWeatherResponse?: string }> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🔍 Analyzing user query:', query);
  console.log('🌐 Query language:', language);
  console.log('📍 Previous user messages:', previousUserMessages);
  console.log('🏙️ Conversation state:', conversationState);
  console.log('🔍 Previous messages formatted:\n', previousUserMessages.map((msg, index) => `${index + 1}. ${msg}`).join('\n'));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an intelligent weather assistant. Analyze the user's query and determine:

1. Is this a weather-related query? (weather, climate, temperature, travel advice, clothing recommendations, etc.)
2. If yes, extract location and date information from the current query and conversation context.

CONVERSATION CONTEXT:
${previousUserMessages.length > 0 ? `Previous user messages:\n${previousUserMessages.map((msg, index) => `${index + 1}. ${msg}`).join('\n')}` : 'No previous context'}

LAST WEATHER CONTEXT (from previous OpenAI responses):
- Last City: ${conversationState?.lastCity || 'None'}
- Last Country: ${conversationState?.lastCountry || 'None'}  
- Last Date: ${conversationState?.lastDate || 'None'}
- Last Date Type: ${conversationState?.lastDateType || 'None'}

Current user query language: ${language === 'ja' ? 'Japanese' : 'English'}

Return ONLY a JSON object with the following format:

{
  "isWeatherQuery": true/false,
  "nonWeatherResponse": "polite response if not weather-related, in ${language === 'ja' ? 'Japanese' : 'English'} or null",
  "city": "City Name or null",
  "country": "Country Name or null", 
  "latitude": 0.0,
  "longitude": 0.0,
  "timezone": "timezone_identifier",
  "requestTime": "current_time_iso",
  "targetDate": "YYYY-MM-DD or null",
  "dateType": "current|historical|forecast",
  "missingInfo": "location|time|none",
  "errorMessage": "user-friendly message in ${language === 'ja' ? 'Japanese' : 'English'} or null"
}

CRITICAL INSTRUCTIONS:

1. **Weather Query Detection**: 
   - Weather-related: weather, climate, temperature, rain, snow, wind, sunny, cloudy, humidity, forecast, conditions, travel advice, clothing recommendations, what to wear, etc.
   - Follow-up queries: "how about tomorrow", "what about 2 October", "明日はどう", "10月1日は", "How about October 1st?", etc.
   - If NOT weather-related: set isWeatherQuery: false and provide polite response

2. **Location Extraction - USE PERSISTENT STATE**:
   - FIRST: Look for locations in current query
   - IF NO LOCATION in current query: Use the "Last City" from the LAST WEATHER CONTEXT above
   - The "Last City" is the most recent city returned by OpenAI in previous responses
   - EXAMPLE: If Last City is "Delhi" and current query is "How about October 1st?", use "Delhi"
   - Use approximate coordinates for major cities (Tokyo: 35.6762, 139.6503; Delhi: 28.6139, 77.2090; London: 51.5074, -0.1278; etc.)
   - ONLY set city to null if NO location is found in current query AND Last City is "None"

3. **Date Processing**:
   - Current date: ${new Date().toISOString().split('T')[0]}
   - "today/今日" -> dateType: "current", targetDate: null
   - "tomorrow/明日" -> dateType: "forecast", targetDate: tomorrow's date  
   - "yesterday/昨日" -> dateType: "historical", targetDate: yesterday's date
   - "October 1st", "Oct 1", "1st October", "10月1日" -> use 2025 as year, determine historical/forecast based on current date
   - If no date mentioned and Last Date exists, use Last Date and Last Date Type from LAST WEATHER CONTEXT
   - If no date mentioned and no Last Date, default to "current"

4. **Major City Coordinates** (use these exact values):
   - Tokyo: {"latitude": 35.6762, "longitude": 139.6503, "timezone": "Asia/Tokyo"}
   - Delhi: {"latitude": 28.6139, "longitude": 77.2090, "timezone": "Asia/Kolkata"}
   - London: {"latitude": 51.5074, "longitude": -0.1278, "timezone": "Europe/London"}
   - New York: {"latitude": 40.7128, "longitude": -74.0060, "timezone": "America/New_York"}
   - Paris: {"latitude": 48.8566, "longitude": 2.3522, "timezone": "Europe/Paris"}

5. **Error Handling**:
   - Missing location: provide helpful message asking for location
   - Date too far in future (>16 days): provide forecast limit message
   - Invalid queries: provide appropriate guidance

EXAMPLES:
- "weather in Tokyo today" -> {"isWeatherQuery": true, "city": "Tokyo", "country": "Japan", "latitude": 35.6762, "longitude": 139.6503, "timezone": "Asia/Tokyo", "dateType": "current"}
- "how about tomorrow" (with Last City: "Delhi") -> {"isWeatherQuery": true, "city": "Delhi", "country": "India", "latitude": 28.6139, "longitude": 77.2090, "timezone": "Asia/Kolkata", "dateType": "forecast", "targetDate": "2025-09-26"}
- "How about October 1st?" (with Last City: "Delhi") -> {"isWeatherQuery": true, "city": "Delhi", "country": "India", "latitude": 28.6139, "longitude": 77.2090, "timezone": "Asia/Kolkata", "dateType": "forecast", "targetDate": "2025-10-01"}
- "hello how are you" -> {"isWeatherQuery": false, "nonWeatherResponse": "Hello! I'm a weather assistant. Ask me about weather, climate, or travel advice."}`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    console.log('🤖 OpenAI response:', aiResponse);

    let locationData;
    try {
      locationData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', aiResponse);
      throw new Error('Could not parse location data from AI response');
    }

    // Check if AI couldn't identify a location and handle missing info
    if (locationData.missingInfo === 'location' || !locationData.city || locationData.city === null) {
      console.log('⚠️ No location identified in query');
      const error = new Error(locationData.errorMessage || 'No location identified in query');
      (error as any).missingInfo = true;
      throw error;
    }

    console.log('✅ Location identified:', {
      city: locationData.city,
      country: locationData.country,
      lat: locationData.latitude,
      lng: locationData.longitude,
      timezone: locationData.timezone
    });

    // Validate that we have numeric coordinates
    if (typeof locationData.latitude !== 'number' || typeof locationData.longitude !== 'number') {
      console.error('❌ Invalid coordinate types:', typeof locationData.latitude, typeof locationData.longitude);
      throw new Error('Invalid coordinate types received from AI');
    }

    return {
      city: locationData.city,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timezone: locationData.timezone,
      requestTime: locationData.requestTime,
      targetDate: locationData.targetDate || null,
      dateType: locationData.dateType || 'current'
    };
  } catch (error) {
    console.error('❌ Error in analyzeUserQuery:', error);
    throw error;
  }
}

export async function getWeatherFromOpenMeteo(locationRequest: LocationRequest): Promise<any> {
  console.log('🌤️ Fetching weather data from Open-Meteo for:', locationRequest.city);
  console.log('📍 Coordinates:', locationRequest.latitude, locationRequest.longitude);
  console.log('📅 Date type:', locationRequest.dateType, 'Target date:', locationRequest.targetDate);

  // Validate coordinates
  if (!locationRequest.latitude || !locationRequest.longitude) {
    throw new Error('Invalid coordinates provided');
  }

  if (Math.abs(locationRequest.latitude) > 90 || Math.abs(locationRequest.longitude) > 180) {
    throw new Error('Coordinates out of valid range');
  }

  // Validate forecast date limits
  if (locationRequest.dateType === 'forecast' && locationRequest.targetDate) {
    const today = new Date();
    const targetDate = new Date(locationRequest.targetDate);
    const daysDifference = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('📊 Days difference for forecast:', daysDifference);
    
    if (daysDifference > 16) {
      const error = new Error('Weather forecasts are only available up to 16 days in the future. Please choose a date within the next 16 days.');
      (error as any).forecastLimitExceeded = true;
      throw error;
    }
    
    if (daysDifference < 0) {
      console.log('⚠️ Target date is in the past, switching to historical data');
      locationRequest.dateType = 'historical';
    }
  }

  let url: string;
  let params: URLSearchParams;

  if (locationRequest.dateType === 'historical' && locationRequest.targetDate) {
    // For recent dates (within last 7 days), try forecast API first as it has more reliable data
    const targetDate = new Date(locationRequest.targetDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 7) {
      // Use forecast API for recent historical data (more reliable)
      console.log('📜 Fetching recent historical data via forecast API');
      params = new URLSearchParams({
        latitude: locationRequest.latitude.toString(),
        longitude: locationRequest.longitude.toString(),
        start_date: locationRequest.targetDate,
        end_date: locationRequest.targetDate,
        daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code',
        timezone: 'auto'
      });
      url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    } else {
      // Use archive API for older historical data
      console.log('📜 Fetching historical weather data from archive');
      params = new URLSearchParams({
        latitude: locationRequest.latitude.toString(),
        longitude: locationRequest.longitude.toString(),
        start_date: locationRequest.targetDate,
        end_date: locationRequest.targetDate,
        daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code',
        timezone: 'auto'
      });
      url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
    }

  } else if (locationRequest.dateType === 'forecast' && locationRequest.targetDate) {
    // Future forecast data
    console.log('🔮 Fetching forecast weather data');
    params = new URLSearchParams({
      latitude: locationRequest.latitude.toString(),
      longitude: locationRequest.longitude.toString(),
      start_date: locationRequest.targetDate,
      end_date: locationRequest.targetDate,
      daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code',
      timezone: 'auto'
    });
    url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  } else {
    // Current weather data
    console.log('⏰ Fetching current weather data');
    params = new URLSearchParams({
      latitude: locationRequest.latitude.toString(),
      longitude: locationRequest.longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,uv_index,weather_code',
      timezone: 'auto'
    });
    url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }

  console.log('🔗 Open-Meteo API URL:', url);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Open-Meteo API error:', response.status);
    console.error('❌ Error response:', errorText);
    throw new Error(`Open-Meteo API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('📊 Raw weather data from Open-Meteo:', JSON.stringify(data, null, 2));

  let weatherData: any;

  if (locationRequest.dateType === 'historical' || locationRequest.dateType === 'forecast') {
    // Handle daily data for historical/forecast
    const daily = data.daily;
    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('No weather data available for the requested date');
    }

    const dayIndex = 0; // First (and only) day since we query single date
    
    // Handle null values properly
    const tempMax = daily.temperature_2m_max[dayIndex];
    const tempMin = daily.temperature_2m_min[dayIndex];
    const avgTemp = (tempMax !== null && tempMin !== null) ? Math.round((tempMax + tempMin) / 2) : null;
    
    // Check if we got null data and it's a recent date - try current weather as fallback
    if (avgTemp === null && locationRequest.dateType === 'historical') {
      const targetDate = new Date(locationRequest.targetDate!);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) { // If it's yesterday or today, try current weather
        console.log('⚠️ No historical data available, trying current weather as fallback');
        
        const currentParams = new URLSearchParams({
          latitude: locationRequest.latitude.toString(),
          longitude: locationRequest.longitude.toString(),
          current: 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,uv_index,weather_code',
          timezone: 'auto'
        });
        
        const currentResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${currentParams.toString()}`);
        if (currentResponse.ok) {
          const currentData = await currentResponse.json();
          const current = currentData.current;
          
          weatherData = {
            city: locationRequest.city,
            latitude: locationRequest.latitude,
            longitude: locationRequest.longitude,
            timezone: currentData.timezone,
            dateType: 'current', // Change to current since we're using current data
            targetDate: null,
            temperature: Math.round(current.temperature_2m),
            temperatureMax: null,
            temperatureMin: null,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            precipitation: current.precipitation,
            cloudCover: current.cloud_cover,
            uvIndex: current.uv_index,
            weatherCode: current.weather_code,
            description: weatherCodeDescriptions[current.weather_code] || 'Unknown',
            timestamp: current.time
          };
        } else {
          // If even current weather fails, return the null data with a note
          weatherData = {
            city: locationRequest.city,
            latitude: locationRequest.latitude,
            longitude: locationRequest.longitude,
            timezone: data.timezone,
            dateType: locationRequest.dateType,
            targetDate: locationRequest.targetDate,
            temperature: avgTemp,
            temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
            temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
            humidity: daily.relative_humidity_2m_max[dayIndex],
            windSpeed: daily.wind_speed_10m_max[dayIndex],
            precipitation: daily.precipitation_sum[dayIndex],
            uvIndex: daily.uv_index_max[dayIndex],
            weatherCode: daily.weather_code[dayIndex],
            description: 'Historical data not available for this date',
            timestamp: daily.time[dayIndex]
          };
        }
      } else {
        // For older dates, just return the null data with explanation
        weatherData = {
          city: locationRequest.city,
          latitude: locationRequest.latitude,
          longitude: locationRequest.longitude,
          timezone: data.timezone,
          dateType: locationRequest.dateType,
          targetDate: locationRequest.targetDate,
          temperature: avgTemp,
          temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
          temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
          humidity: daily.relative_humidity_2m_max[dayIndex],
          windSpeed: daily.wind_speed_10m_max[dayIndex],
          precipitation: daily.precipitation_sum[dayIndex],
          uvIndex: daily.uv_index_max[dayIndex],
          weatherCode: daily.weather_code[dayIndex],
          description: 'Historical data not available for this date',
          timestamp: daily.time[dayIndex]
        };
      }
    } else {
      // Normal case with valid data
      weatherData = {
        city: locationRequest.city,
        latitude: locationRequest.latitude,
        longitude: locationRequest.longitude,
        timezone: data.timezone,
        dateType: locationRequest.dateType,
        targetDate: locationRequest.targetDate,
        temperature: avgTemp,
        temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
        temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
        humidity: daily.relative_humidity_2m_max[dayIndex],
        windSpeed: daily.wind_speed_10m_max[dayIndex],
        precipitation: daily.precipitation_sum[dayIndex],
        uvIndex: daily.uv_index_max[dayIndex],
        weatherCode: daily.weather_code[dayIndex],
        description: daily.weather_code[dayIndex] !== null ? (weatherCodeDescriptions[daily.weather_code[dayIndex]] || 'Unknown') : 'No data available',
        timestamp: daily.time[dayIndex]
      };
    }
  } else {
    // Handle current weather data
    const current = data.current;
    weatherData = {
      city: locationRequest.city,
      latitude: locationRequest.latitude,
      longitude: locationRequest.longitude,
      timezone: data.timezone,
      dateType: locationRequest.dateType,
      targetDate: null,
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover,
      uvIndex: current.uv_index,
      weatherCode: current.weather_code,
      description: weatherCodeDescriptions[current.weather_code] || 'Unknown',
      timestamp: current.time
    };
  }

  console.log('✅ Processed weather data:', weatherData);
  return weatherData;
}

export async function formatWeatherResponse(weatherData: any, originalQuery: string, language: string = 'en'): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🎨 Formatting weather response with OpenAI...');
  console.log('📝 Original query:', originalQuery);
  console.log('🌍 Language:', language);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a weather and lifestyle assistant. Format the weather data into a comprehensive response with fashion and travel recommendations.

WEATHER DATA PROVIDED:
${JSON.stringify(weatherData, null, 2)}

Context:
- Date Type: ${weatherData.dateType}
- Location: ${weatherData.city}
- Target Date: ${weatherData.targetDate || 'Current'}

FORMATTING RULES:
1. Start with "Weather Summary" (NO stars or special characters in heading)
2. Use clear, conversational language
3. Include specific temperature, humidity, wind, and precipitation details
4. Provide fashion recommendations (clothing, materials, accessories)
5. Suggest activities and travel advice
6. Give practical tips based on UV index, weather conditions
7. If historical: use past tense ("was", "had")
8. If forecast: mention it's a prediction ("expected", "likely")
9. Keep the response focused and actionable

Language: Respond in ${language === 'ja' ? 'Japanese' : 'English'}

IMPORTANT: Do NOT use stars (**) or special formatting characters in headings. Use plain text only.

Make it conversational, helpful, and specific to the weather conditions and time context.`
          },
          {
            role: 'user',
            content: originalQuery
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI formatting error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const formattedResponse = data.choices[0].message.content.trim();

    console.log('✅ Formatted response from OpenAI:', formattedResponse);
    return formattedResponse;
  } catch (error) {
    console.error('❌ Error in formatWeatherResponse:', error);
    throw error;
  }
}