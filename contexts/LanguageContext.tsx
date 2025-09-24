'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ja';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    // Header
    appTitle: 'Weather Fashion Travel Chatbot',
    appSubtitle: 'Voice-Enabled AI Assistant',
    headerTagline: 'Weather × Fashion × Travel',

    // Hero
    heroTagline: '🎯 AI × Weather × Fashion',
    heroTitle: 'Intelligent Lifestyle Assistant',
    heroSubtitle: 'Get weather updates and AI-powered fashion and travel recommendations through voice or text',
    voiceSupport: 'Voice Input Support',
    realTimeWeather: 'Real-time Weather',
    aiSuggestions: 'AI Recommendation Engine',

    // Weather Card
    currentWeather: '🌡️ Current Weather Information',
    humidity: '💧 Humidity',
    windSpeed: '💨 Wind Speed',

    // Chat
    assistantTitle: 'Fashion & Travel Assistant',
    assistantDescription: '🎯 AI-powered fashion and travel suggestions based on weather',
    welcomeTitle: 'Hello!',
    welcomeMessage: 'I provide fashion and travel suggestions based on weather conditions',
    exampleQueries: {
      weather: '"Tell me the weather in Tokyo"',
      fashion: '"What should I wear today?"',
      travel: '"Rainy day travel plans"'
    },
    thinking: 'AI is thinking...',

    // Input
    inputPlaceholder: 'Type a message or use 🎤 for voice input...',
    listening: '🎤 Listening to your voice...',
    voiceNotSupported: 'ℹ️ Voice input is not supported in this browser',
    voiceError: '⚠️',

    // System
    systemPrompt: 'You are a helpful AI assistant specializing in fashion and travel recommendations based on weather conditions. Please respond in English and provide practical, stylish advice.'
  },
  ja: {
    // Header
    appTitle: '天気ファッション・旅行チャットボット',
    appSubtitle: '音声対応 AI アシスタント',
    headerTagline: '天気 × ファッション × 旅行',

    // Hero
    heroTagline: '🎯 AI × 天気 × ファッション',
    heroTitle: 'インテリジェント ライフスタイル アシスタント',
    heroSubtitle: '音声で簡単に天気を確認し、AIがあなたにぴったりのファッションと旅行を提案します',
    voiceSupport: '日本語音声対応',
    realTimeWeather: 'リアルタイム天気',
    aiSuggestions: 'AI提案エンジン',

    // Weather Card
    currentWeather: '🌡️ 現在の天気情報',
    humidity: '💧 湿度',
    windSpeed: '💨 風速',

    // Chat
    assistantTitle: 'ファッション・旅行アシスタント',
    assistantDescription: '🎯 天気に基づいたファッションと旅行の提案をします',
    welcomeTitle: 'こんにちは！',
    welcomeMessage: '天気に応じたファッションや旅行の提案をします',
    exampleQueries: {
      weather: '「東京の天気を教えて」',
      fashion: '「今日はどんな服を着ればいい？」',
      travel: '「雨の日の旅行プラン」'
    },
    thinking: 'AIが考えています...',

    // Input
    inputPlaceholder: 'メッセージを入力するか、🎤ボタンで音声入力...',
    listening: '🎤 音声を聞き取り中...',
    voiceNotSupported: 'ℹ️ 音声入力はこのブラウザではサポートされていません',
    voiceError: '⚠️',

    // System
    systemPrompt: 'あなたは天気に基づいたファッションと旅行の提案を専門とする親切なAIアシスタントです。日本語で回答し、実用的でスタイリッシュなアドバイスを提供してください。'
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('ja');

  // Load saved language preference
  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as Language;
    if (saved && (saved === 'en' || saved === 'ja')) {
      setLanguage(saved);
    }
  }, []);

  // Save language preference
  useEffect(() => {
    localStorage.setItem('preferred-language', language);
  }, [language]);

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}