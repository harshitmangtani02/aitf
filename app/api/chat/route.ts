import { NextRequest, NextResponse } from 'next/server';
import { analyzeUserQuery, getWeatherFromOpenMeteo, formatWeatherResponse } from '@/lib/weather';

function checkIfWeatherQuery(query: string, language: string): boolean {
  const content = query.toLowerCase();
  
  const weatherKeywords = language === 'ja' 
    ? ['天気', '気温', '湿度', '雨', '雪', '風', '晴れ', '曇り', '気候', '服装', '着る', '旅行', '外出', '今日', '明日', '昨日', '月', '日', 'はどう', 'について']
    : ['weather', 'temperature', 'rain', 'snow', 'wind', 'sunny', 'cloudy', 'climate', 'wear', 'clothing', 'travel', 'outside', 'today', 'tomorrow', 'yesterday', 'october', 'november', 'december', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'how about', 'what about'];
  
  // Also check for date patterns
  const datePatterns = [
    /\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /\d{1,2}月\d{1,2}日/,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
    /\d{1,2}\/\d{1,2}/,
    /\d{4}-\d{1,2}-\d{1,2}/
  ];
  
  const hasWeatherKeyword = weatherKeywords.some(keyword => content.includes(keyword));
  const hasDatePattern = datePatterns.some(pattern => pattern.test(content));
  
  return hasWeatherKeyword || hasDatePattern;
}

function extractPreviousLocationFromMessages(messages: any[]): string | null {
  // Look through ALL previous messages to find the most recent location
  for (let i = messages.length - 2; i >= 0; i--) { // Start from second-to-last message
    const message = messages[i];
    if (message.role === 'assistant') {
      // Check assistant responses for location mentions
      const content = message.content.toLowerCase();
      
      // Look for patterns like "in Tokyo", "for Paris", etc.
      const locationPatterns = [
        /(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s|,|\.|\n|$|'s|の)/g,
        /([a-zA-Z\s]+?)(?:の天気|の気温|の気候)/g, // Japanese patterns
        /weather.*?(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s|,|\.|\n|$)/g,
        /weather\s+summary[^a-zA-Z]*([a-zA-Z\s]+?)(?:\s|,|\.|\n|$)/gi, // Extract from "Weather Summary for Tokyo"
        /([a-zA-Z\s]{3,30})(?:\s+weather|\s+climate|\s+conditions)/gi // "Tokyo weather", "Paris climate"
      ];
      
      for (const pattern of locationPatterns) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          const location = matches[0][1].trim();
          if (location.length > 1 && location.length < 50) { // Reasonable location name length
            console.log('🔍 Found previous location in assistant response:', location);
            return location;
          }
        }
      }
    } else if (message.role === 'user') {
      // Check user messages for location keywords
      const content = message.content.toLowerCase();
      const locationKeywords = ['weather', 'in', 'at', 'for', '天気', 'の', 'で'];
      const hasLocationKeyword = locationKeywords.some(keyword => content.includes(keyword));
      
      if (hasLocationKeyword) {
        // Try to extract location from this message
        const locationMatch = content.match(/(?:weather|天気).*?(?:in|at|for|の|で)\s*([^,.\n?!]+)/i);
        if (locationMatch && locationMatch[1]) {
          const location = locationMatch[1].trim();
          console.log('🔍 Found previous location in user message:', location);
          return location;
        }
      }
    }
  }
  return null;
}

