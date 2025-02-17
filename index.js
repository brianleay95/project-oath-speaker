require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { HNSWLib } = require('langchain/vectorstores/hnswlib');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Configure CORS to specifically allow frontend on port 3000
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory storage
let chats = [];
let chatCounter = 0;
let vectorStores = new Map();

const VECTOR_DIR = path.join(__dirname, 'storage', 'vectors');

// Ensure vector storage directory exists
async function ensureVectorDir() {
  try {
    await fs.mkdir(VECTOR_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating vector directory:', error);
  }
}

// Load existing vector stores
async function loadVectorStores() {
  try {
    const files = await fs.readdir(VECTOR_DIR);
    for (const file of files) {
      if (file.endsWith('.index')) {
        const chatId = file.replace('.index', '');
        const directory = path.join(VECTOR_DIR, chatId);
        try {
          const vectorStore = await HNSWLib.load(directory);
          vectorStores.set(chatId, vectorStore);
          console.log(`Loaded vector store for chat ${chatId}`);
        } catch (error) {
          console.error(`Error loading vector store for chat ${chatId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error loading vector stores:', error);
  }
}

// Initialize storage
ensureVectorDir();
loadVectorStores();

// Add this to load existing chats counter on server start
async function initializeChatCounter() {
  chatCounter = chats.length;
  console.log(`Initialized chat counter to ${chatCounter}`);
}

// Call this after loading vector stores
initializeChatCounter();

// Initialize chat counter when server starts
initializeChatCounter();

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Create new chat
app.post('/api/chats', async (req, res) => {
  try {
    console.log('Creating new chat, current counter:', chatCounter);
    chatCounter++;
    console.log('New counter value:', chatCounter);
    
    const newChat = {
      id: Date.now().toString(),
      title: `New Chat #${chatCounter}`,
      preview: 'Start a new conversation',
      timestamp: new Date(),
      messages: []
    };

    console.log('Created new chat:', newChat);
    
    // Add to beginning of chats array
    chats.unshift(newChat);
    console.log('Total chats after adding:', chats.length);

    // Initialize vector store for this chat
    vectorStores.set(newChat.id, null);

    res.json(newChat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get chat history
app.get('/api/chats', (req, res) => {
  res.json(chats);
});

// Delete chat
app.delete('/api/chats/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Remove from memory
    chats = chats.filter(chat => chat.id !== id);
    vectorStores.delete(id);

    // Remove from disk
    const directory = path.join(VECTOR_DIR, id);
    await fs.rm(directory, { recursive: true, force: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Add file processing endpoint
app.post('/api/process-files', async (req, res) => {
  const { chatId, text } = req.body;
  
  try {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await textSplitter.createDocuments([text]);

    // Create or get vector store for this chat
    let vectorStore = vectorStores.get(chatId);
    const directory = path.join(VECTOR_DIR, chatId);

    if (!vectorStore) {
      vectorStore = await HNSWLib.fromDocuments(chunks);
      vectorStores.set(chatId, vectorStore);
    } else {
      await vectorStore.addDocuments(chunks);
    }

    // Save to disk
    await vectorStore.save(directory);

    res.json({ success: true, message: 'Files processed successfully' });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ error: 'Failed to process files' });
  }
});

// Update chat endpoint to use Claude
app.post('/api/chat', async (req, res) => {
  const { chatId, question } = req.body;
  
  try {
    let answer;
    const vectorStore = vectorStores.get(chatId);

    if (vectorStore) {
      // Use RAG with context
      const docs = await vectorStore.similaritySearch(question, 3);
      const context = docs.map(doc => doc.pageContent).join('\n\n');
      
      const message = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Context: ${context}\n\nQuestion: ${question}`
        }]
      });
      
      answer = message.content[0].text;
    } else {
      // Regular chat without context
      const message = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: question
        }]
      });
      
      answer = message.content[0].text;
    }

    // Update chat history...
    if (chatId && chats.length > 0) {
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        chat.messages.push(
          { role: 'user', content: question, timestamp: new Date() },
          { role: 'assistant', content: answer, timestamp: new Date() }
        );
        chat.preview = question;
        chat.title = chat.messages.length === 2 ? `Chat about ${question.slice(0, 30)}...` : chat.title;
      }
    }
    
    res.json({ answer });
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Error processing question',
      details: error.message 
    });
  }
});

// Test AI connection
app.get('/api/test-ai', async (req, res) => {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: 'Say hello'
      }]
    });
    res.json({ success: true, response: message.content[0].text });
  } catch (error) {
    console.error('Claude test error:', error);
    res.status(500).json({ 
      error: 'Failed to connect to Claude',
      details: error.message 
    });
  }
});

// Add this endpoint to get chat messages
app.get('/api/chats/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const chat = chats.find(c => c.id === id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json(chat);
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Update the messages endpoint
app.post('/api/chats/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { message, question } = req.body;
  
  try {
    const chat = chats.find(c => c.id === id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message to chat
    chat.messages = chat.messages || [];
    chat.messages.push(message);

    // Get AI response
    const aiResponse = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: question
      }]
    });

    const answer = aiResponse.content[0].text;

    // Add AI message to chat
    const aiMessage = {
      role: 'assistant',
      content: answer,
      timestamp: new Date()
    };
    chat.messages.push(aiMessage);

    res.json({ answer });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Update the chat title endpoint
app.patch('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  
  try {
    console.log('Updating chat title:', { id, title });
    const chat = chats.find(c => c.id === id);
    if (!chat) {
      console.log('Chat not found:', id);
      return res.status(404).json({ error: 'Chat not found' });
    }

    chat.title = title;
    console.log('Chat updated:', chat);
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Start server on port 3001
const startServer = (port) => {
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
    console.log('Initial chat counter:', chatCounter);
    console.log('Initial number of chats:', chats.length);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(3001); 