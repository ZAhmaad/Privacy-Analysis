import { chromium } from 'playwright';
// import { Browser } from 'playwright';
async function openWebsite() {


  const browser = await chromium.launch({ headless: false });


//   const context = await browser.newContext();

  
  const page = await browser.newPage();

  await page.goto('https://google.com');

 
  await browser.close();
}

// Run the Playwright code
openWebsite().catch((error) => console.error('Playwright Error:', error));
