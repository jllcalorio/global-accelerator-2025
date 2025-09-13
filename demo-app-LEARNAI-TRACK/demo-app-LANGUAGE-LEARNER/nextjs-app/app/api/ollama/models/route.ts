import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching available Ollama models...');
    
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('❌ Ollama models API failed:', response.status, response.statusText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch models from Ollama',
          status: response.status,
          statusText: response.statusText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Available models:', data);
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching Ollama models:', error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to Ollama service',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
