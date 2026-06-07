const fs = require('fs');
const path = require('path');
const { createSeedData } = require('./seed');

function createJsonStore(filePath = path.join(__dirname, '..', 'data', 'parking-db.json')) {
  const directory = path.dirname(filePath);

  function ensureFile() {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      write(createSeedData());
    }
  }

  function read() {
    ensureFile();
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function write(data) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  }

  function reset() {
    write(createSeedData());
  }

  return {
    read,
    write,
    reset,
    filePath
  };
}

module.exports = {
  createJsonStore
};
