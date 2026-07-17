const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(srcDir);
const fileNames = new Set(allFiles.map(f => f.replace(/\\/g, '/')));

let hasErrors = false;

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('@/')) {
      const resolvedPath = path.join(srcDir, importPath.slice(2));
      // check if it exists in the exact case
      let found = false;
      const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js', '.jsx'];
      
      for (const f of allFiles) {
        if (f.startsWith(resolvedPath)) {
            // Check exact match
            const checkBase = f.slice(0, f.lastIndexOf('.'));
            if (checkBase === resolvedPath || f === resolvedPath) {
                found = true;
                break;
            }
        }
      }

      if (!found) {
        // Did it match case-insensitively?
        for (const f of allFiles) {
           const checkBase = f.slice(0, f.lastIndexOf('.')).toLowerCase();
           if (checkBase === resolvedPath.toLowerCase() || f.toLowerCase() === resolvedPath.toLowerCase()) {
               console.error(`Case mismatch in ${file}:\nImported: ${importPath}\nActual file: ${f}`);
               hasErrors = true;
           }
        }
      }
    }
  }
}

if (!hasErrors) {
  console.log("No case mismatches found!");
}
