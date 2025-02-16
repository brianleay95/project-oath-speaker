require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('langchain/llms/openai');
const { RetrievalQAChain } = require('langchain/chains');
const { HNSWLib } = require('langchain/vectorstores/hnswlib');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

const app = express();

// Configure CORS to specifically allow frontend on port 3002
app.use(cors({
  origin: 'http://localhost:3002',
  credentials: true
}));
app.use(express.json());

// Initialize OpenAI
const model = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  modelName: 'gpt-3.5-turbo'
});

// In-memory storage
let chats = [];
let chatCounter = 0;
let vectorStores = new Map();

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Create new chat
app.post('/api/chats', (req, res) => {
  chatCounter++;
  const newChat = {
    id: Date.now().toString(),
    title: `New Chat #${chatCounter}`,
    preview: 'Start a new conversation',
    timestamp: new Date(),
    messages: []
  };
  
  chats.unshift(newChat);
  res.json(newChat);
});

// Get chat history
app.get('/api/chats', (req, res) => {
  res.json(chats);
});

// Delete chat
app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  chats = chats.filter(chat => chat.id !== id);
  res.json({ success: true });
});

// Add message to chat
app.post('/api/chat', async (req, res) => {
  const { chatId, question } = req.body;
  
  try {
    const completion = await model.call(question);
    const answer = completion;

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
    console.error('Error processing question:', error);
    res.status(500).json({ error: 'Error processing question' });
  }
});

// Start server on port 3001
const startServer = (port) => {
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
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