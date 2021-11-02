const fs = require('fs');
const lighthouse = require('lighthouse');
const chromium = require('chromium');
const chromeLauncher = require('chrome-launcher');
const Sitemapper = require('sitemapper');
const commandLineArgs = require('command-line-args');
const options = commandLineArgs({
    name: 'url', alias: 'u', type: String
});
const rundate = new Date().toISOString().replace(/\//g, '-').replace(/:/g, '-');

let chromeOptions = {
    chromeFlags: ['--headless', '--disable-dev-shm-usage'],
    chromePath: chromium.path
}
let lighthouseOptions = {
    logLevel: 'error',
    output: 'html',
    onlyCategories: ['performance'],
    throttle: {
        rttMs: 150,
        throughputKbps: 1.6 * 1024,
        cpuSlowdownMultiplier: 4
    }
}

function logResultsToScreen(url, fcp, lcp, tbt, cls, speed, finalScore) 
{
    console.log(`\n\tLighthouse Results For: ${url}`);
    console.log(`\t🎨 FCP: ${fcp}`);
    console.log(`\t🖼️ LCP: ${lcp}`);
    console.log(`\t⌛️ TBT: ${tbt}`);
    console.log(`\t☁️ CLS:  ${cls}`);
    console.log(`\t🚀 Speed Index: ${speed}`);
    console.log(`\t🔥 Performance Score: ${finalScore * 100}`);
}

function writeResultToFile(page, report, hasAlerts) 
{
    if(!fs.existsSync('reports')) {
        fs.mkdirSync('reports');
    }
    if(!fs.existsSync(`reports/${rundate}`)) {
        fs.mkdirSync(`reports/${rundate}`);
        fs.mkdirSync(`reports/${rundate}/pass`);
        fs.mkdirSync(`reports/${rundate}/fail`);
    }
    // clean up the URL and sort it into the proper folder
    let pageSlug = page.replace(/^.*\/\/[^\/]+/, '').replace(/\//g, '-').slice(1);
    if(pageSlug[pageSlug.length-1] === '-') {
        pageSlug = pageSlug.slice(0, pageSlug.length-1);
    }
    // If there is nothing, it must be the index
    if(pageSlug === '') {
        pageSlug = 'index';
    }
    let targetFile = `reports/${rundate}/pass/${pageSlug}.html`
    if(hasAlerts !== false) {
        targetFile = `reports/${rundate}/fail/${pageSlug}.html`
    }
    fs.writeFileSync(`${targetFile}`, report);
}

(async () => {
    const mapper = new Sitemapper({timeout: 5000});
    const { sites } = await mapper.fetch(options.url);
    const chrome = await chromeLauncher.launch(chromeOptions);
    lighthouseOptions.port = chrome.port;

    // For wordpress, don't scan blog posts
    let pages = sites.filter(item => {
        return !item.includes('/blog/');
    });

    for(let page of pages) {
        let hasAlerts = false;
        console.log(`testing: ${page}`);
        const runnerResult = await lighthouse(page, lighthouseOptions);
        const first_contentful_paint = runnerResult.lhr.audits['first-contentful-paint'].displayValue;
        const first_meaningful_paint = runnerResult.lhr.audits['first-meaningful-paint'].displayValue;
        const largest_contentful_paint = runnerResult.lhr.audits['largest-contentful-paint'].displayValue;
        const total_blocking_time =  runnerResult.lhr.audits['total-blocking-time'].displayValue;
        const speed_index =  runnerResult.lhr.audits['speed-index'].displayValue;
        const cls = runnerResult.lhr.audits['cumulative-layout-shift'].displayValue;

        logResultsToScreen(page, first_contentful_paint, largest_contentful_paint, total_blocking_time, cls, speed_index, runnerResult.lhr.categories.performance.score);

        if(runnerResult.lhr.audits['largest-contentful-paint'].numericValue > 2500) {
            console.log(`\t❌ LCP Over Limit: ${runnerResult.lhr.audits['largest-contentful-paint'].numericValue - 2500}ms`)
            hasAlerts = true;
        }
        if(runnerResult.lhr.audits['cumulative-layout-shift'].numericValue > .10) {
            console.log(`\t❌ CLS Too High: ${runnerResult.lhr.finalUrl}`);
            hasAlerts = true;
        }
        if(runnerResult.lhr.audits['first-meaningful-paint'].numericValue < 2500 && runnerResult.lhr.audits['cumulative-layout-shift'].numericValue < .10 && runnerResult.lhr.audits['largest-contentful-paint'].numericValue <= 2500) {
            console.log(`\t🍀 Results OK!`);
        }

        writeResultToFile(page, runnerResult.report, hasAlerts);
    }
    await chrome.kill();
})();