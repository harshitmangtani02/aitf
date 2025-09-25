import { NextRequest, NextResponse } from 'next/server';

// Session storage - keeps track of last city/date per session (in memory)
const sessionStorage = new Map<string, {
  lastCity: string | null;
  lastCountry: string | null;
  lastDate: string | null;
  lastDateType: string | null;
}>();

// Generate session ID from request headers
function getSessionId(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `${ip}-${userAgent}`.slice(0, 50);
}

// Get or create session state
function getSessionState(sessionId: string) {
  if (!sessionStorage.has(sessionId)) {
    sessionStorage.set(sessionId, {
      lastCity: null,
      lastCountry: null,
      lastDate: new Date().toISOString().split('T')[0],
      lastDateType: 'current'
    });
  }
  return sessionStorage.get(sessionId)!;
}

// Update session state
function updateSessionState(sessionId: string, updates: Partial<{
  lastCity: string | null;
  lastCountry: string | null;
  lastDate: string | null;
  lastDateType: string | null;
}>) {
  const currentState = getSessionState(sessionId);
  sessionStorage.set(sessionId, { ...currentState, ...updates });
}

// First AI query: Extract city name and date from user query (conversational chatbot)
async function analyzeQuery(query: string, language: string, sessionState: Record<string, any>): Promise<{
  needsWeatherData: boolean;
  city?: string | null;
  targetDate?: string | null;
  dateType?: string | null;
  chatResponse?: string | null;
}> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🤖 Analyzing query with chatbot AI:', query);
  console.log('📍 Session state:', sessionState);

  // Calculate dates for context
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

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
          content: `You are a friendly weather chatbot that supports both English and Japanese. Extract city name and date from user queries.

LANGUAGE: User is asking in ${language === 'ja' ? 'Japanese' : 'English'}. Respond in chatResponse using the same language.

CONVERSATION CONTEXT:
- Last City Asked: ${sessionState.lastCity || 'None'}
- Last Date: ${sessionState.lastDate || 'Today'}
- Today: ${today.toISOString().split('T')[0]}
- Tomorrow: ${tomorrowStr}
- Yesterday: ${yesterdayStr}

RULES:
1. For weather queries: return needsWeatherData: true with city name and date
2. For chat/greetings/off-topic: return needsWeatherData: false with friendly chatResponse
3. Extract city names (don't worry about coordinates): Tokyo, Delhi, Kyoto, London, Paris, etc.
4. Handle Japanese: 東京=Tokyo, 京都=Kyoto, 大阪=Osaka, 天気=weather, 明日=tomorrow, 昨日=yesterday
5. If no city mentioned but Last City exists: use Last City
6. If user says "tomorrow"/"明日": use tomorrow's date
7. If user says "yesterday"/"昨日": use yesterday's date

RESPOND WITH ONLY THIS JSON:
{
  "needsWeatherData": boolean,
  "city": "city name or null",
  "targetDate": "YYYY-MM-DD or null", 
  "dateType": "current or forecast or historical",
  "chatResponse": "friendly response or null"
}

EXAMPLES:
Query: "hello"
Response: {"needsWeatherData": false, "city": null, "targetDate": null, "dateType": null, "chatResponse": "Hi! I'm your weather assistant. I can check weather forecasts, suggest what to wear, and give travel advice. Which city would you like to know about?"}

Query: "weather in Tokyo" 
Response: {"needsWeatherData": true, "city": "Tokyo", "targetDate": null, "dateType": "current", "chatResponse": null}

Query: "京都の天気" (Kyoto weather)
Response: {"needsWeatherData": true, "city": "Kyoto", "targetDate": null, "dateType": "current", "chatResponse": null}

Query: "tomorrow" (with Last City: Delhi)
Response: {"needsWeatherData": true, "city": "Delhi", "targetDate": "${tomorrowStr}", "dateType": "forecast", "chatResponse": null}

Query: "明日" (tomorrow, with Last City: Tokyo)  
Response: {"needsWeatherData": true, "city": "Tokyo", "targetDate": "${tomorrowStr}", "dateType": "forecast", "chatResponse": null}

Query: "bharatnatyam"
Response: {"needsWeatherData": false, "city": null, "targetDate": null, "dateType": null, "chatResponse": "That's a beautiful dance form! I specialize in weather though. How can I help you with weather forecasts or travel advice?"}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.4,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content.trim();

  console.log('🤖 Raw AI response:', aiResponse);

  // Try to extract JSON from the response
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;

  console.log('🔍 Extracted JSON string:', jsonStr);

  try {
    const parsed = JSON.parse(jsonStr);
    console.log('✅ Successfully parsed JSON:', parsed);
    return parsed;
  } catch (parseError) {
    console.error('❌ Failed to parse AI response as JSON');
    console.error('❌ Original response:', aiResponse);
    console.error('❌ Parse error:', parseError);

    // Fallback response
    return {
      needsWeatherData: false,
      city: undefined,
      targetDate: undefined,
      dateType: undefined,
      chatResponse: language === 'ja'
        ? 'すみません、よく理解できませんでした。😅 どちらの都市の天気をお知りになりたいですか？'
        : 'I\'m not quite sure what you\'re looking for! 😅 Which city\'s weather would you like to know about?'
    };
  }
}

// Get coordinates from city name using geocoding API
async function getCoordinates(cityName: string): Promise<{
  latitude: number;
  longitude: number;
  country: string;
  fullName: string;
}> {
  console.log('🌍 Getting coordinates for city:', cityName);

  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
  );

  if (!geoResponse.ok) {
    throw new Error(`Geocoding API error: ${geoResponse.status}`);
  }

  const geoData = await geoResponse.json();

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`City not found: ${cityName}`);
  }

  const location = geoData.results[0];

  console.log('📍 Found coordinates:', {
    city: location.name,
    country: location.country,
    lat: location.latitude,
    lng: location.longitude
  });

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    country: location.country,
    fullName: location.name
  };
}

// Get weather data from Open-Meteo API
async function getWeatherData(city: string, latitude: number, longitude: number, targetDate?: string, dateType?: string): Promise<Record<string, any>> {
  console.log('🌤️ Fetching weather data for:', city, 'at', latitude, longitude);

  let url: string;
  let params: URLSearchParams;

  if (dateType === 'historical' && targetDate) {
    params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: targetDate,
      end_date: targetDate,
      daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code',
      timezone: 'auto'
    });
    url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
  } else if (dateType === 'forecast' && targetDate) {
    params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: targetDate,
      end_date: targetDate,
      daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code',
      timezone: 'auto'
    });
    url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  } else {
    // Current weather
    params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,uv_index,weather_code',
      timezone: 'auto'
    });
    url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  // Process the weather data
  if (dateType === 'historical' || dateType === 'forecast') {
    const daily = data.daily;
    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('No weather data available for the requested date');
    }

    const dayIndex = 0;
    const tempMax = daily.temperature_2m_max[dayIndex];
    const tempMin = daily.temperature_2m_min[dayIndex];
    const avgTemp = (tempMax !== null && tempMin !== null) ? Math.round((tempMax + tempMin) / 2) : null;

    return {
      city,
      latitude,
      longitude,
      dateType,
      targetDate,
      temperature: avgTemp,
      temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
      temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
      humidity: daily.relative_humidity_2m_max[dayIndex],
      windSpeed: daily.wind_speed_10m_max[dayIndex],
      precipitation: daily.precipitation_sum[dayIndex],
      uvIndex: daily.uv_index_max[dayIndex],
      weatherCode: daily.weather_code[dayIndex],
      timestamp: daily.time[dayIndex]
    };
  } else {
    // Current weather
    const current = data.current;
    return {
      city,
      latitude,
      longitude,
      dateType: 'current',
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover,
      uvIndex: current.uv_index,
      weatherCode: current.weather_code,
      timestamp: current.time
    };
  }
}

// Second AI query: Format weather response with fashion and travel advice (conversational)
async function formatWeatherResponse(weatherData: Record<string, any>, originalQuery: string, language: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🎨 Formatting weather response with conversational AI...');

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
          content: `You are a friendly, conversational weather assistant. Format the weather data into an engaging response with fashion and travel recommendations.

