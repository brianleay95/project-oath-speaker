const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { cleanupVectorStores } = require('../utils/cleanup');

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';

// Import app after environment setup
const app = require('../index');

describe('API Endpoints', () => {
  beforeEach(async () => {
    // Clean up vector stores before each test
    await cleanupVectorStores();
  });

  // Test health check endpoint
  test('GET / should return server status', async () => {
    const response = await request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'Server is running'
    });
  });

  // Test chat creation
  test('POST /api/chats should create a new chat', async () => {
    const response = await request(app)
      .post('/api/chats')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('preview');
    expect(response.body).toHaveProperty('messages');
  });

  // Test file processing
  test('POST /api/process-files should process text files', async () => {
    // First create a chat
    const chatResponse = await request(app)
      .post('/api/chats');
    
    const chatId = chatResponse.body.id;
    
    const response = await request(app)
      .post('/api/process-files')
      .send({
        chatId,
        text: 'This is a test document for vector storage.'
      })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    
    // Verify vector store was created
    const vectorDir = path.join(__dirname, '..', 'storage', 'vectors', chatId);
    const exists = await fs.access(vectorDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  // Test chat with RAG
  test('POST /api/chat should use RAG when documents exist', async () => {
    // First create a chat
    const chatResponse = await request(app)
      .post('/api/chats');
    
    const chatId = chatResponse.body.id;
    
    // Process a document
    await request(app)
      .post('/api/process-files')
      .send({
        chatId,
        text: 'The capital of France is Paris.'
      });
    
    // Test chat with question about the document
    const response = await request(app)
      .post('/api/chat')
      .send({
        chatId,
        question: 'What is the capital of France?'
      })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('answer');
    expect(response.body.answer.toLowerCase()).toContain('paris');
  });

  // Test chat deletion
  test('DELETE /api/chats/:id should delete chat and vector store', async () => {
    // First create a chat
    const chatResponse = await request(app)
      .post('/api/chats');
    
    const chatId = chatResponse.body.id;
    
    // Process a document to create vector store
    await request(app)
      .post('/api/process-files')
      .send({
        chatId,
        text: 'Test document'
      });
    
    // Delete the chat
    await request(app)
      .delete(`/api/chats/${chatId}`)
      .expect(200);
    
    // Verify vector store was deleted
    const vectorDir = path.join(__dirname, '..', 'storage', 'vectors', chatId);
    const exists = await fs.access(vectorDir).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
}); 