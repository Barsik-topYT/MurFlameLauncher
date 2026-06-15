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

// 2. Сборка через electron-builder (только NSIS)
console.log('\n📦 Шаг 2: Сборка NSIS установщика...');
try {
    // Очищаем старые сборки
    if (fs.existsSync('release')) {
        fs.rmSync('release', { recursive: true, force: true });
    }
    
    // Собираем ТОЛЬКО NSIS установщик
    execSync('npx electron-builder --win nsis --x64', { 
        stdio: 'inherit'
    });
    console.log('✅ NSIS установщик создан');
} catch (error) {
    console.error('❌ Ошибка electron-builder:', error.message);
    process.exit(1);
}

// 3. Проверка результатов
console.log('\n📁 Готовые установщики:');
const releaseDir = path.join(__dirname, 'release');
if (fs.existsSync(releaseDir)) {
    const files = fs.readdirSync(releaseDir);
    let installerFound = false;
    for (const file of files) {
        if (file.endsWith('.exe') && file.includes('Setup')) {
            const stats = fs.statSync(path.join(releaseDir, file));
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   ✅ ${file} (${sizeMB} MB) - ЭТО УСТАНОВЩИК`);
            installerFound = true;
        }
    }
    if (!installerFound) {
        console.log('   ⚠️ Установщик не найден! Ищу все .exe:');
        for (const file of files) {
            if (file.endsWith('.exe')) {
                console.log(`      - ${file}`);
            }
        }
    }
}

console.log('\n🎉 Как установить:');
console.log('1. Запустите MurFlame_Launcher_Setup_08.06.26.exe из папки release/');
console.log('2. Следуйте инструкциям установщика');
console.log('3. После установки лаунчер появится в меню Пуск');