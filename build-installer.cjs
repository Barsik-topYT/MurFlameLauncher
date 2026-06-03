// build-installer.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Начинаем сборку установщика MurFlame Launcher...\n');

// 1. Сборка приложения
console.log('📦 Шаг 1: Сборка приложения...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Приложение собрано');
} catch (error) {
    console.error('❌ Ошибка сборки приложения:', error.message);
    process.exit(1);
}

// 2. Проверка наличия собранных файлов
console.log('\n📦 Шаг 2: Проверка собранных файлов...');
const mainFile = path.join(__dirname, 'dist-electron', 'main.js');
if (!fs.existsSync(mainFile)) {
    console.error('❌ Файл dist-electron/main.js не найден!');
    process.exit(1);
}
console.log('✅ Файлы найдены');

// 3. Сборка через electron-builder
console.log('\n📦 Шаг 3: Сборка NSIS и Portable версий...');
try {
    // Очищаем старые сборки
    if (fs.existsSync('release')) {
        fs.rmSync('release', { recursive: true, force: true });
    }
    
    execSync('npx electron-builder --win nsis portable --x64', { 
        stdio: 'inherit',
        env: { ...process.env, DEBUG: 'electron-builder' }
    });
    console.log('✅ NSIS и Portable версии созданы');
} catch (error) {
    console.error('❌ Ошибка electron-builder:', error.message);
    console.log('\n💡 Попробуйте запустить вручную:');
    console.log('   npx electron-builder --win nsis portable --x64');
}

// 4. Проверка Inno Setup
console.log('\n📦 Шаг 4: Проверка Inno Setup...');
const innosetupPaths = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 7\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 7\\ISCC.exe',
];

let isccPath = null;
for (const p of innosetupPaths) {
    if (fs.existsSync(p)) {
        isccPath = p;
        break;
    }
}

if (isccPath && fs.existsSync('installer.iss')) {
    console.log('✅ Inno Setup найден:', isccPath);
    console.log('\n🔧 Создание Inno Setup установщика...');
    try {
        execSync(`"${isccPath}" installer.iss`, { stdio: 'inherit' });
        console.log('✅ Inno Setup установщик создан');
    } catch (error) {
        console.error('❌ Ошибка Inno Setup:', error.message);
    }
} else {
    console.log('⚠️ Inno Setup не найден или файл installer.iss отсутствует');
    if (!isccPath) {
        console.log('   Скачайте Inno Setup: https://jrsoftware.org/isdl.php');
    }
}

// 5. Проверка результатов
console.log('\n📁 Готовые файлы:');

const releaseDir = path.join(__dirname, 'release');
if (fs.existsSync(releaseDir)) {
    const files = fs.readdirSync(releaseDir);
    let hasFiles = false;
    for (const file of files) {
        if (file.endsWith('.exe')) {
            const stats = fs.statSync(path.join(releaseDir, file));
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   ✅ ${file} (${sizeMB} MB)`);
            hasFiles = true;
        }
    }
    if (!hasFiles) {
        console.log('   ⚠️ Файлы не найдены в release/');
        console.log('   Содержимое папки release:', fs.readdirSync(releaseDir));
    }
} else {
    console.log('   ⚠️ Папка release не создана');
}

const installerDir = path.join(__dirname, 'installer');
if (fs.existsSync(installerDir)) {
    const files = fs.readdirSync(installerDir);
    for (const file of files) {
        if (file.endsWith('.exe')) {
            const stats = fs.statSync(path.join(installerDir, file));
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   ✅ ${file} (${sizeMB} MB)`);
        }
    }
}

console.log('\n🎉 Готово!');