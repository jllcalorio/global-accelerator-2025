'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

type Section = 'learning-games' | 'ai-buddy' | 'dialect-translator' | 'progress';
type GameType = 'flashcards' | 'memory-match' | 'multiple-choice';
type Step = 'select-section' | 'select-game' | 'select-category' | 'play-game';

interface Flashcard {
  id: number;
  front: string;
  back: string;
  isFlipped: boolean;
}

export default function Home() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  
  const [currentSection, setCurrentSection] = useState<Section>('learning-games');
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select-section');
  
  // Flashcard game state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // AI Study Buddy state
  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Dialect Translator state
  const [dialectInput, setDialectInput] = useState('');
  const [dialectResults, setDialectResults] = useState<Array<{
    dialect: string;
    translation: string;
    emoji: string;
    pronunciation: string;
  }>>([]);
  const [isDialectTranslating, setIsDialectTranslating] = useState(false);

  // Model selection state
  const [availableModels, setAvailableModels] = useState<Array<{name: string, size: number}>>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Memory Match game state
  const [memoryCards, setMemoryCards] = useState<{ id: number; content: string; isFlipped: boolean; isMatched: boolean; isHighlighted: boolean }[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<{ id: number; content: string; isFlipped: boolean; isMatched: boolean; isHighlighted: boolean }[]>([]);
  const [memoryScore, setMemoryScore] = useState(0);
  const [memoryMoves, setMemoryMoves] = useState(0);
  const [isMemoryGenerating, setIsMemoryGenerating] = useState(false);

  // Multiple Choice game state
  const [quizQuestions, setQuizQuestions] = useState<{ id: number; question: string; options: string[]; correctAnswer: string; isAnswered: boolean }[]>([]);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [isQuizGenerating, setIsQuizGenerating] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [showOptionResult, setShowOptionResult] = useState(false);
  const [quizSessionCorrect, setQuizSessionCorrect] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Progress tracking (stored in localStorage)
  type ProgressStats = {
    totalGamesCompleted: number;
    flashcardsViewed: number;
    memoryMatch: { games: number; bestScore: number; lastScore: number };
    quiz: { games: number; bestScore: number; lastScore: number };
  };
  const defaultProgress: ProgressStats = {
    totalGamesCompleted: 0,
    flashcardsViewed: 0,
    memoryMatch: { games: 0, bestScore: 0, lastScore: 0 },
    quiz: { games: 0, bestScore: 0, lastScore: 0 }
  };
  const [progress, setProgress] = useState<ProgressStats>(defaultProgress);
  const loadProgress = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('kla-progress') : null;
      if (raw) setProgress({ ...defaultProgress, ...JSON.parse(raw) });
    } catch {}
  };
  const saveProgress = (next: ProgressStats) => {
    setProgress(next);
    try { if (typeof window !== 'undefined') localStorage.setItem('kla-progress', JSON.stringify(next)); } catch {}
  };

  // Load available Ollama models
  const loadAvailableModels = async () => {
    try {
      setIsLoadingModels(true);
      const response = await fetch('/api/ollama/models');
      if (response.ok) {
        const data = await response.json();
        const models = data.models.map((model: any) => ({
          name: model.name,
          size: model.size
        }));
        setAvailableModels(models);
        console.log('✅ Available models loaded:', models);
      } else {
        console.error('❌ Failed to load models');
      }
    } catch (error) {
      console.error('❌ Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => { 
    loadProgress(); 
    loadAvailableModels();
  }, []);

  // Initialize MiniKit when app is ready
  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  const generateFlashcards = useCallback(async () => {
    console.log('🚀 generateFlashcards called with category:', selectedCategory);
    if (!selectedCategory) {
      console.log('❌ No category selected, returning');
      return;
    }
    
    try {
      setIsGenerating(true);
      setFlashcards([]); // Clear existing cards
      console.log('🔄 Starting flashcard generation...');
      
      // First, test Ollama connection
      console.log('🔍 Testing Ollama connection...');
      const testResponse = await fetch('/api/ollama', {
        method: 'GET'
      });
      
      if (!testResponse.ok) {
        throw new Error(`Ollama connection failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      const testData = await testResponse.json();
      console.log('✅ Ollama connection test:', testData);
      
      // 🎯 ONE-LINE OLLAMA CONNECTION VERIFICATION
      console.log(`✅ OLLAMA CONNECTION VERIFIED: ${testData.status} | Models: ${testData.models?.length || 0}`);
      
      // If connection test fails, use fallback immediately
      if (!testData.status || testData.status !== 'connected') {
        console.log('⚠️ Ollama not connected, using fallback cards');
        const fallbackCards = getFallbackCards(selectedCategory);
        const shuffledFallbacks = shuffleArray([...fallbackCards]);
        setFlashcards(shuffledFallbacks.slice(0, 5));
        setCurrentCardIndex(0);
        setIsGenerating(false);
        return;
      }
      
      const newCards = [];
      
      // Generate 5 flashcards one by one for better reliability
      for (let i = 0; i < 5; i++) {
        console.log(`🎯 Generating card ${i + 1}/5...`);
        
        const prompt = `Create ONE Bisayan (Cebuano) language flashcard about ${selectedCategory} for 5-year-olds.
        
        Respond ONLY in this exact format:
        Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]
        
        Example:
        Front: 🐕 Iro | Back: Dog - A friendly pet that loves to play!
        
        Rules:
        - Use a fun emoji
        - Front shows Bisayan word
        - Back shows English word followed by English meaning
        - Make it educational and fun for kids
        - Keep descriptions short and kid-friendly (under 20 words)
        - Just ONE card, no extra text
        - Use common Bisayan words that kids can learn`;
        
        console.log(`📤 Sending request ${i + 1} to Ollama...`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
            signal: controller.signal
      });
          
          clearTimeout(timeoutId);
          
          console.log(`📥 Response ${i + 1} status:`, response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        const responseText = data.response;
            console.log(`🤖 AI Response for card ${i + 1}:`, responseText);
            console.log(`📊 Response data:`, data);
            
            // 🎯 ONE-LINE OLLAMA VERIFICATION LOG
            console.log(`✅ OLLAMA REAL RESPONSE: "${responseText.trim()}"`);
            
            // Parse the response to extract front and back
            let front = '';
            let back = '';
            
            // Try to find Front: and Back: in the response
            const frontMatch = responseText.match(/Front:\s*([^|]+)/i);
            const backMatch = responseText.match(/Back:\s*(.+)/i);
            
            if (frontMatch && backMatch) {
              front = frontMatch[1].trim();
              back = backMatch[1].trim();
              console.log(`✅ Parsed with regex - Front: "${front}", Back: "${back}"`);
            } else {
              // Try to parse format: [emoji] [name] | [description]
              const pipeIndex = responseText.indexOf('|');
              if (pipeIndex > 0) {
                const parts = responseText.split('|');
                if (parts.length >= 2) {
                  front = parts[0].replace(/Front:\s*/i, '').trim();
                  back = parts[1].replace(/Back:\s*/i, '').trim();
                  console.log(`✅ Parsed with pipe - Front: "${front}", Back: "${back}"`);
                }
              }
            }
            
            // If parsing failed, try to extract from lines
            if (!front || !back) {
              const lines = responseText.split('\n');
              for (const line of lines) {
                if (line.includes('Front:') && !front) {
                  front = line.replace(/Front:\s*/i, '').trim();
                }
                if (line.includes('Back:') && !back) {
                  back = line.replace(/Back:\s*/i, '').trim();
                }
              }
              console.log(`✅ Parsed from lines - Front: "${front}", Back: "${back}"`);
            }
            
            // If still no luck, create a simple card from the response
            if (!front || !back) {
              const words = responseText.split(' ').slice(0, 3).join(' ');
              front = `🎯 ${words}`;
              back = responseText.substring(0, 50) + '...';
              console.log(`⚠️ Using fallback parsing - Front: "${front}", Back: "${back}"`);
            }
            
            console.log(`📝 Final card ${i + 1}:`, { front, back });
            
              newCards.push({
              id: i,
                front,
                back,
                isFlipped: false
              });
            
            // Small delay between requests to avoid overwhelming Ollama
            if (i < 4) {
              console.log(`⏳ Waiting 500ms before next request...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            const errorText = await response.text();
            console.error(`❌ Failed to generate card ${i + 1}:`, response.status, response.statusText, errorText);
            // Create a fallback card for this position
            const fallbackCards = getFallbackCards(selectedCategory);
            const fallbackCard = fallbackCards[i % fallbackCards.length];
            newCards.push({
              ...fallbackCard,
              id: i
            });
            console.log(`🔄 Using fallback card ${i + 1}:`, fallbackCard);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`⏰ Timeout or error for card ${i + 1}:`, fetchError);
          // Create a fallback card for this position
          const fallbackCards = getFallbackCards(selectedCategory);
          const fallbackCard = fallbackCards[i % fallbackCards.length];
            newCards.push({
              ...fallbackCard,
              id: i
            });
          console.log(`🔄 Using fallback card ${i + 1} due to error:`, fallbackCard);
          }
        }
        
      console.log('🎉 Generated flashcards from Ollama:', newCards);
        setFlashcards(newCards);
        setCurrentCardIndex(0);
      
    } catch (error) {
      console.error('💥 Error generating flashcards:', error);
      console.error('💥 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // Only use fallback if there's a complete failure
      const fallbackCards = getFallbackCards(selectedCategory);
      const shuffledFallbacks = shuffleArray([...fallbackCards]);
      setFlashcards(shuffledFallbacks);
      setCurrentCardIndex(0);
      console.log('🔄 Using complete fallback cards:', shuffledFallbacks);
    } finally {
      setIsGenerating(false);
      console.log('🏁 Flashcard generation completed');
    }
  }, [selectedCategory]);

  // Helper function to get fallback cards with Bisayan language examples
  const getFallbackCards = (category: string) => {
    const fallbackCards: { [key: string]: Array<{ id: number; front: string; back: string; isFlipped: boolean }> } = {
      'basic-words': [
        { id: 0, front: '🏠 Balay', back: 'House - A place where we live!', isFlipped: false },
        { id: 1, front: '🌳 Kahoy', back: 'Tree - A tall plant with leaves!', isFlipped: false },
        { id: 2, front: '☀️ Adlaw', back: 'Sun - The bright star in the sky!', isFlipped: false },
        { id: 3, front: '🌙 Bulan', back: 'Moon - The light in the night sky!', isFlipped: false },
        { id: 4, front: '💧 Tubig', back: 'Water - What we drink to stay healthy!', isFlipped: false },
        { id: 5, front: '🔥 Kalayo', back: 'Fire - The hot orange flame!', isFlipped: false },
        { id: 6, front: '🌍 Kalibutan', back: 'Earth - Our beautiful planet!', isFlipped: false },
        { id: 7, front: '⭐ Bitoon', back: 'Star - Twinkling lights in the sky!', isFlipped: false },
        { id: 8, front: '🏔️ Bukid', back: 'Mountain - A very tall hill!', isFlipped: false },
        { id: 9, front: '🌊 Dagat', back: 'Ocean - The big blue water!', isFlipped: false }
      ],
      'family': [
        { id: 0, front: '👨 Tatay', back: 'Father - Our loving dad!', isFlipped: false },
        { id: 1, front: '👩 Nanay', back: 'Mother - Our caring mom!', isFlipped: false },
        { id: 2, front: '👦 Igsoon nga lalaki', back: 'Brother - Our brother!', isFlipped: false },
        { id: 3, front: '👧 Igsoon nga babaye', back: 'Sister - Our sister!', isFlipped: false },
        { id: 4, front: '👴 Lolo', back: 'Grandfather - Our grandpa!', isFlipped: false },
        { id: 5, front: '👵 Lola', back: 'Grandmother - Our grandma!', isFlipped: false },
        { id: 6, front: '👶 Bata', back: 'Baby - A little child!', isFlipped: false },
        { id: 7, front: '👪 Pamilya', back: 'Family - All the people we love!', isFlipped: false },
        { id: 8, front: '👨‍👩‍👧‍👦 Mga ginikanan', back: 'Parents - Our mom and dad!', isFlipped: false },
        { id: 9, front: '👫 Magtiayon', back: 'Couple - A husband and wife!', isFlipped: false }
      ],
      'food': [
        { id: 0, front: '🍚 Bugas', back: 'Rice - The white grain we eat!', isFlipped: false },
        { id: 1, front: '🍞 Tinapay', back: 'Bread - Soft food we eat!', isFlipped: false },
        { id: 2, front: '🍎 Mansanas', back: 'Apple - A red sweet fruit!', isFlipped: false },
        { id: 3, front: '🍌 Saging', back: 'Banana - A yellow curved fruit!', isFlipped: false },
        { id: 4, front: '🥛 Gatas', back: 'Milk - White drink from cows!', isFlipped: false },
        { id: 5, front: '🍖 Karneng', back: 'Meat - Food from animals!', isFlipped: false },
        { id: 6, front: '🐟 Isda', back: 'Fish - Swimming food from water!', isFlipped: false },
        { id: 7, front: '🥚 Itlog', back: 'Egg - White food from chickens!', isFlipped: false },
        { id: 8, front: '🧀 Keso', back: 'Cheese - Yellow food from milk!', isFlipped: false },
        { id: 9, front: '🍰 Keyk', back: 'Cake - Sweet dessert for birthdays!', isFlipped: false }
      ],
      'greetings': [
        { id: 0, front: '👋 Kumusta', back: 'Hello - A friendly greeting!', isFlipped: false },
        { id: 1, front: '👋 Kumusta ka', back: 'Hi - How are you?', isFlipped: false },
        { id: 2, front: '👋 Paalam', back: 'Goodbye - See you later!', isFlipped: false },
        { id: 3, front: '🙏 Salamat', back: 'Thank you - I appreciate you!', isFlipped: false },
        { id: 4, front: '😊 Palihug', back: 'Please - A polite request!', isFlipped: false },
        { id: 5, front: '😔 Pasayloa', back: 'Sorry - I made a mistake!', isFlipped: false },
        { id: 6, front: '🌅 Maayong buntag', back: 'Good morning - Have a good day!', isFlipped: false },
        { id: 7, front: '🌞 Maayong hapon', back: 'Good afternoon - Good afternoon!', isFlipped: false },
        { id: 8, front: '🌙 Maayong gabii', back: 'Good evening - Good evening!', isFlipped: false },
        { id: 9, front: '😴 Maayong gabii', back: 'Good night - Sleep well!', isFlipped: false }
      ]
    };
    
    return fallbackCards[category] || fallbackCards['basic-words'];
  };

  // Helper function to get fallback quiz questions with Bisayan language examples
  const getFallbackQuizQuestions = (category: string) => {
    const fallbackQuestions: { [key: string]: Array<{ id: number; question: string; options: string[]; correctAnswer: string; explanation: string }> } = {
      'basic-words': [
        {
          id: 0,
          question: 'What is "house" in Bisayan?',
          options: ['Iro', 'Balay', 'Tubig', 'Pagkaon'],
          correctAnswer: 'B',
          explanation: 'Balay means house in Bisayan!'
        },
        {
          id: 1,
          question: 'What is "water" in Bisayan?',
          options: ['Kalayo', 'Tubig', 'Kahoy', 'Adlaw'],
          correctAnswer: 'B',
          explanation: 'Tubig means water in Bisayan!'
        },
        {
          id: 2,
          question: 'What is "tree" in Bisayan?',
          options: ['Kahoy', 'Balay', 'Tubig', 'Kalayo'],
          correctAnswer: 'A',
          explanation: 'Kahoy means tree in Bisayan!'
        },
        {
          id: 3,
          question: 'What is "sun" in Bisayan?',
          options: ['Bulan', 'Adlaw', 'Bitoon', 'Kalibutan'],
          correctAnswer: 'B',
          explanation: 'Adlaw means sun in Bisayan!'
        },
        {
          id: 4,
          question: 'What is "fire" in Bisayan?',
          options: ['Kalayo', 'Tubig', 'Kahoy', 'Balay'],
          correctAnswer: 'A',
          explanation: 'Kalayo means fire in Bisayan!'
        }
      ],
      'family': [
        {
          id: 0,
          question: 'What is "father" in Bisayan?',
          options: ['Nanay', 'Tatay', 'Lolo', 'Lola'],
          correctAnswer: 'B',
          explanation: 'Tatay means father in Bisayan!'
        },
        {
          id: 1,
          question: 'What is "mother" in Bisayan?',
          options: ['Tatay', 'Nanay', 'Lolo', 'Lola'],
          correctAnswer: 'B',
          explanation: 'Nanay means mother in Bisayan!'
        },
        {
          id: 2,
          question: 'What is "brother" in Bisayan?',
          options: ['Igsoon nga babaye', 'Igsoon nga lalaki', 'Bata', 'Pamilya'],
          correctAnswer: 'B',
          explanation: 'Igsoon nga lalaki means brother in Bisayan!'
        },
        {
          id: 3,
          question: 'What is "sister" in Bisayan?',
          options: ['Igsoon nga lalaki', 'Igsoon nga babaye', 'Bata', 'Pamilya'],
          correctAnswer: 'B',
          explanation: 'Igsoon nga babaye means sister in Bisayan!'
        },
        {
          id: 4,
          question: 'What is "baby" in Bisayan?',
          options: ['Bata', 'Pamilya', 'Mga ginikanan', 'Magtiayon'],
          correctAnswer: 'A',
          explanation: 'Bata means baby in Bisayan!'
        }
      ],
      'food': [
        {
          id: 0,
          question: 'What is "rice" in Bisayan?',
          options: ['Tinapay', 'Bugas', 'Mansanas', 'Saging'],
          correctAnswer: 'B',
          explanation: 'Bugas means rice in Bisayan!'
        },
        {
          id: 1,
          question: 'What is "bread" in Bisayan?',
          options: ['Bugas', 'Tinapay', 'Mansanas', 'Saging'],
          correctAnswer: 'B',
          explanation: 'Tinapay means bread in Bisayan!'
        },
        {
          id: 2,
          question: 'What is "apple" in Bisayan?',
          options: ['Mansanas', 'Saging', 'Gatas', 'Karneng'],
          correctAnswer: 'A',
          explanation: 'Mansanas means apple in Bisayan!'
        },
        {
          id: 3,
          question: 'What is "banana" in Bisayan?',
          options: ['Mansanas', 'Saging', 'Gatas', 'Karneng'],
          correctAnswer: 'B',
          explanation: 'Saging means banana in Bisayan!'
        },
        {
          id: 4,
          question: 'What is "milk" in Bisayan?',
          options: ['Gatas', 'Karneng', 'Isda', 'Itlog'],
          correctAnswer: 'A',
          explanation: 'Gatas means milk in Bisayan!'
        }
      ],
      'greetings': [
        {
          id: 0,
          question: 'What is "hello" in Bisayan?',
          options: ['Paalam', 'Kumusta', 'Salamat', 'Palihug'],
          correctAnswer: 'B',
          explanation: 'Kumusta means hello in Bisayan!'
        },
        {
          id: 1,
          question: 'What is "goodbye" in Bisayan?',
          options: ['Kumusta', 'Paalam', 'Salamat', 'Palihug'],
          correctAnswer: 'B',
          explanation: 'Paalam means goodbye in Bisayan!'
        },
        {
          id: 2,
          question: 'What is "thank you" in Bisayan?',
          options: ['Salamat', 'Palihug', 'Pasayloa', 'Maayong buntag'],
          correctAnswer: 'A',
          explanation: 'Salamat means thank you in Bisayan!'
        },
        {
          id: 3,
          question: 'What is "please" in Bisayan?',
          options: ['Palihug', 'Pasayloa', 'Maayong buntag', 'Maayong hapon'],
          correctAnswer: 'A',
          explanation: 'Palihug means please in Bisayan!'
        },
        {
          id: 4,
          question: 'What is "good morning" in Bisayan?',
          options: ['Maayong hapon', 'Maayong buntag', 'Maayong gabii', 'Kumusta'],
          correctAnswer: 'B',
          explanation: 'Maayong buntag means good morning in Bisayan!'
        }
      ]
    };
    
    return fallbackQuestions[category] || fallbackQuestions['basic-words'];
  };

  // Helper function to shuffle arrays
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const askAIStudyBuddy = async () => {
    if (!aiMessage.trim()) return;
    
    try {
      setIsAiThinking(true);
      setAiResponse('');
      
      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `You are a friendly Bisayan (Cebuano) language teacher for 5-year-old children. A child asks: "${aiMessage}". 
          Please give a helpful, age-appropriate response about Bisayan language that encourages learning and curiosity. 
          Include Bisayan words and their English meanings. Keep it simple, fun, and under 100 words. Use emojis when appropriate!
          Focus on teaching Bisayan vocabulary, phrases, or grammar in a fun way for kids.`,
          model: selectedModel
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiResponse(data.response);
      } else {
        setAiResponse('I\'m here to help you learn! 🌟 Let\'s try asking something else!');
      }
    } catch (error) {
      console.error('AI Study Buddy error:', error);
      setAiResponse('I\'m your friendly learning buddy! 🤖 Let\'s learn together!');
    } finally {
      setIsAiThinking(false);
    }
  };

  const translateToAllDialects = async () => {
    if (!dialectInput.trim()) return;
    
    try {
      setIsDialectTranslating(true);
      setDialectResults([]);
      
      const dialects = [
        { name: 'Cebuano (Bisayan)', emoji: '🏠', code: 'cebuano' },
        { name: 'Tagalog', emoji: '🏢', code: 'tagalog' },
        { name: 'Ilocano', emoji: '🏔️', code: 'ilocano' },
        { name: 'Waray', emoji: '🌊', code: 'waray' }
      ];
      
      const results = [];
      
      for (const dialect of dialects) {
        console.log(`🌏 Translating "${dialectInput}" to ${dialect.name}...`);
        
        const response = await fetch('/api/ollama', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: `Translate the English word "${dialectInput}" to ${dialect.name}. 
            
            Respond ONLY in this exact format:
            Translation: [word in ${dialect.name}]
            Pronunciation: [how to say it]
            
            Example:
            Translation: Balay
            Pronunciation: bah-LAY
            
            Rules:
            - Use authentic ${dialect.name} vocabulary
            - Provide pronunciation guide
            - Just the translation and pronunciation, no extra text`,
            model: selectedModel
          })
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data.response;
          
          // Parse the response
          const translationMatch = responseText.match(/Translation:\s*(.+)/i);
          const pronunciationMatch = responseText.match(/Pronunciation:\s*(.+)/i);
          
          const translation = translationMatch ? translationMatch[1].trim() : 'Translation not found';
          const pronunciation = pronunciationMatch ? pronunciationMatch[1].trim() : 'Pronunciation not available';
          
          results.push({
            dialect: dialect.name,
            translation,
            emoji: dialect.emoji,
            pronunciation
          });
          
          console.log(`✅ ${dialect.name}: ${translation} (${pronunciation})`);
        } else {
          console.error(`❌ Failed to translate to ${dialect.name}`);
          results.push({
            dialect: dialect.name,
            translation: 'Translation failed',
            emoji: dialect.emoji,
            pronunciation: 'Please try again'
          });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setDialectResults(results);
      
    } catch (error) {
      console.error('Dialect translation error:', error);
      setDialectResults([{
        dialect: 'Error',
        translation: 'Something went wrong',
        emoji: '❌',
        pronunciation: 'Please try again'
      }]);
    } finally {
      setIsDialectTranslating(false);
    }
  };

  // Navigation handler functions
  const handleSectionSelect = (section: Section) => {
    setCurrentSection(section);
    if (section === 'learning-games') {
      setCurrentStep('select-game');
    } else if (section === 'ai-buddy') {
      setCurrentStep('play-game');
    } else if (section === 'progress') {
      setCurrentStep('play-game');
    }
  };

  const handleGameSelect = (game: GameType) => {
    setSelectedGame(game);
    setCurrentStep('select-category');
    if (game === 'memory-match') {
      resetMemoryGameState();
    }
    if (game === 'multiple-choice') {
      setQuizQuestions([]);
      setCurrentQuizQuestionIndex(0);
      setSelectedOptionIndex(null);
      setShowOptionResult(false);
      setQuizSessionCorrect(0);
      setQuizFinished(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    console.log('Category selected:', category);
    setSelectedCategory(category);
    setCurrentStep('play-game');
    
    // Trigger appropriate generation based on game type
    if (selectedGame === 'flashcards') {
      console.log('Directly calling generateFlashcards for category:', category);
      setTimeout(() => {
        console.log('🚀 About to call generateFlashcards with category:', category);
        generateFlashcards();
      }, 100); // Small delay to ensure state is set
    } else if (selectedGame === 'memory-match') {
      console.log('Directly calling generateMemoryCards for category:', category);
      setTimeout(() => {
        console.log('🚀 About to call generateMemoryCards with category:', category);
        generateMemoryCards();
      }, 100); // Small delay to ensure state is set
      resetMemoryGameState();
    } else if (selectedGame === 'multiple-choice') {
      console.log('Directly calling generateQuizQuestions for category:', category);
      setTimeout(() => {
        console.log('🚀 About to call generateQuizQuestions with category:', category);
        generateQuizQuestions();
      }, 100); // Small delay to ensure state is set
      setQuizQuestions([]);
      setCurrentQuizQuestionIndex(0);
      setSelectedOptionIndex(null);
      setShowOptionResult(false);
      setQuizSessionCorrect(0);
      setQuizFinished(false);
    }
  };

  const handleBackToGames = () => {
    setCurrentStep('select-game');
    setSelectedGame(null);
    setSelectedCategory(null);
  };

  const handleBackToCategories = () => {
    setCurrentStep('select-category');
    setSelectedCategory(null);
  };

  const handleBackToSections = () => {
    setCurrentStep('select-section');
    setCurrentSection('learning-games');
    setSelectedGame(null);
    setSelectedCategory(null);
  };

  const handleBackToHome = () => {
    setCurrentStep('select-section');
    setCurrentSection('learning-games');
    setSelectedGame(null);
    setSelectedCategory(null);
  };

  // Helper function to reset memory game state
  const resetMemoryGameState = () => {
    setMemoryCards([]);
    setFlippedCards([]);
    setMatchedPairs([]);
    setMemoryScore(0);
    setMemoryMoves(0);
    setIsMemoryGenerating(false);
  };

  // Card navigation functions
  const flipCard = () => {
    if (flashcards.length > 0) {
      const updatedCards = [...flashcards];
      updatedCards[currentCardIndex].isFlipped = !updatedCards[currentCardIndex].isFlipped;
      setFlashcards(updatedCards);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // Memory game functions
  const handleMemoryCardClick = (cardId: number) => {
    // Implementation for memory card click
    console.log('Memory card clicked:', cardId);
  };

  const generateMemoryCards = async () => {
    console.log('🎯 generateMemoryCards called with category:', selectedCategory);
    if (!selectedCategory) {
      console.log('❌ No category selected for memory cards');
      return;
    }
    
    try {
      setIsMemoryGenerating(true);
      console.log('🔄 Starting memory card generation...');
      
      // Test Ollama connection first
      console.log('🔍 Testing Ollama connection for memory cards...');
      const testResponse = await fetch('/api/ollama', {
        method: 'GET'
      });
      
      if (!testResponse.ok) {
        throw new Error(`Ollama connection failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      const testData = await testResponse.json();
      console.log('✅ Ollama connection test for memory:', testData);
      console.log(`✅ OLLAMA CONNECTION VERIFIED FOR MEMORY: ${testData.status} | Models: ${testData.models?.length || 0}`);
      
      // If connection test fails, use fallback immediately
      if (!testData.status || testData.status !== 'connected') {
        console.log('⚠️ Ollama not connected, using fallback memory cards');
        const fallbackCards = getFallbackCards(selectedCategory);
        const memoryCards = [];
        
        // Create pairs for memory match (each card appears twice)
        for (let i = 0; i < Math.min(6, fallbackCards.length); i++) {
          const card = fallbackCards[i];
          memoryCards.push(
            { id: i * 2, ...card, isFlipped: false, isMatched: false },
            { id: i * 2 + 1, ...card, isFlipped: false, isMatched: false }
          );
        }
        
        setMemoryCards(shuffleArray(memoryCards));
        setIsMemoryGenerating(false);
        return;
      }
      
      const newMemoryCards = [];
      
      // Generate 6 memory cards (3 pairs) one by one
      for (let i = 0; i < 6; i++) {
        console.log(`🎯 Generating memory card ${i + 1}/6...`);
        
        const prompt = `Create ONE Bisayan (Cebuano) language flashcard about ${selectedCategory} for 5-year-olds.
        
        Respond ONLY in this exact format:
        Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]
        
        Example:
        Front: 🐕 Iro | Back: Dog - A friendly pet that loves to play!
        
        Rules:
        - Use a fun emoji
        - Front shows Bisayan word
        - Back shows English word followed by English meaning
        - Make it educational and fun for kids
        - Keep descriptions short and kid-friendly (under 20 words)
        - Just ONE card, no extra text
        - Use common Bisayan words that kids can learn`;
        
        console.log(`📤 Sending memory card request ${i + 1} to Ollama...`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch('/api/ollama', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          console.log(`📥 Memory card response ${i + 1} status:`, response.status, response.statusText);
          
          if (response.ok) {
            const data = await response.json();
            const responseText = data.response;
            console.log(`🤖 AI Response for memory card ${i + 1}:`, responseText);
            
            // 🎯 ONE-LINE OLLAMA VERIFICATION LOG FOR MEMORY
            console.log(`✅ OLLAMA REAL RESPONSE FOR MEMORY: "${responseText.trim()}"`);
            
            // Parse the response to extract front and back
            let front = '';
            let back = '';
            
            // Try to find Front: and Back: in the response
            const frontMatch = responseText.match(/Front:\s*([^|]+)/i);
            const backMatch = responseText.match(/Back:\s*(.+)/i);
            
            if (frontMatch && backMatch) {
              front = frontMatch[1].trim();
              back = backMatch[1].trim();
              console.log(`✅ Parsed memory card with regex - Front: "${front}", Back: "${back}"`);
            } else {
              // Try to parse format: [emoji] [name] | [description]
              const pipeIndex = responseText.indexOf('|');
              if (pipeIndex > 0) {
                const parts = responseText.split('|');
                if (parts.length >= 2) {
                  front = parts[0].replace(/Front:\s*/i, '').trim();
                  back = parts[1].replace(/Back:\s*/i, '').trim();
                  console.log(`✅ Parsed memory card with pipe - Front: "${front}", Back: "${back}"`);
                }
              }
            }
            
            // If parsing failed, try to extract from lines
            if (!front || !back) {
              const lines = responseText.split('\n');
              for (const line of lines) {
                if (line.includes('Front:') && !front) {
                  front = line.replace(/Front:\s*/i, '').trim();
                }
                if (line.includes('Back:') && !back) {
                  back = line.replace(/Back:\s*/i, '').trim();
                }
              }
              console.log(`✅ Parsed memory card from lines - Front: "${front}", Back: "${back}"`);
            }
            
            // If still no luck, create a simple card from the response
            if (!front || !back) {
              const words = responseText.split(' ').slice(0, 3).join(' ');
              front = `🎯 ${words}`;
              back = responseText.substring(0, 50) + '...';
              console.log(`⚠️ Using fallback parsing for memory card - Front: "${front}", Back: "${back}"`);
            }
            
            console.log(`📝 Final memory card ${i + 1}:`, { front, back });
            
            newMemoryCards.push({
              id: i,
              front,
              back,
              isFlipped: false,
              isMatched: false
            });
            
            // Small delay between requests to avoid overwhelming Ollama
            if (i < 5) {
              console.log(`⏳ Waiting 500ms before next memory card request...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            const errorText = await response.text();
            console.error(`❌ Failed to generate memory card ${i + 1}:`, response.status, response.statusText, errorText);
            // Create a fallback card for this position
            const fallbackCards = getFallbackCards(selectedCategory);
            const fallbackCard = fallbackCards[i % fallbackCards.length];
            newMemoryCards.push({
              ...fallbackCard,
              id: i,
              isFlipped: false,
              isMatched: false
            });
            console.log(`🔄 Using fallback memory card ${i + 1}:`, fallbackCard);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`⏰ Timeout or error for memory card ${i + 1}:`, fetchError);
          // Create a fallback card for this position
          const fallbackCards = getFallbackCards(selectedCategory);
          const fallbackCard = fallbackCards[i % fallbackCards.length];
          newMemoryCards.push({
            ...fallbackCard,
            id: i,
            isFlipped: false,
            isMatched: false
          });
          console.log(`🔄 Using fallback memory card ${i + 1} due to error:`, fallbackCard);
        }
      }
      
      // Create pairs for memory match (each card appears twice)
      const memoryPairs = [];
      for (let i = 0; i < newMemoryCards.length; i++) {
        const card = newMemoryCards[i];
        memoryPairs.push(
          { ...card, id: i * 2, isFlipped: false, isMatched: false },
          { ...card, id: i * 2 + 1, isFlipped: false, isMatched: false }
        );
      }
      
      console.log('🎉 Generated memory cards from Ollama:', memoryPairs);
      setMemoryCards(shuffleArray(memoryPairs));
      setIsMemoryGenerating(false);
      
    } catch (error) {
      console.error('❌ Error generating memory cards:', error);
      // Use fallback cards
      const fallbackCards = getFallbackCards(selectedCategory);
      const memoryCards = [];
      
      // Create pairs for memory match (each card appears twice)
      for (let i = 0; i < Math.min(6, fallbackCards.length); i++) {
        const card = fallbackCards[i];
        memoryCards.push(
          { id: i * 2, ...card, isFlipped: false, isMatched: false },
          { id: i * 2 + 1, ...card, isFlipped: false, isMatched: false }
        );
      }
      
      setMemoryCards(shuffleArray(memoryCards));
      setIsMemoryGenerating(false);
    }
  };

  // Quiz functions
  const generateQuizQuestions = async () => {
    console.log('🎯 generateQuizQuestions called with category:', selectedCategory);
    if (!selectedCategory) {
      console.log('❌ No category selected for quiz questions');
      return;
    }
    
    try {
      setIsQuizGenerating(true);
      console.log('🔄 Starting quiz question generation...');
      
      // Test Ollama connection first
      console.log('🔍 Testing Ollama connection for quiz questions...');
      const testResponse = await fetch('/api/ollama', {
        method: 'GET'
      });
      
      if (!testResponse.ok) {
        throw new Error(`Ollama connection failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      const testData = await testResponse.json();
      console.log('✅ Ollama connection test for quiz:', testData);
      console.log(`✅ OLLAMA CONNECTION VERIFIED FOR QUIZ: ${testData.status} | Models: ${testData.models?.length || 0}`);
      
      // If connection test fails, use fallback immediately
      if (!testData.status || testData.status !== 'connected') {
        console.log('⚠️ Ollama not connected, using fallback quiz questions');
        const fallbackQuestions = getFallbackQuizQuestions(selectedCategory);
        setQuizQuestions(fallbackQuestions);
        setIsQuizGenerating(false);
        return;
      }
      
      const newQuestions = [];
      
      // Generate 5 quiz questions one by one
      for (let i = 0; i < 5; i++) {
        console.log(`🎯 Generating quiz question ${i + 1}/5...`);
        
        const prompt = `Create ONE multiple choice quiz question about Bisayan (Cebuano) language for 5-year-olds about ${selectedCategory}.
        
        Respond ONLY in this exact format:
        Question: [Question text]
        A) [Option A]
        B) [Option B] 
        C) [Option C]
        D) [Option D]
        Answer: [Correct answer letter]
        
        Example:
        Question: What is "house" in Bisayan?
        A) Iro
        B) Balay
        C) Tubig
        D) Pagkaon
        Answer: B
        
        Rules:
        - Make it educational and fun for kids
        - Use common Bisayan words
        - Keep questions simple and clear
        - Only ONE question, no extra text
        - Make sure the correct answer is accurate`;
        
        console.log(`📤 Sending quiz question request ${i + 1} to Ollama...`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch('/api/ollama', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: selectedModel }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          console.log(`📥 Quiz question response ${i + 1} status:`, response.status, response.statusText);
          
          if (response.ok) {
            const data = await response.json();
            const responseText = data.response;
            console.log(`🤖 AI Response for quiz question ${i + 1}:`, responseText);
            
            // 🎯 ONE-LINE OLLAMA VERIFICATION LOG FOR QUIZ
            console.log(`✅ OLLAMA REAL RESPONSE FOR QUIZ: "${responseText.trim()}"`);
            
            // Parse the response to extract question, options, and answer
            let question = '';
            let options = ['', '', '', ''];
            let correctAnswer = '';
            
            // Try to parse the structured format
            const questionMatch = responseText.match(/Question:\s*(.+)/i);
            const optionAMatch = responseText.match(/A\)\s*(.+)/i);
            const optionBMatch = responseText.match(/B\)\s*(.+)/i);
            const optionCMatch = responseText.match(/C\)\s*(.+)/i);
            const optionDMatch = responseText.match(/D\)\s*(.+)/i);
            const answerMatch = responseText.match(/Answer:\s*([ABCD])/i);
            
            if (questionMatch) {
              question = questionMatch[1].trim();
            }
            if (optionAMatch) {
              options[0] = optionAMatch[1].trim();
            }
            if (optionBMatch) {
              options[1] = optionBMatch[1].trim();
            }
            if (optionCMatch) {
              options[2] = optionCMatch[1].trim();
            }
            if (optionDMatch) {
              options[3] = optionDMatch[1].trim();
            }
            if (answerMatch) {
              correctAnswer = answerMatch[1].trim();
            }
            
            // If parsing failed, create a simple question from the response
            if (!question || !options[0] || !correctAnswer) {
              const lines = responseText.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                question = lines[0].replace(/Question:\s*/i, '').trim() || 'Bisayan language question';
                // Try to extract options from remaining lines
                for (let j = 1; j < Math.min(5, lines.length); j++) {
                  const line = lines[j];
                  if (line.match(/^[ABCD]\)/)) {
                    const optionText = line.replace(/^[ABCD]\)\s*/, '').trim();
                    const optionIndex = line.charAt(0).charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                    if (optionIndex >= 0 && optionIndex < 4) {
                      options[optionIndex] = optionText;
                    }
                  }
                }
                // Default answer if not found
                correctAnswer = correctAnswer || 'A';
              }
              console.log(`⚠️ Using fallback parsing for quiz question - Question: "${question}", Answer: "${correctAnswer}"`);
            }
            
            console.log(`📝 Final quiz question ${i + 1}:`, { question, options, correctAnswer });
            
            newQuestions.push({
              id: i,
              question,
              options,
              correctAnswer: correctAnswer.toUpperCase(),
              explanation: `This is a Bisayan language question about ${selectedCategory}.`
            });
            
            // Small delay between requests to avoid overwhelming Ollama
            if (i < 4) {
              console.log(`⏳ Waiting 500ms before next quiz question request...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            const errorText = await response.text();
            console.error(`❌ Failed to generate quiz question ${i + 1}:`, response.status, response.statusText, errorText);
            // Create a fallback question for this position
            const fallbackQuestions = getFallbackQuizQuestions(selectedCategory);
            const fallbackQuestion = fallbackQuestions[i % fallbackQuestions.length];
            newQuestions.push({
              ...fallbackQuestion,
              id: i
            });
            console.log(`🔄 Using fallback quiz question ${i + 1}:`, fallbackQuestion);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`⏰ Timeout or error for quiz question ${i + 1}:`, fetchError);
          // Create a fallback question for this position
          const fallbackQuestions = getFallbackQuizQuestions(selectedCategory);
          const fallbackQuestion = fallbackQuestions[i % fallbackQuestions.length];
          newQuestions.push({
            ...fallbackQuestion,
            id: i
          });
          console.log(`🔄 Using fallback quiz question ${i + 1} due to error:`, fallbackQuestion);
        }
      }
      
      console.log('🎉 Generated quiz questions from Ollama:', newQuestions);
      setQuizQuestions(newQuestions);
      setCurrentQuizQuestionIndex(0);
      setSelectedOptionIndex(null);
      setShowOptionResult(false);
      setQuizSessionCorrect(0);
      setQuizFinished(false);
      setIsQuizGenerating(false);
      
    } catch (error) {
      console.error('❌ Error generating quiz questions:', error);
      // Use fallback questions
      const fallbackQuestions = getFallbackQuizQuestions(selectedCategory);
      setQuizQuestions(fallbackQuestions);
      setCurrentQuizQuestionIndex(0);
      setSelectedOptionIndex(null);
      setShowOptionResult(false);
      setQuizSessionCorrect(0);
      setQuizFinished(false);
      setIsQuizGenerating(false);
    }
  };

  // Render game content based on selected game
  const renderGameContent = () => {
    if (currentSection === 'dialect-translator') {
      return (
        <div className="space-y-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">🌏 Philippine Dialects Translator</h2>
            <button
              onClick={handleBackToSections}
              className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg"
            >
              ← Back to Learn Bisayan Language
            </button>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Translate English to All Philippine Dialects</h3>
            
            <div className="space-y-6">
              <div className="text-center">
                <input
                  type="text"
                  placeholder="Enter English word (e.g., 'house', 'water', 'hello')"
                  className="w-full max-w-md p-4 rounded-2xl bg-white/20 text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg"
                  value={dialectInput}
                  onChange={(e) => setDialectInput(e.target.value)}
                />
              </div>
              
              <div className="text-center">
                <button
                  onClick={translateToAllDialects}
                  disabled={!dialectInput.trim() || isDialectTranslating}
                  className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white px-8 py-4 rounded-2xl hover:from-purple-500 hover:via-pink-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 border-2 border-purple-300 font-bold text-lg shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                  {isDialectTranslating ? '🔄 Translating...' : '🌏 Translate to All Dialects'}
                </button>
              </div>
              
              {dialectResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                  {dialectResults.map((result, index) => (
                    <div key={index} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <div className="text-center">
                        <h4 className="text-xl font-bold text-white mb-2">{result.dialect}</h4>
                        <div className="text-3xl font-bold text-purple-300 mb-2">{result.emoji}</div>
                        <p className="text-lg text-yellow-300 font-semibold">{result.translation}</p>
                        <p className="text-sm text-white/70 mt-2">{result.pronunciation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (currentSection === 'ai-buddy') {
      return (
        <div className="space-y-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">🤖 Bisayan AI Teacher</h2>
            <button
              onClick={handleBackToSections}
              className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg"
            >
              ← Back to Learn Bisayan Language
            </button>
          </div>
          <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl p-10 shadow-2xl border-4 border-blue-200">
            <div className="text-center mb-8">
              <div className="text-8xl mb-6 animate-bounce">🇵🇭</div>
              <h3 className="text-4xl font-bold text-gray-800 mb-4 text-blue-600">Bisayan AI Teacher</h3>
              <p className="text-xl text-gray-600 mb-6">Ask me about Bisayan language! I'm here to help you learn! 🌟</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white/70 rounded-2xl p-6 border-2 border-blue-200 shadow">
                <textarea
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder="Ask me about Bisayan words, phrases, or grammar! 🤔"
                  className="w-full p-4 border-2 border-blue-200 rounded-xl text-lg focus:border-blue-400 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
              
              <div className="text-center">
                <button
                  onClick={askAIStudyBuddy}
                  disabled={isAiThinking || !aiMessage.trim()}
                  className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl hover:from-blue-500 hover:via-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-110 border-2 border-blue-300 font-bold text-lg shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                  {isAiThinking ? '🤔 Thinking...' : '💬 Ask Bisayan Teacher'}
                </button>
              </div>
              
              {aiResponse && (
                <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-2xl p-6 border-2 border-green-200 shadow">
                  <h4 className="text-lg font-bold text-gray-800 mb-3">🇵🇭 Bisayan Teacher Response:</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">{aiResponse}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (currentSection === 'progress') {
      return (
        <div className="space-y-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">📊 Scoreboard</h2>
            <button
              onClick={handleBackToSections}
              className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg"
            >
              ← Back to Kids Learning Adventure
            </button>
          </div>
          <div className="bg-gradient-to-br from-white via-green-50 to-teal-50 rounded-3xl p-10 shadow-2xl border-4 border-green-200">
            <div className="text-center mb-8">
              <div className="text-8xl mb-6 animate-bounce">📊</div>
              <h3 className="text-4xl font-bold text-gray-800 mb-4 text-green-600">Scoreboard</h3>
              <p className="text-xl text-gray-600 mb-6">Your learning progress! 🌟</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/70 rounded-2xl p-6 border-2 border-yellow-200 shadow">
                <h4 className="text-xl font-bold text-gray-800 mb-3">🎮 Games Completed</h4>
                <p className="text-3xl font-bold text-yellow-600">{progress.totalGamesCompleted}</p>
              </div>
              
              <div className="bg-white/70 rounded-2xl p-6 border-2 border-blue-200 shadow">
                <h4 className="text-xl font-bold text-gray-800 mb-3">🃏 Flashcards Viewed</h4>
                <p className="text-3xl font-bold text-blue-600">{progress.flashcardsViewed}</p>
              </div>
              
              <div className="bg-white/70 rounded-2xl p-6 border-2 border-pink-200 shadow">
                <h4 className="text-xl font-bold text-gray-800 mb-3">🧠 Memory Match</h4>
                <p className="text-lg text-gray-700">Games: {progress.memoryMatch.games}</p>
                <p className="text-lg text-gray-700">Best Score: {progress.memoryMatch.bestScore}</p>
              </div>
              
              <div className="bg-white/70 rounded-2xl p-6 border-2 border-purple-200 shadow">
                <h4 className="text-xl font-bold text-gray-800 mb-3">❓ Quiz</h4>
                <p className="text-lg text-gray-700">Games: {progress.quiz.games}</p>
                <p className="text-lg text-gray-700">Best Score: {progress.quiz.bestScore}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!selectedGame || !selectedCategory) return null;

    switch (selectedGame) {
      case 'flashcards':
        if (isGenerating || flashcards.length === 0) {
          return (
            <div className="text-center py-16">
              <div className="text-8xl mb-6 animate-bounce">🤖</div>
              <h3 className="text-3xl font-bold text-white mb-4">AI is creating your flashcards!</h3>
              <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-8 py-4 rounded-2xl inline-block shadow-lg">
                <p className="text-xl font-bold animate-pulse">
                  {isGenerating ? 'Generating with Ollama AI (llama3.2:3b)...' : 'Loading flashcards...'}
                </p>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center gap-2 bg-white/80 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200">
                  <span className="text-base">🤖</span> Powered by Ollama
                </span>
              </div>
              <div className="mt-6 text-white text-lg">
                <p>🎯 Creating fun learning cards about {selectedCategory}</p>
                <p className="text-sm mt-2 opacity-75">Check browser console for detailed logs</p>
              </div>
              <div className="mt-4 text-white text-sm">
                <p>Debug info: isGenerating={isGenerating.toString()}, cards={flashcards.length}</p>
                <p>Category: {selectedCategory}</p>
                <p>AI Model: {selectedModel}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    console.log('🔄 Force loading fallback cards...');
                    const fallbackCards = getFallbackCards(selectedCategory);
                    const shuffledFallbacks = shuffleArray([...fallbackCards]);
                    setFlashcards(shuffledFallbacks.slice(0, 5));
                    setCurrentCardIndex(0);
                    setIsGenerating(false);
                  }}
                  className="bg-gradient-to-r from-green-400 to-green-500 text-white px-6 py-3 rounded-2xl hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-110 border-2 border-green-300 font-bold text-lg shadow-lg"
                >
                  🔄 Load Sample Cards
                </button>
              </div>
            </div>
          );
        }
        
        const currentCard = flashcards[currentCardIndex];
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                🃏 {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Flashcards
              </h2>
              <button
                onClick={handleBackToCategories}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold"
              >
                ← Back
              </button>
            </div>
            
            <div className="text-center mb-8">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-2xl inline-block shadow-lg">
                <p className="text-xl font-bold">
                  Card {currentCardIndex + 1} of {flashcards.length}
                </p>
              </div>
            </div>

            <div className="max-w-3xl mx-auto">
              <div 
                className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl p-10 min-h-[350px] flex items-center justify-center cursor-pointer transform transition-all duration-500 hover:scale-105 border-4 border-yellow-200 hover:border-yellow-300"
                onClick={flipCard}
              >
                <div className="text-center">
                   {currentCard.isFlipped ? (
                     <div>
                       <div className="text-6xl font-bold mb-4 text-purple-600">{currentCard.back.split(' - ')[0]}</div>
                       <p className="text-lg text-gray-700 mb-4 max-w-md mx-auto leading-tight">{currentCard.back.split(' - ')[1]}</p>
                       <p className="text-lg text-gray-600 bg-yellow-100 px-4 py-2 rounded-xl">Click to see Bisayan word</p>
                     </div>
                   ) : (
                     <div>
                       <div className="text-6xl font-bold mb-4">{currentCard.front.split(' ')[0]}</div>
                       <div className="text-4xl font-bold mb-4 text-blue-600">{currentCard.front.split(' ').slice(1).join(' ')}</div>
                       <p className="text-lg text-gray-600 bg-blue-100 px-4 py-2 rounded-xl">Click to see English translation!</p>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <button
                onClick={generateFlashcards}
                disabled={isGenerating}
                className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-8 py-4 rounded-2xl hover:from-blue-500 hover:to-purple-600 transition-all duration-300 transform hover:scale-110 border-2 border-blue-300 font-bold text-lg shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
              >
                {isGenerating ? '🔄 Generating...' : '🔄 Generate New Cards'}
              </button>
            </div>

            <div className="flex justify-between items-center mt-10 max-w-3xl mx-auto">
              <button
                onClick={previousCard}
                disabled={currentCardIndex === 0}
                className="bg-gradient-to-r from-blue-400 to-blue-500 text-white px-8 py-4 rounded-2xl disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed hover:from-blue-500 hover:to-blue-600 transition-all duration-300 transform hover:scale-110 border-2 border-blue-300 font-bold text-lg shadow-lg"
              >
                ← Previous
              </button>
              
              <button
                onClick={flipCard}
                className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white px-10 py-4 rounded-2xl hover:from-purple-500 hover:via-pink-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 border-2 border-purple-300 font-bold text-lg shadow-lg animate-pulse"
              >
                {currentCard.isFlipped ? 'Show Front' : 'Flip Card'}
              </button>
              
              <button
                onClick={nextCard}
                disabled={currentCardIndex === flashcards.length - 1}
                className="bg-gradient-to-r from-green-400 to-green-500 text-white px-8 py-4 rounded-2xl disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-110 border-2 border-green-300 font-bold text-lg shadow-lg"
              >
                Next →
              </button>
            </div>
          </div>
        );

      case 'memory-match':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                🧠 {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Memory Match
              </h2>
              <button
                onClick={handleBackToCategories}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold"
              >
                ← Back
              </button>
            </div>
            <div className="bg-gradient-to-br from-white via-pink-50 to-rose-50 rounded-3xl p-10 text-center shadow-2xl border-4 border-pink-200">
              <div className="text-8xl mb-6 animate-bounce">🧠</div>
              <h3 className="text-4xl font-bold text-gray-800 mb-4 text-pink-600">Memory Match!</h3>
              <p className="text-xl text-gray-600 bg-gradient-to-r from-pink-100 to-rose-100 px-6 py-3 rounded-2xl inline-block">
                Find the matching pairs! 🎯
              </p>
            </div>
            <div className="text-center mt-8">
              <button
                onClick={generateMemoryCards}
                disabled={isMemoryGenerating}
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-8 py-4 rounded-2xl hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 border-2 border-yellow-300 font-bold text-lg shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
              >
                {isMemoryGenerating ? '🔄 Generating...' : '🔄 Generate New Cards'}
              </button>
            </div>
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                ❓ {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Quiz
              </h2>
              <button
                onClick={handleBackToCategories}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold"
              >
                ← Back
              </button>
            </div>

            {/* Loading State */}
            {isQuizGenerating && (
              <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-3xl p-10 text-center shadow-2xl border-4 border-indigo-200">
                <div className="text-8xl mb-6 animate-spin">🔄</div>
                <h3 className="text-4xl font-bold text-gray-800 mb-4 text-indigo-600">Generating Quiz Questions...</h3>
                <p className="text-xl text-gray-600 bg-gradient-to-r from-indigo-100 to-purple-100 px-6 py-3 rounded-2xl inline-block">
                  Creating Bisayan language questions! 🎯
                </p>
              </div>
            )}

            {/* Quiz Questions Display */}
            {!isQuizGenerating && quizQuestions.length > 0 && !quizFinished && (
              <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-3xl p-10 shadow-2xl border-4 border-indigo-200">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">❓</div>
                  <h3 className="text-3xl font-bold text-gray-800 mb-2 text-indigo-600">
                    Question {currentQuizQuestionIndex + 1} of {quizQuestions.length}
                  </h3>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${((currentQuizQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h4 className="text-2xl font-bold text-gray-800 mb-6">
                    {quizQuestions[currentQuizQuestionIndex]?.question}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {quizQuestions[currentQuizQuestionIndex]?.options.map((option, index) => {
                      const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                      const isSelected = selectedOptionIndex === index;
                      const isCorrect = optionLetter === quizQuestions[currentQuizQuestionIndex]?.correctAnswer;
                      const showResult = showOptionResult;
                      
                      let buttonClass = "bg-gradient-to-r from-indigo-400 via-purple-500 to-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 transform hover:scale-105 border-2 border-indigo-300";
                      
                      if (showResult) {
                        if (isCorrect) {
                          buttonClass = "bg-gradient-to-r from-green-400 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg border-2 border-green-300";
                        } else if (isSelected) {
                          buttonClass = "bg-gradient-to-r from-red-400 to-rose-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg border-2 border-red-300";
                        } else {
                          buttonClass = "bg-gradient-to-r from-gray-400 to-gray-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg border-2 border-gray-300 opacity-50";
                        }
                      }
                      
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            if (!showOptionResult) {
                              setSelectedOptionIndex(index);
                              setShowOptionResult(true);
                              if (optionLetter === quizQuestions[currentQuizQuestionIndex]?.correctAnswer) {
                                setQuizSessionCorrect(prev => prev + 1);
                              }
                            }
                          }}
                          disabled={showOptionResult}
                          className={buttonClass}
                        >
                          {optionLetter}) {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showOptionResult && (
                  <div className="text-center mb-6">
                    <div className={`text-2xl font-bold mb-4 ${selectedOptionIndex !== null && String.fromCharCode(65 + selectedOptionIndex) === quizQuestions[currentQuizQuestionIndex]?.correctAnswer ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedOptionIndex !== null && String.fromCharCode(65 + selectedOptionIndex) === quizQuestions[currentQuizQuestionIndex]?.correctAnswer ? '✅ Correct!' : '❌ Incorrect!'}
                    </div>
                    <p className="text-lg text-gray-700 bg-yellow-100 px-6 py-3 rounded-2xl inline-block">
                      {quizQuestions[currentQuizQuestionIndex]?.explanation}
                    </p>
                  </div>
                )}

                <div className="text-center">
                  {showOptionResult && (
                    <button
                      onClick={() => {
                        if (currentQuizQuestionIndex < quizQuestions.length - 1) {
                          setCurrentQuizQuestionIndex(prev => prev + 1);
                          setSelectedOptionIndex(null);
                          setShowOptionResult(false);
                        } else {
                          setQuizFinished(true);
                        }
                      }}
                      className="bg-gradient-to-r from-indigo-400 via-purple-500 to-violet-500 text-white px-8 py-4 rounded-2xl hover:from-indigo-500 hover:via-purple-600 hover:to-violet-600 transition-all duration-300 transform hover:scale-110 border-2 border-indigo-300 font-bold text-lg shadow-lg"
                    >
                      {currentQuizQuestionIndex < quizQuestions.length - 1 ? 'Next Question →' : 'Finish Quiz 🎉'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quiz Results */}
            {quizFinished && (
              <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl p-10 text-center shadow-2xl border-4 border-green-200">
                <div className="text-8xl mb-6">🎉</div>
                <h3 className="text-4xl font-bold text-gray-800 mb-4 text-green-600">Quiz Complete!</h3>
                <p className="text-2xl text-gray-700 mb-6">
                  You got <span className="font-bold text-green-600">{quizSessionCorrect}</span> out of <span className="font-bold text-indigo-600">{quizQuestions.length}</span> correct!
                </p>
                <div className="text-lg text-gray-600 mb-8">
                  {quizSessionCorrect === quizQuestions.length ? 'Perfect! 🌟' : 
                   quizSessionCorrect >= quizQuestions.length * 0.8 ? 'Great job! 👏' : 
                   quizSessionCorrect >= quizQuestions.length * 0.6 ? 'Good effort! 💪' : 
                   'Keep practicing! 📚'}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => {
                      setCurrentQuizQuestionIndex(0);
                      setSelectedOptionIndex(null);
                      setShowOptionResult(false);
                      setQuizSessionCorrect(0);
                      setQuizFinished(false);
                    }}
                    className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-8 py-4 rounded-2xl hover:from-green-500 hover:to-emerald-600 transition-all duration-300 transform hover:scale-110 border-2 border-green-300 font-bold text-lg shadow-lg"
                  >
                    🔄 Try Again
                  </button>
                  <button
                    onClick={generateQuizQuestions}
                    className="bg-gradient-to-r from-indigo-400 via-purple-500 to-violet-500 text-white px-8 py-4 rounded-2xl hover:from-indigo-500 hover:via-purple-600 hover:to-violet-600 transition-all duration-300 transform hover:scale-110 border-2 border-indigo-300 font-bold text-lg shadow-lg"
                  >
                    🆕 New Questions
                  </button>
                </div>
              </div>
            )}

            {/* No Questions State */}
            {!isQuizGenerating && quizQuestions.length === 0 && !quizFinished && (
              <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-3xl p-10 text-center shadow-2xl border-4 border-indigo-200">
                <div className="text-8xl mb-6 animate-bounce">❓</div>
                <h3 className="text-4xl font-bold text-gray-800 mb-4 text-indigo-600">Multiple Choice Quiz!</h3>
                <p className="text-xl text-gray-600 bg-gradient-to-r from-indigo-100 to-purple-100 px-6 py-3 rounded-2xl inline-block mb-8">
                  Test your knowledge! 🎯
                </p>
                <button
                  onClick={generateQuizQuestions}
                  disabled={isQuizGenerating}
                  className="bg-gradient-to-r from-indigo-400 via-purple-500 to-violet-500 text-white px-8 py-4 rounded-2xl hover:from-indigo-500 hover:via-purple-600 hover:to-violet-600 transition-all duration-300 transform hover:scale-110 border-2 border-indigo-300 font-bold text-lg shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                  {isQuizGenerating ? '🔄 Generating...' : '🔄 Generate Quiz Questions'}
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'select-section':
        return (
          <div className="space-y-8 pt-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white mb-6 animate-bounce drop-shadow-lg">
              🌟 Learn Bisayan Language 🌟
            </h1>
            <div className="text-center mb-10">
              <div className="text-8xl sm:text-9xl md:text-[10rem] lg:text-[12rem] animate-bounce" style={{ animationDelay: '0.2s' }}>
                🇵🇭
              </div>
              <p className="text-white text-lg sm:text-xl font-semibold mt-4 animate-pulse">
                Welcome to your Bisayan language journey! 🎉
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 max-w-lg mx-auto">
              <button
                onClick={() => handleSectionSelect('learning-games')}
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white text-2xl font-bold py-6 px-10 rounded-3xl shadow-2xl hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-yellow-300 animate-pulse"
              >
                🎮 Bisayan Flashcards
              </button>
              <button
                onClick={() => handleSectionSelect('ai-buddy')}
                className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-white text-2xl font-bold py-6 px-10 rounded-3xl shadow-2xl hover:from-blue-500 hover:via-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-110 hover:-rotate-1 border-4 border-blue-300 animate-pulse"
                style={{ animationDelay: '0.2s' }}
              >
                🤖 Bisayan AI Teacher
              </button>
              <button
                onClick={() => handleSectionSelect('dialect-translator')}
                className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white text-2xl font-bold py-6 px-10 rounded-3xl shadow-2xl hover:from-purple-500 hover:via-pink-600 hover:to-red-600 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-purple-300 animate-pulse"
                style={{ animationDelay: '0.3s' }}
              >
                🌏 Philippine Dialects
              </button>
              <button
                onClick={() => handleSectionSelect('progress')}
                className="bg-gradient-to-r from-green-400 via-teal-500 to-cyan-500 text-white text-2xl font-bold py-6 px-10 rounded-3xl shadow-2xl hover:from-green-500 hover:via-teal-600 hover:to-cyan-600 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-green-300 animate-pulse"
                style={{ animationDelay: '0.4s' }}
              >
                📊 Progress
              </button>
            </div>
          </div>
        );

      case 'select-game':
        return (
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-center text-white mb-8 animate-bounce drop-shadow-lg">
              Choose Your Learning Activity! 🎯
            </h2>
            <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
              <button
                onClick={() => handleGameSelect('flashcards')}
                className="bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 text-white text-3xl font-bold py-8 px-10 rounded-3xl shadow-2xl hover:from-yellow-400 hover:via-orange-500 hover:to-red-500 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-yellow-200 animate-pulse"
              >
                🃏 Bisayan Flashcards
              </button>
              <button
                onClick={() => handleGameSelect('memory-match')}
                className="bg-gradient-to-r from-pink-300 via-rose-400 to-red-400 text-white text-3xl font-bold py-8 px-10 rounded-3xl shadow-2xl hover:from-pink-400 hover:via-rose-500 hover:to-red-500 transition-all duration-300 transform hover:scale-110 hover:-rotate-1 border-4 border-pink-200 animate-pulse"
                style={{ animationDelay: '0.2s' }}
              >
                🧠 Word Memory
              </button>
              <button
                onClick={() => handleGameSelect('multiple-choice')}
                className="bg-gradient-to-r from-indigo-300 via-purple-400 to-violet-400 text-white text-3xl font-bold py-8 px-10 rounded-3xl shadow-2xl hover:from-indigo-400 hover:via-purple-500 hover:to-violet-500 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-indigo-200 animate-pulse"
                style={{ animationDelay: '0.4s' }}
              >
                ❓ Language Quiz
              </button>
            </div>
            <div className="text-center">
              <button
                onClick={handleBackToSections}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg"
              >
                ← Back to Learn Bisayan Language
              </button>
            </div>
          </div>
        );

      case 'select-category':
        return (
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-center text-white mb-8 animate-bounce drop-shadow-lg">
              Pick a Topic! 🎨
            </h2>
            <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
              <button
                onClick={() => handleCategorySelect('basic-words')}
                className="bg-gradient-to-r from-green-300 via-emerald-400 to-teal-400 text-white text-2xl font-bold py-6 px-8 rounded-3xl shadow-2xl hover:from-green-400 hover:via-emerald-500 hover:to-teal-500 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-green-200 animate-pulse"
              >
                📚 Basic Words
              </button>
              <button
                onClick={() => handleCategorySelect('family')}
                className="bg-gradient-to-r from-red-300 via-pink-400 to-rose-400 text-white text-2xl font-bold py-6 px-8 rounded-3xl shadow-2xl hover:from-red-400 hover:via-pink-500 hover:to-rose-500 transition-all duration-300 transform hover:scale-110 hover:-rotate-1 border-4 border-red-200 animate-pulse"
                style={{ animationDelay: '0.1s' }}
              >
                👨‍👩‍👧‍👦 Family
              </button>
              <button
                onClick={() => handleCategorySelect('food')}
                className="bg-gradient-to-r from-blue-300 via-cyan-400 to-sky-400 text-white text-2xl font-bold py-6 px-8 rounded-3xl shadow-2xl hover:from-blue-400 hover:via-cyan-500 hover:to-sky-500 transition-all duration-300 transform hover:scale-110 hover:rotate-1 border-4 border-blue-200 animate-pulse"
                style={{ animationDelay: '0.2s' }}
              >
                🍚 Food
              </button>
              <button
                onClick={() => handleCategorySelect('greetings')}
                className="bg-gradient-to-r from-purple-300 via-violet-400 to-indigo-400 text-white text-2xl font-bold py-6 px-8 rounded-3xl shadow-2xl hover:from-purple-400 hover:via-violet-500 hover:to-indigo-500 transition-all duration-300 transform hover:scale-110 hover:-rotate-1 border-4 border-purple-200 animate-pulse"
                style={{ animationDelay: '0.3s' }}
              >
                👋 Greetings
              </button>
            </div>
            <div className="text-center">
              <button
                onClick={handleBackToGames}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg"
              >
                ← Back to Games
              </button>
            </div>
          </div>
        );

      case 'play-game':
        return renderGameContent();


      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen morphing-gradient p-4 relative overflow-hidden">
      {/* Animated Background Bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
        <div className="bubble bubble-6"></div>
        <div className="bubble bubble-7"></div>
        <div className="bubble bubble-8"></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        {renderStepContent()}
      </div>
      
      <footer className="bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 text-white text-center py-4 text-sm shadow-lg mt-16">
        <div>
          <p className="font-bold">🇵🇭 Learn Bisayan Language 🇵🇭</p>
          <p className="text-xs opacity-90 italic">AI-Powered Bisayan Language Learning for Children</p>
          
          {/* Model Selector */}
          <div className="mt-3 mb-3">
            <label className="text-xs font-semibold mb-1 block">🤖 AI Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoadingModels}
              className="bg-white/20 text-white text-xs px-3 py-1 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            >
              {isLoadingModels ? (
                <option>Loading models...</option>
              ) : (
                availableModels.map((model) => (
                  <option key={model.name} value={model.name} className="bg-gray-800 text-white">
                    {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
                  </option>
                ))
              )}
            </select>
            <p className="text-xs opacity-75 mt-1">
              Currently using: <span className="font-semibold">{selectedModel}</span>
            </p>
          </div>
          
          <p>
            <a 
              href="https://hackathon.openxai.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-yellow-300 hover:text-yellow-200 underline font-semibold"
            >
              Powered by Ollama AI
            </a>
          </p>
          <p className="mt-2">
            <a 
              href="/ai-models" 
              className="text-blue-300 hover:text-blue-200 underline font-semibold"
            >
              🤖 Test AI Models
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}