WEATHER DATA:
${JSON.stringify(weatherData, null, 2)}

PERSONALITY:
- Be warm, friendly, and conversational like talking to a friend
- Show enthusiasm about helping with weather, fashion, and travel
- Use natural, flowing language (not robotic)
- Include practical tips and suggestions
- Be encouraging and positive

FORMATTING RULES:
1. Start with "Weather Summary" (no special formatting)
2. Be conversational and engaging
3. Include specific weather details naturally in conversation
4. Provide fashion recommendations (clothing, materials, accessories)
5. Suggest activities and travel advice based on weather
6. Give practical tips (UV protection, hydration, etc.)
7. Use appropriate tense based on date type (was/is/will be)
8. Keep it helpful and actionable

Language: Respond in ${language === 'ja' ? 'Japanese' : 'English'}

Make it sound like a knowledgeable friend giving helpful advice about the weather!`
        },
        {
          role: 'user',
          content: `The user asked: "${originalQuery}". Please provide a comprehensive weather response with fashion and travel advice.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI formatting error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export async function POST(req: NextRequest) {
  let language = 'en'; // Default language

  try {
    const requestBody = await req.json();
    const { messages } = requestBody;
    language = requestBody.language || 'en';
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== 'user') {
      const welcomeMessage = language === 'ja'
        ? 'こんにちは！😊 天気アシスタントです。天気予報を確認したり、その日の服装を提案したり、旅行のアドバイスをしたりできます。どちらの都市の天気をお知りになりたいですか？'
        : 'Hello! 😊 I\'m your friendly weather assistant. I can check weather forecasts, suggest what to wear, and give travel advice. Which city\'s weather would you like to know about?';

      return new NextResponse(welcomeMessage, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Get session state
    const sessionId = getSessionId(req);
    const sessionState = getSessionState(sessionId);

    console.log('💬 Processing query:', lastMessage.content);
    console.log('🔑 Session ID:', sessionId);
    console.log('📊 Session state:', sessionState);

    // Step 1: Analyze the query with chatbot AI (extract city and date)
    const analysis = await analyzeQuery(lastMessage.content, language, sessionState);

    // Step 2: If it's just chat, return the chat response
    if (!analysis.needsWeatherData) {
      return new NextResponse(analysis.chatResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Step 3: If we need weather data but no city, ask for it
    if (!analysis.city) {
      const errorMessage = language === 'ja'
        ? 'どちらの都市の天気をお知りになりたいですか？🌍 例えば「東京の天気」や「デリーの天気」のように教えてください！'
        : 'Which city would you like to know the weather for? 🌍 You can say something like "weather in Tokyo" or "Delhi weather"!';

      return new NextResponse(errorMessage, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Step 4: Get coordinates from geocoding API (no hardcoded coordinates!)
    const coordinates = await getCoordinates(analysis.city);

    // Step 5: Update session state with new city/date info
    updateSessionState(sessionId, {
      lastCity: analysis.city,
      lastCountry: coordinates.country,
      lastDate: analysis.targetDate || sessionState.lastDate,
      lastDateType: analysis.dateType || sessionState.lastDateType
    });

    console.log('💾 Updated session state with:', {
      city: analysis.city,
      country: coordinates.country,
      date: analysis.targetDate,
      dateType: analysis.dateType
    });

    // Step 6: Get weather data
    const weatherData = await getWeatherData(
      coordinates.fullName,
      coordinates.latitude,
      coordinates.longitude,
      analysis.targetDate || undefined,
      analysis.dateType || undefined
    );

    // Step 7: Format the response with conversational AI
    const formattedResponse = await formatWeatherResponse(
      weatherData,
      lastMessage.content,
      language
    );

    console.log('✅ Weather response completed successfully');

    return new NextResponse(formattedResponse, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);

    const errorMessage = language === 'ja'
      ? 'すみません、エラーが発生しました。もう一度お試しください。'
      : 'Sorry, something went wrong. Please try again.';

    return new NextResponse(errorMessage, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}