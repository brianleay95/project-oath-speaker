import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get messages for a chat
router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        chatId: req.params.chatId
      },
      orderBy: {
        timestamp: 'asc'
      }
    });
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Add a message to a chat
router.post('/chats/:chatId/messages', async (req, res) => {
  try {
    const { message, question } = req.body;
    
    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        chatId: req.params.chatId,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp)
      }
    });

    // Get AI response
    const aiResponse = await getAIResponse(question); // Your existing AI logic

    // Save AI message
    const aiMessage = await prisma.message.create({
      data: {
        chatId: req.params.chatId,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }
    });

    res.json({ 
      userMessage,
      aiMessage,
      answer: aiResponse
    });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Delete all messages for a chat
router.delete('/chats/:chatId/messages', async (req, res) => {
  try {
    await prisma.message.deleteMany({
      where: {
        chatId: req.params.chatId
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

export default router; 