const fs = require('fs');
const lighthouse = require('lighthouse');
const chromium = require('chromium');
const chromeLauncher = require('chrome-launcher');
const Sitemapper = require('sitemapper');
const commandLineArgs = require('command-line-args');
const options = commandLineArgs([
    { name: 'url', alias: 'u', type: String },
    { name: 'exclude', alias: 'x', type: String, multiple: true, optional: true }
]);
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
    console.log(`\tğ¨ FCP: ${fcp}`);
    console.log(`\tğ¼ï¸ LCP: ${lcp}`);
    console.log(`\tâï¸ TBT: ${tbt}`);
    console.log(`\tâï¸ CLS:  ${cls}`);
    console.log(`\tğ Speed Index: ${speed}`);
    console.log(`\tğ¥ Performance Score: ${finalScore * 100}`);
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
    let targetFile = `reports/${rundate}/${hasAlerts ? 'fail' : 'pass'}/${pageSlug}.html`
    fs.writeFileSync(`${targetFile}`, report);
}

async function getPagesToCheck() {
    const mapper = new Sitemapper({timeout: 5000});
    const { sites } = await mapper.fetch(options.url);
    if(!options.exclude) {
        options.exclude = [];
    }
    let pages = sites.filter(item => {
        for(let exclusion of options.exclude) {
            if(item.includes(exclusion)) {
                return false;
            }
        }
        return true;
    });
    return pages;
}

(async () => {
    const pages = await getPagesToCheck();
    const chrome = await chromeLauncher.launch(chromeOptions);
    lighthouseOptions.port = chrome.port;

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
            console.log(`\tâ LCP Over Limit: ${runnerResult.lhr.audits['largest-contentful-paint'].numericValue - 2500}ms`)
            hasAlerts = true;
        }
        if(runnerResult.lhr.audits['cumulative-layout-shift'].numericValue > .10) {
            console.log(`\tâ CLS Too High: ${runnerResult.lhr.finalUrl}`);
            hasAlerts = true;
        }
        if(runnerResult.lhr.audits['first-meaningful-paint'].numericValue < 2500 && runnerResult.lhr.audits['cumulative-layout-shift'].numericValue < .10 && runnerResult.lhr.audits['largest-contentful-paint'].numericValue <= 2500) {
            console.log(`\tğ Results OK!`);
        }

        writeResultToFile(page, runnerResult.report, hasAlerts);
    }
    await chrome.kill();
})();