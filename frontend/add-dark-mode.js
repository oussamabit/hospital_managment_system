const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Not available by default, we'll use a simple recursive function

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (fullPath.endsWith('.tsx')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(path.join(__dirname, 'src'));

const replacements = [
    { regex: /\bbg-white(?![/:a-zA-Z0-9-])(?! dark:bg-slate-800)/g, replacement: 'bg-white dark:bg-slate-800' },
    { regex: /\bbg-gray-50(?![/:a-zA-Z0-9-])(?! dark:bg-slate-800\/50)/g, replacement: 'bg-gray-50 dark:bg-slate-800/50' },
    { regex: /\bbg-gray-100(?![/:a-zA-Z0-9-])(?! dark:bg-slate-700)/g, replacement: 'bg-gray-100 dark:bg-slate-700' },
    { regex: /\btext-gray-900(?![/:a-zA-Z0-9-])(?! dark:text-white)/g, replacement: 'text-gray-900 dark:text-white' },
    { regex: /\btext-gray-800(?![/:a-zA-Z0-9-])(?! dark:text-gray-200)/g, replacement: 'text-gray-800 dark:text-gray-200' },
    { regex: /\btext-gray-700(?![/:a-zA-Z0-9-])(?! dark:text-gray-300)/g, replacement: 'text-gray-700 dark:text-gray-300' },
    { regex: /\btext-gray-600(?![/:a-zA-Z0-9-])(?! dark:text-gray-300)/g, replacement: 'text-gray-600 dark:text-gray-300' },
    { regex: /\btext-gray-500(?![/:a-zA-Z0-9-])(?! dark:text-gray-400)/g, replacement: 'text-gray-500 dark:text-gray-400' },
    { regex: /\btext-gray-400(?![/:a-zA-Z0-9-])(?! dark:text-gray-500)/g, replacement: 'text-gray-400 dark:text-gray-500' },
    { regex: /\bborder-gray-100(?![/:a-zA-Z0-9-])(?! dark:border-slate-700)/g, replacement: 'border-gray-100 dark:border-slate-700' },
    { regex: /\bborder-gray-200(?![/:a-zA-Z0-9-])(?! dark:border-slate-600)/g, replacement: 'border-gray-200 dark:border-slate-600' },
    { regex: /\bdivide-gray-50(?![/:a-zA-Z0-9-])(?! dark:divide-slate-700\/50)/g, replacement: 'divide-gray-50 dark:divide-slate-700/50' },
    { regex: /\bdivide-gray-100(?![/:a-zA-Z0-9-])(?! dark:divide-slate-700)/g, replacement: 'divide-gray-100 dark:divide-slate-700' },
];

let filesModifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Don't modify FloatingActionMenu again or index.css
    if (file.includes('FloatingActionMenu.tsx') || file.includes('index.css')) return;

    replacements.forEach(({ regex, replacement }) => {
        content = content.replace(regex, replacement);
    });

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        filesModifiedCount++;
    }
});

console.log(`Modified ${filesModifiedCount} files for dark mode.`);
