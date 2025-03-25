const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50
    });
    const page = await browser.newPage();

    const startUrl = 'https://langeek.co/en/vocab/category/7/b1-level';
    await page.goto(startUrl, { waitUntil: 'networkidle2' });

    const lessonLinks = await page.$$eval('a[href*="/subcategory/"]', (anchors) =>
        anchors.map((a) => ({
            text: a.textContent.trim(),
            url: a.href
        }))
    );

    console.log('Найдено подкатегорий (уроков):', lessonLinks.length);

    for (let i = 0; i < lessonLinks.length; i++) {
        const { text: lessonName, url: lessonUrl } = lessonLinks[i];
        console.log(`\n[${i + 1}/${lessonLinks.length}] Переходим в урок: ${lessonName} => ${lessonUrl}`);

        await page.goto(lessonUrl, { waitUntil: 'networkidle2' });

        const cardSelector = '.tw-p-4.lg\\:tw-p-6.tw-shadow-2.tw-rounded-3xl.tw-flex.tw-flex-col.tw-justify-between.tw-bg-item-background';

        try {
            await page.waitForSelector(cardSelector, { timeout: 5000 });
        } catch (err) {
            console.log(`   Нет карточек на уроке "${lessonName}"`);
            continue;
        }

        const dataInThisLesson = await page.$$eval(cardSelector, (cards, lesson) => {
            return cards.map((card) => {
                const wordEl = card.querySelector('.tw-text-sm.sm\\:tw-text-lg.tw-font-text-bold.tw-block-1.tw-mb-3');
                const word = wordEl ? wordEl.textContent.trim() : '';
                const defEl = card.querySelector('p.tw-text-base');
                const definition = defEl ? defEl.textContent.trim() : '';
                const posEl = card.querySelector('[class*="tw-text-pos-"].tw-font-text-bold.tw-mb-3');
                const partOfSpeech = posEl ? posEl.textContent.trim() : '';

                return {
                    lessonName: lesson,
                    word,
                    definition,
                    partOfSpeech,
                };
            });
        }, lessonName);

        console.log(`   Найдено карточек: ${dataInThisLesson.length}`);
        if (dataInThisLesson.length > 0) {
            const csvRows = ['LessonName,Word,Definition,PartOfSpeech'];

            for (const item of dataInThisLesson) {
                const l = item.lessonName.replace(/"/g, '""');
                const w = item.word.replace(/"/g, '""');
                const d = item.definition.replace(/"/g, '""');
                const p = item.partOfSpeech.replace(/"/g, '""');
                csvRows.push(`"${l}","${w}","${d}","${p}"`);
            }

            const filename = `LevelB1_Lesson${i + 1}.csv`;
            fs.writeFileSync(filename, csvRows.join('\n'), 'utf8');
            console.log(`   Данные по "${lessonName}" сохранены в "${filename}".`);
        } else {
            console.log(`   Урок "${lessonName}" пуст — CSV не создан.`);
        }
    }

    console.log('\nВсе уроки обработаны! Закрываем браузер...');
    await browser.close();
})();
