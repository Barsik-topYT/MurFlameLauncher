// build-inno-setup.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 Начинаем сборку установщика MurFlame Launcher с Inno Setup...\n');

// Проверка ОС
if (os.platform() !== 'win32') {
    console.error('❌ Inno Setup работает только на Windows!');
    process.exit(1);
}

// 1. Сборка приложения
console.log('📦 Шаг 1: Сборка приложения...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Приложение собрано');
} catch (error) {
    console.error('❌ Ошибка сборки:', error.message);
    process.exit(1);
}

// 2. Сборка portable версии (для получения файлов)
console.log('\n📦 Шаг 2: Сборка portable версии...');
try {
    // Удаляем старые сборки
    if (fs.existsSync('release')) {
        fs.rmSync('release', { recursive: true, force: true });
    }
    
    // Собираем portable версию
    execSync('npm run dist:portable', { stdio: 'inherit' });
    console.log('✅ Portable версия создана');
} catch (error) {
    console.error('❌ Ошибка сборки portable версии:', error.message);
    process.exit(1);
}

// 3. Проверка наличия файлов для установщика
console.log('\n📦 Шаг 3: Подготовка файлов для Inno Setup...');
const unpackedDir = path.join(__dirname, 'release', 'win-unpacked');

if (!fs.existsSync(unpackedDir)) {
    console.error('❌ Папка win-unpacked не найдена!');
    console.log('   Проверяем release директорию:');
    if (fs.existsSync('release')) {
        const files = fs.readdirSync('release');
        console.log('   Содержимое release:', files);
    }
    process.exit(1);
}

console.log(`   ✅ Файлы найдены в ${unpackedDir}`);

// 4. Поиск Inno Setup
console.log('\n📦 Шаг 4: Поиск Inno Setup...');

let isccPath = null;
const possiblePaths = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
    process.env.INNO_SETUP_PATH,
].filter(Boolean);

for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
        isccPath = testPath;
        break;
    }
}

if (!isccPath) {
    console.error('\n❌ Inno Setup не найден!');
    console.log('\n📥 Установите Inno Setup:');
    console.log('   1. Скачайте с https://jrsoftware.org/isinfo.php');
    console.log('   2. Установите Inno Setup');
    console.log('   3. Перезапустите этот скрипт');
    console.log('\n   Или используйте Chocolatey:');
    console.log('   choco install innosetup');
    process.exit(1);
}

console.log(`   ✅ Найден Inno Setup: ${isccPath}`);

// 5. Компиляция установщика
console.log('\n📦 Шаг 5: Компиляция установщика...');
const issPath = path.join(__dirname, 'installer.iss');

if (!fs.existsSync(issPath)) {
    console.error('❌ Файл installer.iss не найден!');
    process.exit(1);
}

try {
    execSync(`"${isccPath}" "${issPath}"`, { 
        stdio: 'inherit',
        cwd: __dirname
    });
    console.log('✅ Установщик успешно создан!');
} catch (error) {
    console.error('❌ Ошибка компиляции:', error.message);
    process.exit(1);
}

// 6. Проверка результатов
console.log('\n📁 Результаты сборки:');
const releaseDir = path.join(__dirname, 'release');

if (fs.existsSync(releaseDir)) {
    const files = fs.readdirSync(releaseDir);
    let installerFound = false;
    
    for (const file of files) {
        if (file.endsWith('.exe') && file.includes('Setup')) {
            const filePath = path.join(releaseDir, file);
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   ✅ ${file} (${sizeMB} MB) - УСТАНОВЩИК`);
            installerFound = true;
        }
    }
    
    if (!installerFound) {
        console.log('   ⚠️ Установщик не найден!');
        console.log('   Содержимое release:');
        files.forEach(file => {
            const filePath = path.join(releaseDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`      - ${file} (${sizeMB} MB)`);
            } else {
                console.log(`      - ${file}/`);
            }
        });
    }
}

console.log('\n🎉 Готово!');
console.log('📂 Установщик находится в папке release/');
console.log('\n📖 Инструкция по установке:');
console.log('   1. Запустите MurFlame_Launcher_Setup_15.06.26.exe');
console.log('   2. Следуйте инструкциям установщика');
console.log('   3. После установки лаунчер появится в меню Пуск и на рабочем столе');