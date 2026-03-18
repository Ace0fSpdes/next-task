const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'nul');

try {
  fs.unlinkSync(filePath);
  console.log('File "nul" has been successfully deleted.');
} catch (err) {
  // Try the extended path syntax for Windows if the first attempt fails
  if (process.platform === 'win32') {
    const extendedPath = '\\\\?\\' + filePath;
    try {
      fs.unlinkSync(extendedPath);
      console.log('File "nul" has been successfully deleted using extended path.');
    } catch (e) {
      console.error('Error deleting file with extended path:', e.message);
      process.exit(1);
    }
  } else {
    console.error('Error deleting file:', err.message);
    process.exit(1);
  }
}
