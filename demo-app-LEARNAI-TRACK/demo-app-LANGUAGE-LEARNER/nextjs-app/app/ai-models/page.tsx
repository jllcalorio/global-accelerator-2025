'use client';

import { useState, useEffect } from 'react';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

interface TestResult {
  model: string;
  response: string;
  responseTime: number;
  timestamp: string;
}

export default function AIModelsPage() {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  // Load available models
  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      console.log('🔍 Loading available Ollama models...');
      const response = await fetch('/api/ollama/models');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Available models:', data);
        setAvailableModels(data.models || []);
        if (data.models && data.models.length > 0) {
          setSelectedModel(data.models[0].name);
        }
      } else {
        console.error('❌ Failed to load models:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Test a specific model with Bisayan content
  const testModel = async (modelName: string, testPrompt: string) => {
    const startTime = Date.now();
    try {
      console.log(`🧪 Testing model: ${modelName} with prompt: ${testPrompt}`);
      
      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: testPrompt,
          model: modelName 
        })
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        const data = await response.json();
        const result: TestResult = {
          model: modelName,
          response: data.response,
          responseTime,
          timestamp: new Date().toLocaleTimeString()
        };
        
        console.log(`✅ Test result for ${modelName}:`, result);
        setTestResults(prev => [result, ...prev]);
        return result;
      } else {
        const errorText = await response.text();
        console.error(`❌ Test failed for ${modelName}:`, errorText);
        const result: TestResult = {
          model: modelName,
          response: `Error: ${response.status} ${response.statusText}`,
          responseTime,
          timestamp: new Date().toLocaleTimeString()
        };
        setTestResults(prev => [result, ...prev]);
        return result;
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.error(`❌ Test error for ${modelName}:`, error);
      const result: TestResult = {
        model: modelName,
        response: `Error: ${error}`,
        responseTime,
        timestamp: new Date().toLocaleTimeString()
      };
      setTestResults(prev => [result, ...prev]);
      return result;
    }
  };

  // Run comprehensive Bisayan tests
  const runBisayanTests = async () => {
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    setIsTesting(true);
    setTestResults([]);
    
    const tests = [
      {
        name: 'Basic Vocabulary',
        prompt: 'Create a Bisayan (Cebuano) flashcard for "house". Format: Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]'
      },
      {
        name: 'Family Terms',
        prompt: 'Create a Bisayan (Cebuano) flashcard for "mother". Format: Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]'
      },
      {
        name: 'Food Items',
        prompt: 'Create a Bisayan (Cebuano) flashcard for "rice". Format: Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]'
      },
      {
        name: 'Greetings',
        prompt: 'Create a Bisayan (Cebuano) flashcard for "hello". Format: Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]'
      },
      {
        name: 'Complex Sentence',
        prompt: 'Translate this English sentence to Bisayan (Cebuano): "The child is playing with the dog in the house."'
      }
    ];

    for (const test of tests) {
      setCurrentTest(test.name);
      await testModel(selectedModel, test.prompt);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setCurrentTest('');
    setIsTesting(false);
  };

  // Test all models with one prompt
  const testAllModels = async () => {
    if (availableModels.length === 0) {
      alert('No models available');
      return;
    }

    setIsTesting(true);
    setTestResults([]);
    
    const testPrompt = 'Create a Bisayan (Cebuano) flashcard for "water". Format: Front: [emoji] [Bisayan word] | Back: [English word] - [English meaning]';
    
    for (const model of availableModels) {
      setCurrentTest(`Testing ${model.name}...`);
      await testModel(model.name, testPrompt);
      // Small delay between models
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setCurrentTest('');
    setIsTesting(false);
  };

  // Objective verification of Bisayan translations
  const verifyBisayanTranslation = (response: string, testType: string): { isCorrect: boolean; correctAnswer: string; explanation: string } => {
    const bisayanDictionary: { [key: string]: string } = {
      'water': 'tubig',
      'house': 'balay', 
      'tree': 'kahoy',
      'sun': 'adlaw',
      'moon': 'bulan',
      'fire': 'kalayo',
      'sea': 'dagat',
      'mountain': 'bukid',
      'star': 'bitoon',
      'world': 'kalibutan',
      'food': 'pagkaon',
      'book': 'basahon',
      'friend': 'higala',
      'mother': 'nanay',
      'father': 'tatay',
      'child': 'bata',
      'good': 'maayo',
      'big': 'dako',
      'small': 'gamay'
    };

    // Extract the Bisayan word from the response
    // Try multiple patterns to catch different formats
    let bisayanWord = '';
    
    // Pattern 1: Front: [emoji] [word] | Back:
    const frontMatch1 = response.match(/Front:\s*[🌿💧🏊‍♀️🌊🏠🌳☀️🌙🔥🌊⛰️⭐🌍🍎📖👥👨‍👩‍👧‍👦👶✅🔴🔵]*\s*([^|]+)/i);
    if (frontMatch1) {
      bisayanWord = frontMatch1[1].trim().toLowerCase();
    }
    
    // Pattern 2: **Front**: [emoji] [word] | **Back**:
    const frontMatch2 = response.match(/\*\*Front\*\*:\s*[🌿💧🏊‍♀️🌊🏠🌳☀️🌙🔥🌊⛰️⭐🌍🍎📖👥👨‍👩‍👧‍👦👶✅🔴🔵]*\s*([^|]+)/i);
    if (frontMatch2 && !bisayanWord) {
      bisayanWord = frontMatch2[1].trim().toLowerCase();
    }
    
    // Pattern 3: Look for the word after "Front:" and before "|" or "Back"
    const frontMatch3 = response.match(/Front:\s*[^|]*?([a-zA-Z\u00C0-\u017F]+)/i);
    if (frontMatch3 && !bisayanWord) {
      bisayanWord = frontMatch3[1].trim().toLowerCase();
    }
    
    // Clean up the word (remove extra characters)
    bisayanWord = bisayanWord.replace(/[^\w\u00C0-\u017F]/g, '').trim();
    
    // Debug logging
    console.log(`🔍 Verification Debug for "${testType}":`);
    console.log(`   Raw response: "${response.substring(0, 100)}..."`);
    console.log(`   Extracted word: "${bisayanWord}"`);
    console.log(`   Expected word: "${bisayanDictionary[testType.toLowerCase()] || ''}"`);
    
    // Check if it matches the correct translation
    const correctAnswer = bisayanDictionary[testType.toLowerCase()] || '';
    const isCorrect = bisayanWord === correctAnswer.toLowerCase();
    
    let explanation = '';
    if (isCorrect) {
      explanation = `✅ Correct! "${bisayanWord}" is the right Bisayan word for "${testType}"`;
    } else {
      explanation = `❌ Wrong! Expected "${correctAnswer}" but got "${bisayanWord}"`;
    }
    
    return { isCorrect, correctAnswer, explanation };
  };

  // Calculate quality score based on response content
  const calculateQualityScore = (response: string, testType: string = ''): number => {
    let score = 5; // Base score
    
    // Check for proper format (Front: | Back:)
    if (response.includes('Front:') && response.includes('Back:')) {
      score += 2;
    }
    
    // Check for emoji usage
    if (/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(response)) {
      score += 1;
    }
    
    // Check for Bisayan/Cebuano words
    const bisayanWords = ['balay', 'tubig', 'kahoy', 'adlaw', 'bulan', 'kalayo', 'dagat', 'bukid', 'bitoon', 'kalibutan'];
    const hasBisayan = bisayanWords.some(word => response.toLowerCase().includes(word));
    if (hasBisayan) {
      score += 2;
    }
    
    // Check for proper explanation format
    if (response.includes(' - ') || response.includes('meaning')) {
      score += 1;
    }
    
    // Penalty for errors or incomplete responses
    if (response.includes('Error') || response.includes('failed') || response.length < 20) {
      score -= 3;
    }
    
    // Ensure score is between 1 and 10
    return Math.max(1, Math.min(10, score));
  };

  // Load models on component mount
  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div className="min-h-screen morphing-gradient p-4 relative overflow-hidden">
      {/* Animated Background */}
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
        {/* Header */}
        <div className="text-center mb-8 pt-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 animate-bounce drop-shadow-lg">
            🤖 AI Model Tester
          </h1>
          <p className="text-white text-lg sm:text-xl font-semibold animate-pulse">
            Test which Ollama model knows Bisayan (Cebuano) best! 🇵🇭
          </p>
        </div>

        {/* Model Selection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">📋 Available Models</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-6">
            <div className="flex-1 max-w-md">
              <label className="block text-white font-semibold mb-2">Select Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoadingModels || isTesting}
                className="w-full p-4 rounded-2xl bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
              >
                {isLoadingModels ? (
                  <option>Loading models...</option>
                ) : availableModels.length === 0 ? (
                  <option>No models found</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model.name} value={model.name} className="text-gray-800">
                      {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
                    </option>
                  ))
                )}
              </select>
            </div>
            
            <button
              onClick={loadModels}
              disabled={isLoadingModels || isTesting}
              className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-6 py-4 rounded-2xl hover:from-blue-500 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 border-2 border-blue-300 font-semibold disabled:opacity-50"
            >
              {isLoadingModels ? '🔄 Loading...' : '🔄 Refresh Models'}
            </button>
          </div>

          {/* Model Info */}
          {selectedModel && (
            <div className="text-center">
              <p className="text-white/80 text-sm">
                Selected: <span className="font-bold text-yellow-300">{selectedModel}</span>
              </p>
            </div>
          )}
        </div>

        {/* Test Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">🧪 Test Controls</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={runBisayanTests}
              disabled={!selectedModel || isTesting}
              className="bg-gradient-to-r from-green-400 to-teal-500 text-white px-8 py-4 rounded-2xl hover:from-green-500 hover:to-teal-600 transition-all duration-300 transform hover:scale-110 border-2 border-green-300 font-bold text-lg shadow-lg disabled:opacity-50"
            >
              {isTesting && currentTest.includes('Basic') ? '🔄 Testing...' : '🎯 Test Bisayan Knowledge'}
            </button>
            
            <button
              onClick={testAllModels}
              disabled={availableModels.length === 0 || isTesting}
              className="bg-gradient-to-r from-purple-400 to-pink-500 text-white px-8 py-4 rounded-2xl hover:from-purple-500 hover:to-pink-600 transition-all duration-300 transform hover:scale-110 border-2 border-purple-300 font-bold text-lg shadow-lg disabled:opacity-50"
            >
              {isTesting && currentTest.includes('Testing') ? '🔄 Testing All...' : '⚡ Test All Models'}
            </button>
          </div>

          {isTesting && (
            <div className="text-center mt-4">
              <p className="text-yellow-300 font-semibold animate-pulse">
                {currentTest || 'Running tests...'}
              </p>
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">📊 Test Results</h2>
            
            {/* Accuracy Summary */}
            <div className="mb-6 bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 text-center">📊 Accuracy Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {testResults.map((result, index) => {
                  const verification = verifyBisayanTranslation(result.response, 'water');
                  return (
                    <div key={index} className={`p-4 rounded-xl border-2 ${verification.isCorrect ? 'border-green-400 bg-green-500/10' : 'border-red-400 bg-red-500/10'}`}>
                      <div className="text-center">
                        <div className="text-2xl mb-2">{verification.isCorrect ? '✅' : '❌'}</div>
                        <div className="font-bold text-white">{result.model}</div>
                        <div className={`text-sm ${verification.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                          {verification.isCorrect ? 'CORRECT' : 'INCORRECT'}
                        </div>
                        <div className="text-xs text-white/70 mt-2">
                          Expected: "tubig" | Got: "{verification.correctAnswer}"
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4 text-center">🔍 Model Comparison Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full bg-white/5 rounded-2xl border border-white/10">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-white font-bold">Model</th>
                      <th className="text-left p-4 text-white font-bold">Response Time</th>
                      <th className="text-left p-4 text-white font-bold">Test Result</th>
                      <th className="text-left p-4 text-white font-bold">Accuracy</th>
                      <th className="text-left p-4 text-white font-bold">Quality Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result, index) => {
                      // Calculate quality score based on response content
                      const qualityScore = calculateQualityScore(result.response);
                      const qualityColor = qualityScore >= 8 ? 'text-green-300' : 
                                         qualityScore >= 6 ? 'text-yellow-300' : 'text-red-300';
                      
                      // Verify the Bisayan translation accuracy
                      const verification = verifyBisayanTranslation(result.response, 'water');
                      const accuracyColor = verification.isCorrect ? 'text-green-300' : 'text-red-300';
                      const accuracyIcon = verification.isCorrect ? '✅' : '❌';
                      
                      return (
                        <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <div className="font-bold text-yellow-300">{result.model}</div>
                            <div className="text-white/70 text-sm">{result.timestamp}</div>
                          </td>
                          <td className="p-4">
                            <span className="text-green-300 font-semibold">{result.responseTime}ms</span>
                          </td>
                          <td className="p-4">
                            <div className="text-white text-sm max-w-xs truncate">
                              {result.response.length > 100 ? 
                                result.response.substring(0, 100) + '...' : 
                                result.response}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className={`font-bold ${accuracyColor}`}>
                                {accuracyIcon}
                              </span>
                              <div className="text-xs text-white/70">
                                {verification.explanation}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`font-bold ${qualityColor}`}>
                              {qualityScore}/10
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Detailed Results */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4 text-center">📝 Detailed Results</h3>
              {testResults.map((result, index) => (
                <div key={index} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-yellow-300">{result.model}</h3>
                      <p className="text-white/70 text-sm">{result.timestamp}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-300 font-semibold">{result.responseTime}ms</p>
                    </div>
                  </div>
                  
                  <div className="bg-black/20 rounded-xl p-4">
                    <p className="text-white whitespace-pre-wrap break-words">
                      {result.response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-6">
              <button
                onClick={() => setTestResults([])}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold"
              >
                🗑️ Clear Results
              </button>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-8 py-4 rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 border-2 border-gray-400 font-semibold text-lg shadow-lg"
          >
            ← Back to Learning App
          </a>
        </div>
      </div>
    </div>
  );
}