function extractPreviousDateFromMessages(messages: any[]): { targetDate: string; dateType: 'historical' | 'forecast' } | null {
  // Look through previous messages to find the most recent date context
  for (let i = messages.length - 2; i >= 0; i--) { // Start from second-to-last message
    const message = messages[i];
    if (message.role === 'assistant') {
      // Check assistant responses for date mentions
      const content = message.content.toLowerCase();
      
      // Look for date patterns in assistant responses
      const datePatterns = [
        /(?:for|on)\s+(\d{4}-\d{1,2}-\d{1,2})/g, // "for 2025-10-10"
        /(\d{4}-\d{1,2}-\d{1,2})/g, // Direct date format
        /(tomorrow|yesterday|today)/g, // Relative dates
        /(october|november|december|january|february|march|april|may|june|july|august|september)\s+\d{1,2}/gi
      ];
      
      for (const pattern of datePatterns) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          const dateStr = matches[0][1].trim();
          
          // Convert relative dates to actual dates
          if (dateStr === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const targetDate = tomorrow.toISOString().split('T')[0];
            console.log('🔍 Found previous date (tomorrow):', targetDate);
            return { targetDate, dateType: 'forecast' };
          } else if (dateStr === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const targetDate = yesterday.toISOString().split('T')[0];
            console.log('🔍 Found previous date (yesterday):', targetDate);
            return { targetDate, dateType: 'historical' };
          } else if (dateStr === 'today') {
            console.log('🔍 Found previous date (today): current');
            return null; // Current weather, no specific date
          } else if (dateStr.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
            // Direct date format
            const today = new Date();
            const targetDateObj = new Date(dateStr);
            const dateType = targetDateObj > today ? 'forecast' : 'historical';
            console.log('🔍 Found previous date:', dateStr, 'Type:', dateType);
            return { targetDate: dateStr, dateType };
          }
        }
      }
    } else if (message.role === 'user') {
      // Check user messages for date patterns
      const content = message.content.toLowerCase();
      
      // Look for specific date mentions in user messages
      const userDatePatterns = [
        /tomorrow|明日/g,
        /yesterday|昨日/g,
        /(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))/gi,
        /(\d{1,2}月\d{1,2}日)/g
      ];
      
      for (const pattern of userDatePatterns) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          const dateStr = matches[0][0].trim();
          
          if (dateStr.includes('tomorrow') || dateStr.includes('明日')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const targetDate = tomorrow.toISOString().split('T')[0];
            console.log('🔍 Found previous date in user message (tomorrow):', targetDate);
            return { targetDate, dateType: 'forecast' };
          } else if (dateStr.includes('yesterday') || dateStr.includes('昨日')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const targetDate = yesterday.toISOString().split('T')[0];
            console.log('🔍 Found previous date in user message (yesterday):', targetDate);
            return { targetDate, dateType: 'historical' };
          }
          // Could add more specific date parsing here
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { messages, language } = await req.json();
  
  const lastMessage = messages[messages.length - 1];
  
  console.log('💬 Chat API called with message:', lastMessage?.content);
  console.log('🌐 Language:', language);
  console.log('📚 Total messages in conversation:', messages.length);
  
  if (lastMessage && lastMessage.role === 'user') {
    // Check if the query is weather-related
    const isWeatherQuery = checkIfWeatherQuery(lastMessage.content, language);
    
    if (!isWeatherQuery) {
      const nonWeatherMessage = language === 'ja' 
        ? '申し訳ございませんが、私は天気情報のお手伝いのみ承っております。天気、気候、服装、旅行に関するご質問をお聞かせください。'
        : 'I\'m sorry, but I can only help with weather information. Please ask me about weather, climate, clothing recommendations, or travel advice.';
      
      return new NextResponse(nonWeatherMessage, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }
    
    try {
      console.log('🚀 Starting weather analysis workflow...');
      
      // Extract previous location and date context from conversation
      const previousLocation = extractPreviousLocationFromMessages(messages);
      const previousDate = extractPreviousDateFromMessages(messages);
      
      // Step 1: Send user query to OpenAI to analyze and extract location/time info
      const locationRequest = await analyzeUserQuery(lastMessage.content, language, previousLocation, previousDate);
      
      // Step 2: Use the extracted data to call Open-Meteo
      const weatherData = await getWeatherFromOpenMeteo(locationRequest);
      
      // Step 3: Send weather data back to OpenAI for formatting and suggestions
      const formattedResponse = await formatWeatherResponse(
        weatherData, 
        lastMessage.content, 
        language
      );
      
      console.log('✅ Weather workflow completed successfully');
      
      // Return the formatted response as a simple text response
      return new NextResponse(formattedResponse, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
      
    } catch (error) {
      console.error('❌ Weather workflow failed:', error);
      
      // Check if it's a missing information error
      if ((error as any).missingInfo) {
        return new NextResponse((error as Error).message, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
      
      // Check if it's a forecast limit error
      if ((error as any).forecastLimitExceeded) {
        const forecastLimitMessage = language === 'ja' 
          ? '申し訳ございませんが、天気予報は今日から16日先までしか利用できません。16日以内の日付をお選びください。'
          : 'I\'m sorry, but weather forecasts are only available up to 16 days in the future. Please choose a date within the next 16 days.';
        
        return new NextResponse(forecastLimitMessage, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
      
      // Fallback: Return a simple response without weather data
      const fallbackMessage = language === 'ja' 
        ? 'すみません、天気情報を取得できませんでした。他に何かお手伝いできることはありますか？'
        : 'Sorry, I couldn\'t fetch weather information. Is there anything else I can help you with?';
      
      return new NextResponse(fallbackMessage, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }
  }
  
  // If no valid message, return default response
  const defaultMessage = language === 'ja'
    ? 'こんにちは！天気や旅行、ファッションについて何でもお聞きください。'
    : 'Hello! Ask me anything about weather, travel, or fashion recommendations.';
    
  return new NextResponse(defaultMessage, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}