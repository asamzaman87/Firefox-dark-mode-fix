import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const prefix = 'gpt';
const fileExtensions = ['.tsx', '.jsx', '.js', '.ts'];
const directoriesToProcess = ['src', 'components', 'pages'];

// Only protect NON-Tailwind classes
const protectedClasses = [
  'peer', 'group',
  'aria-', 'data-'
];

// Regex patterns
const classRegex = /(className|class)=(?:"([^"]*)"|'([^']*)'|{([^}]*)}|`([^`]*)`)/g;
const cnFunctionRegex = /cn\(([^)]*)\)/g;
const cvaFunctionRegex = /cva\(([\s\S]*?)\)/g;

function shouldPrefix(className) {
  if (className.startsWith(`${prefix}:`)) return false;
  if (protectedClasses.some(p => className === p || className.startsWith(`${p}:`))) return false;
  if (className.startsWith('[') || className.startsWith('@')) return false;
  return true;
}

function processClassString(classString) {
  return classString.split(/\s+/).map(cls => {
    if (!shouldPrefix(cls)) return cls;
    
    if (cls.includes(':')) {
      const parts = cls.split(':');
      const utility = parts.pop();
      return [...parts, `${prefix}:${utility}`].join(':');
    }
    
    return `${prefix}:${cls}`;
  }).join(' ');
}

function processStringLiterals(content) {
  return content.replace(/(["'`])(.*?)\1/g, (match, quote, content) => {
    if (!content.match(/\b([a-z-]+:\s*)?[a-z][a-z0-9-]*\b/)) return match;
    return `${quote}${processClassString(content)}${quote}`;
  });
}

function processCnArguments(args) {
  return processStringLiterals(args);
}

function processCvaArguments(args) {
  const parts = args.split(/(?<!\\)}(?!\s*[,}])/);
  if (parts.length < 2) return args;
  
  const baseClasses = parts[0].replace(/(["'`])(.*?)\1/, (match, quote, content) => {
    return `${quote}${processClassString(content)}${quote}`;
  });
  
  const variants = parts.slice(1).join('}').replace(/(["'`])([^"'`]+)\1/g, (match, quote, content) => {
    return `${quote}${processClassString(content)}${quote}`;
  });
  
  return `${baseClasses}}${variants}`;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modifiedContent = content;

  modifiedContent = modifiedContent.replace(cvaFunctionRegex, match => {
    const args = match.slice(4, -1);
    return `cva(${processCvaArguments(args)})`;
  });

  modifiedContent = modifiedContent.replace(classRegex, (match, attr, dqContent, sqContent, jsContent, templateContent) => {
    const content = dqContent || sqContent || jsContent || templateContent;
    if (!content) return match;
    
    if (content.includes('cn(')) {
      const processed = content.replace(cnFunctionRegex, cnMatch => {
        const args = cnMatch.slice(3, -1);
        return `cn(${processCnArguments(args)})`;
      });
      return match.replace(content, processed);
    }
    return match.replace(content, processClassString(content));
  });

  modifiedContent = modifiedContent.replace(cnFunctionRegex, match => {
    const args = match.slice(3, -1);
    return `cn(${processCnArguments(args)})`;
  });

  if (content !== modifiedContent) {
    fs.writeFileSync(filePath, modifiedContent);
    console.log(`Updated: ${filePath}`);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDirectory(fullPath);
    } else if (fileExtensions.includes(path.extname(file).toLowerCase())) {
      processFile(fullPath);
    }
  });
}

directoriesToProcess.forEach(dir => {
  const fullDirPath = path.join(__dirname, dir);
  if (fs.existsSync(fullDirPath)) {
    walkDirectory(fullDirPath);
  } else {
    console.warn(`Directory not found: ${fullDirPath}`);
  }
});

console.log('Prefixing complete!');