const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(express.json());

let browser;

(async () => {
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.humanizeai.io', ['clipboard-read']);

    console.log('Puppeteer browser launched with clipboard-read permissions.');
  } catch (error) {
    console.error('Failed to launch Puppeteer browser:', error);
    process.exit(1);
  }
})();

app.post('/albert', async (req, res) => {
  const { inputText } = req.body;

  if (!inputText || typeof inputText !== 'string') {
    return res.status(400).json({ error: 'Invalid inputText provided.' });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('https://www.humanizeai.io', { waitUntil: 'networkidle2' });

    const inputSelector = '#inputText';
    const submitBtnSelector = '#submitBtn';
    const copyBtnSelector = 'button.copy';

    await page.waitForSelector(inputSelector, { timeout: 15000 });
    await page.type(inputSelector, inputText, { delay: 0 });

    await page.waitForSelector(submitBtnSelector, { timeout: 15000 });
    await page.click(submitBtnSelector);

    const delay = (time) => new Promise(resolve => setTimeout(resolve, time));
    await delay(20000);

    await page.waitForSelector(copyBtnSelector, { timeout: 30000 });
    await page.click(copyBtnSelector);

    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        return null;
      }
    });

    if (!clipboardText) {
      throw new Error('Failed to read clipboard text.');
    }

    await page.close();

    res.json({ output: clipboardText });
  } catch (error) {
    console.error('Automation failed:', error);
    res.status(500).json({ error: 'Automation failed', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (browser) {
    await browser.close();
    console.log('Puppeteer browser closed.');
  }
  process.exit(0);
});

app.listen(port, () => {
  console.log(`HumanizeAI API server is running on port ${port}`);
});