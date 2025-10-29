const puppeteer = require("puppeteer");

parseAliExpress(
  "https://www.aliexpress.com/item/1005001782713617.html#nav-specification"
);

async function parseAliExpress(url) {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  page.on("console", async (msg) => {
    const args = await Promise.all(
      msg.args().map((arg) => arg.jsonValue().catch(() => undefined))
    );
    console.log("📜 [PAGE LOG]:", ...args);
  });

  try {
    // 1. МАСКУЄМОСЯ ПІД ЗВИЧАЙНИЙ БРАУЗЕР
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // 2. ДОДАЄМО ВИПАДКОВІ ЗАТРИМКИ
    await sleep(Math.random() * 5000 + 3000);

    console.log(`🔗 Спроба парсингу: ${url}`);

    // 3. ПЕРЕХОДИМО НА СТОРІНКУ
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    //await page.waitForSelector('title', { timeout: 30000 });

    // 4. ПЕРЕВІРЯЄМО ЧИ НЕ ЗАБЛОКОВАНО
    if (!response || response.status() !== 200) {
      console.log("❌ Сторінка не завантажилась");
      await page.close();
      return null;
    }

    // 5. ПЕРЕВІРЯЄМО URL (чи не перенаправлено на блокування)
    const currentUrl = page.url();
    if (
      currentUrl.includes("security") ||
      currentUrl.includes("verify") ||
      currentUrl.includes("block")
    ) {
      console.log("❌ AliExpress заблокував доступ");
      await page.close();
      return null;
    }

    // 6. ЧЕКАЄМО ДОДАТКОВОЙ ЧАС
    await sleep(3000);

    // 7. СПРОБУЄМО РІЗНІ МЕТОДИ ПОШУКУ ЦІНИ
    const aliData = await page.evaluate(() => {
      console.log("🔍 Початок пошуку ціни на сторінці...");

      // МЕТОД 1: Пошук за найпоширенішими селекторами
      const priceSelectors = [
        // Нові селектори AliExpress
        ".price-default--current--F8OlYIo",
        ".snow-price_SnowPrice__mainM__jo8n2",
        ".snow-price_SnowPrice__main__1pOJ_",
        ".product-price-current",
        "[data-product-price]",
        ".price--current",
        ".uniform-banner-box-price",
        // Старі селектори
        ".product-price-value",
        ".product-price",
        ".p-price",
        ".price",
      ];

      let price = "Не знайдено";
      let priceElement = null;

      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(
          `Перевірка селектора ${selector}: знайдено ${elements.length} елементів`
        );

        for (const element of elements) {
          if (element && element.textContent) {
            const text = element.textContent.trim();
            console.log(`Текст елемента: "${text}"`);

            // Шукаємо ціну в тексті
            const priceMatch = text.match(/([£$€₴]?\s*\d+[.,]\d+)/);
            if (priceMatch && text.length < 100) {
              // Фільтруємо довгі тексти
              price = text;
              priceElement = element;
              console.log(`✅ Знайдено ціну: ${price}`);
              break;
            }
          }
        }
        if (price !== "Не знайдено") break;
      }

      // МЕТОД 2: Пошук будь-якого тексту з ціною на сторінці
      if (price === "Не знайдено") {
        console.log("🔍 Спроба пошуку ціни в усьому DOM...");
        const allElements = document.querySelectorAll("*");
        for (const element of allElements) {
          if (element.textContent && element.textContent.length < 50) {
            const text = element.textContent.trim();
            const priceMatch = text.match(/([£$€₴]?\s*\d+[.,]\d+\s*[£$€₴]?)/);
            if (
              priceMatch &&
              !text.includes("cookie") &&
              !text.includes("Security")
            ) {
              price = text;
              console.log(`✅ Знайдено ціну в DOM: ${price}`);
              break;
            }
          }
        }
      }

      // МЕТОД 3: Пошук в meta-тегах
      if (price === "Не знайдено") {
        const metaPrice = document.querySelector(
          'meta[property="product:price"]'
        );
        if (metaPrice) {
          price = metaPrice.getAttribute("content");
          console.log(`✅ Знайдено ціну в meta: ${price}`);
        }
      }

      // Пошук зображення
      let imageUrl = "";
      const imageSelectors = [
        ".magnifier-image",
        ".main-image img",
        ".gallery-image img",
        'img[src*="jpg"], img[src*="png"], img[src*="jpeg"]',
      ];

      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element && element.src) {
          imageUrl = element.src;
          if (imageUrl.startsWith("//")) {
            imageUrl = "https:" + imageUrl;
          }
          break;
        }
      }

      console.log(price);

      return {
        price: price,
        imageUrl: imageUrl,
        title: document.title,
        url: window.location.href,
      };
    });

    console.log(`📊 Результат парсингу: ${aliData.price}`);
    await page.close();

    return aliData.price !== "Не знайдено" ? aliData : null;
  } catch (error) {
    console.log(`❌ Помилка парсингу: ${error.message}`);
    await page.close();
    return null;
  }
}
