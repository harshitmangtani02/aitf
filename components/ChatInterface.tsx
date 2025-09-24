'use client';

import { useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeatherData } from '@/lib/weather';
import { Mic, MicOff, Send, MapPin } from 'lucide-react';

interface ChatInterfaceProps {
  weatherData?: WeatherData;
}

export function ChatInterface({ weatherData }: ChatInterfaceProps) {
  const { language, t } = useLanguage();
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [currentWeatherData, setCurrentWeatherData] = useState<WeatherData | undefined>(weatherData);

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: inputValue.trim()
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            weatherData: currentWeatherData,
            language: language,
            systemPrompt: t('systemPrompt')
          }),
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';

          const assistantMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: ''
          };

          setMessages(prev => [...prev, assistantMessage]);

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              assistantContent += chunk;

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
      } finally {
        setIsLoading(false);
        setInputValue('');
      }
    }
  }, [inputValue, messages, currentWeatherData, language, t]);
  const fetchWeatherForLocation = useCallback(async (location: string) => {
    setIsLoadingWeather(true);
    try {
      const response = await fetch(`/api/weather?query=${encodeURIComponent(location)}`);
      if (response.ok) {
        const weather = await response.json();
        setCurrentWeatherData(weather);
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  const onVoiceResult = useCallback(async (transcript: string) => {
    console.log('Voice result received:', transcript);
    console.log('Current language:', language);

    // Check if the transcript contains a location request (both Japanese and English)
    const locationMatch = language === 'ja'
      ? transcript.match(/(.+?)(?:の天気|の気候|天気|の天候)/i)
      : transcript.match(/(?:weather (?:in|for)|what.?s the weather (?:in|like in|for)|tell me the weather (?:in|for)) (.+?)(?:\?|$|please|today)?/i);

    console.log('Location match:', locationMatch);

    if (locationMatch && locationMatch[1]) {
      const location = locationMatch[1].trim();
      console.log('Fetching weather for:', location);
      await fetchWeatherForLocation(location);
    }

    // Set the transcript as input
    console.log('Setting transcript as input:', transcript);
    setInputValue(transcript);
  }, [setInputValue, language, fetchWeatherForLocation]);

  const {
    isListening,
    isSupported,
    error: voiceError,
    startListening,
    stopListening
  } = useVoiceInput({
    onResult: onVoiceResult,
    language: language
  });


  const handleVoiceToggle = () => {
    console.log('Voice toggle clicked, isListening:', isListening);
    console.log('isSupported:', isSupported);
    console.log('voiceError:', voiceError);

    if (isListening) {
      console.log('Stopping voice recognition...');
      stopListening();
    } else {
      console.log('Starting voice recognition...');
      startListening();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Weather Card */}
      {currentWeatherData && (
        <Card className="glass animate-float shadow-xl border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="relative">
                <MapPin className="w-6 h-6 text-primary" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping"></div>
              </div>
              {currentWeatherData.city}, {currentWeatherData.country}
            </CardTitle>
            <CardDescription className="text-base">
              {t('currentWeather')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-3xl font-bold text-primary mb-1">{currentWeatherData.temperature}°C</div>
                <div className="text-sm text-muted-foreground capitalize">{currentWeatherData.description}</div>
              </div>
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-xl font-semibold text-blue-500 mb-1">{currentWeatherData.humidity}%</div>
                <div className="text-sm text-muted-foreground">{t('humidity')}</div>
              </div>
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-xl font-semibold text-green-500 mb-1">{currentWeatherData.windSpeed} m/s</div>
                <div className="text-sm text-muted-foreground">{t('windSpeed')}</div>
              </div>
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-xl font-semibold text-purple-500 mb-1">{currentWeatherData.precipitation}mm</div>
                <div className="text-sm text-muted-foreground">Precipitation</div>
              </div>
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-xl font-semibold text-orange-500 mb-1">{currentWeatherData.cloudCover}%</div>
                <div className="text-sm text-muted-foreground">Cloud Cover</div>
              </div>
              <div className="text-center group hover:scale-105 transition-transform">
                <div className="text-xl font-semibold text-red-500 mb-1">{currentWeatherData.uvIndex}</div>
                <div className="text-sm text-muted-foreground">UV Index</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <Card className="glass shadow-xl border-secondary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-full bg-primary/20">
              <span className="text-2xl">🤖</span>
            </div>
            {t('assistantTitle')}
          </CardTitle>
          <CardDescription className="text-base">
            {t('assistantDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <div className="animate-bounce mb-4">
                  <span className="text-6xl">👋</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">{t('welcomeTitle')}</h3>
                <p className="text-lg mb-6">{t('welcomeMessage')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-primary/10 rounded-full text-sm">{t('exampleQueries.weather')}</span>
                  <span className="px-3 py-1 bg-secondary/10 rounded-full text-sm">{t('exampleQueries.fashion')}</span>
                  <span className="px-3 py-1 bg-accent/10 rounded-full text-sm">{t('exampleQueries.travel')}</span>
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`transform transition-all duration-300 ease-out ${message.role === 'user'
                  ? 'translate-x-0 opacity-100'
                  : 'translate-x-0 opacity-100'
                  }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`p-4 rounded-xl shadow-sm ${message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-12 rounded-br-sm'
                    : 'bg-card border mr-12 rounded-bl-sm'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {message.role === 'user' ? (
                        <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                          <span className="text-xs">👤</span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-xs">🤖</span>
                        </div>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap flex-1">{message.content}</div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="bg-card border p-4 rounded-xl mr-12 rounded-bl-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-xs">🤖</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-muted-foreground">{t('thinking')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card className="glass shadow-xl border-accent/20 sticky bottom-4">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={handleInputChange}
                placeholder={t('inputPlaceholder')}
                disabled={isLoading || isLoadingWeather}
                className="pr-12 h-12 text-base border-primary/20 focus:border-primary/50 focus:ring-primary/20"
              />
              {isListening && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="flex space-x-1">
                    <div className="w-1 h-4 bg-primary rounded animate-pulse"></div>
                    <div className="w-1 h-6 bg-primary rounded animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-5 bg-primary rounded animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
            </div>

            {isSupported && (
              <Button
                type="button"
                onClick={handleVoiceToggle}
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                disabled={isLoading || isLoadingWeather}
                className={`h-12 w-12 relative ${isListening ? 'animate-glow' : 'hover:scale-105'} transition-all duration-200`}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
                {isListening && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </Button>
            )}

            <Button
              type="submit"
              disabled={isLoading || isLoadingWeather || !inputValue?.trim()}
              size="icon"
              className="h-12 w-12 hover:scale-105 transition-all duration-200"
              onClick={() => {
                console.log('Send button clicked');
                console.log('Input value:', inputValue);
                console.log('Input trimmed:', inputValue?.trim());
                console.log('Button disabled:', isLoading || isLoadingWeather || !inputValue?.trim());
              }}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>

          {voiceError && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive flex items-center gap-2">
                <span>{t('voiceError')}</span>
                {voiceError}
              </p>
            </div>
          )}

          {!isSupported && (
            <div className="mt-3 p-3 bg-muted/50 border border-muted rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{t('voiceNotSupported')}</span>
              </p>
            </div>
          )}

          {isListening && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg animate-pulse">
              <p className="text-sm text-primary flex items-center gap-2">
                <span>{t('listening')}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}