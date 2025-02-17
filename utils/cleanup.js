const fs = require('fs').promises;
const path = require('path');

async function cleanupVectorStores() {
  const vectorDir = path.join(__dirname, '..', 'storage', 'vectors');
  try {
    await fs.rm(vectorDir, { recursive: true, force: true });
    await fs.mkdir(vectorDir, { recursive: true });
    console.log('Vector storage cleaned successfully');
  } catch (error) {
    console.error('Error cleaning vector storage:', error);
  }
}

if (require.main === module) {
  cleanupVectorStores();
}

module.exports = { cleanupVectorStores }; 